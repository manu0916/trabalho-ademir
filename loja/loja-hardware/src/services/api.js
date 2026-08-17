const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

// In production Vercel proxies /api to Render. Keeping browser requests
// same-origin preserves cookies and Authorization without relying on CORS.
const API_URL = import.meta.env.PROD
  ? '/api'
  : configuredApiUrl
    ? `${configuredApiUrl.replace(/\/$/, '')}${configuredApiUrl.endsWith('/api') ? '' : '/api'}`
    : '/api';

const ADMIN_SESSION_STORAGE_KEY = 'nexus-admin-session-v1';
const ADMIN_TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[0-9]+\.[A-Za-z0-9_-]+$/;

let csrfToken;
let csrfTokenRequest;
let productsRequest;
let adminAccessToken;
let adminAccessTokenExpiresAt = 0;

function sessionExpiredError() {
  const error = new Error('Sua sess\u00e3o administrativa expirou. Entre novamente para continuar.');
  error.status = 401;
  return error;
}

function clearAdminAccessToken() {
  adminAccessToken = undefined;
  adminAccessTokenExpiresAt = 0;
  try {
    sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in privacy modes; memory remains usable.
  }
}

function storeAdminAccessToken(session) {
  const token = session?.accessToken;
  const expiresAt = Number(session?.expiresAtEpochSeconds);
  const email = typeof session?.email === 'string' ? session.email : '';

  if (typeof token !== 'string'
      || !ADMIN_TOKEN_PATTERN.test(token)
      || !Number.isFinite(expiresAt)
      || expiresAt <= Math.floor(Date.now() / 1000) + 5) {
    clearAdminAccessToken();
    return false;
  }

  adminAccessToken = token;
  adminAccessTokenExpiresAt = expiresAt;
  try {
    sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify({ accessToken: token, expiresAtEpochSeconds: expiresAt, email }));
  } catch {
    // The request can continue with the in-memory token.
  }
  return true;
}

function restoreAdminAccessToken() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) || 'null');
    if (stored) storeAdminAccessToken(stored);
  } catch {
    clearAdminAccessToken();
  }
}

function hasUsableAdminAccessToken() {
  return Boolean(adminAccessToken)
    && adminAccessTokenExpiresAt > Math.floor(Date.now() / 1000) + 5;
}

restoreAdminAccessToken();

async function parseResponse(response) {
  if (!response.ok) {
    let message = `Erro na API (${response.status})`;
    let errorCode;
    try {
      const body = await response.json();
      message = body.message || body.detail || message;
      if (typeof body.code === 'string') errorCode = body.code;
    } catch {
      // Some endpoints intentionally return an empty response.
    }
    const error = new Error(message);
    error.status = response.status;
    if (errorCode) error.code = errorCode;
    throw error;
  }

  if (response.status === 204) return null;
  return response.headers.get('content-type')?.includes('application/json') ? response.json() : null;
}

function normalizeConnectionError(error) {
  if (error instanceof TypeError || error?.message?.toLowerCase().includes('failed to fetch')) {
    return new Error('Falha de conex\u00e3o: n\u00e3o foi poss\u00edvel alcan\u00e7ar o backend.');
  }
  return error;
}

async function request(path, options = {}) {
  try {
    return await fetch(`${API_URL}${path}`, { ...options, credentials: 'include' });
  } catch (error) {
    throw normalizeConnectionError(error);
  }
}

function adminHeaders(options = {}) {
  const headers = new Headers(options.headers);
  if (hasUsableAdminAccessToken()) headers.set('Authorization', `Bearer ${adminAccessToken}`);
  return headers;
}

async function refreshAdminAccessTokenFromSession() {
  const response = await request('/admin/auth/session');
  if (response.status === 204 || response.status === 401 || response.status === 403) {
    clearAdminAccessToken();
    return null;
  }
  const session = await parseResponse(response);
  return storeAdminAccessToken(session) ? session : null;
}

async function adminRequest(path, options = {}) {
  if (!hasUsableAdminAccessToken()) await refreshAdminAccessTokenFromSession();
  if (!hasUsableAdminAccessToken()) throw sessionExpiredError();

  const send = () => request(path, { ...options, headers: adminHeaders(options) });
  let response = await send();
  if (response.status !== 401 && response.status !== 403) return response;

  // A restart can invalidate the HTTP session. Refresh once and retry; if it
  // still fails, the UI returns to login instead of leaving a broken panel.
  clearAdminAccessToken();
  const refreshed = await refreshAdminAccessTokenFromSession();
  if (!refreshed) throw sessionExpiredError();

  response = await send();
  if (response.status === 401 || response.status === 403) clearAdminAccessToken();
  return response;
}

function readCookie(name) {
  const prefix = `${name}=`;
  const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined;
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  if (csrfTokenRequest) return csrfTokenRequest;

  csrfTokenRequest = request('/admin/auth/csrf')
    .then(parseResponse)
    .then(() => {
      csrfToken = readCookie('XSRF-TOKEN');
      if (!csrfToken) {
        throw new Error('N\u00e3o foi poss\u00edvel preparar a prote\u00e7\u00e3o da sess\u00e3o. Atualize a p\u00e1gina e tente novamente.');
      }
      return csrfToken;
    });

  try {
    return await csrfTokenRequest;
  } finally {
    csrfTokenRequest = undefined;
  }
}

async function protectedRequest(path, options = {}) {
  const send = async () => {
    const headers = new Headers(options.headers);
    headers.set('X-XSRF-TOKEN', await getCsrfToken());
    return request(path, { ...options, headers });
  };

  let response = await send();
  if (response.status !== 403) return response;
  csrfToken = undefined;
  response = await send();
  return response;
}

export async function fetchProducts() {
  if (!productsRequest) {
    productsRequest = request('/products').then(parseResponse).finally(() => {
      productsRequest = undefined;
    });
  }
  return productsRequest;
}

export async function fetchHeroSettings() {
  const response = await request('/storefront/hero');
  return parseResponse(response);
}

export async function saveHeroSettings(settings) {
  const response = await adminRequest('/storefront/hero', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  return parseResponse(response);
}

export async function uploadHeroImage(file, altText = '') {
  const body = new FormData();
  body.append('file', file);
  if (altText.trim()) body.append('altText', altText.trim());

  const response = await adminRequest('/storefront/hero/images', {
    method: 'POST',
    body,
  });
  return parseResponse(response);
}

export async function deleteHeroImage(imageId) {
  const normalizedId = Number(imageId);
  if (!Number.isSafeInteger(normalizedId) || normalizedId < 1) {
    throw new Error('Imagem de destaque inválida.');
  }
  const response = await adminRequest(`/storefront/hero/images/${normalizedId}`, { method: 'DELETE' });
  return parseResponse(response);
}

export async function saveProduct(productData, imageFiles) {
  if (!Array.isArray(imageFiles) || imageFiles.length < 1 || imageFiles.length > 8) {
    throw new Error('Selecione de 1 a 8 fotos para cadastrar o tênis.');
  }

  const body = new FormData();
  body.append('product', new Blob([JSON.stringify(productData)], { type: 'application/json' }));
  imageFiles.forEach((file) => body.append('images', file, file.name));

  const response = await adminRequest('/products', {
    method: 'POST',
    body,
  });
  return parseResponse(response);
}

export async function updateProductStock(productId, stockQuantity) {
  const response = await adminRequest(`/products/${productId}/stock`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stockQuantity }),
  });
  return parseResponse(response);
}

export async function fetchAdminDashboard() {
  const response = await adminRequest('/admin/dashboard');
  return parseResponse(response);
}

export async function getAdminSession() {
  if (hasUsableAdminAccessToken()) {
    const response = await request('/admin/auth/session', { headers: adminHeaders() });
    if (response.ok && response.status !== 204) {
      const session = await parseResponse(response);
      if (storeAdminAccessToken(session)) return session;
    }
    clearAdminAccessToken();
  }
  return refreshAdminAccessTokenFromSession();
}

export async function loginAdmin(credentials) {
  clearAdminAccessToken();
  const response = await protectedRequest('/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const session = await parseResponse(response);
  if (!storeAdminAccessToken(session)) {
    throw new Error('O servidor n\u00e3o confirmou uma sess\u00e3o administrativa v\u00e1lida. Entre novamente.');
  }
  csrfToken = undefined;
  return session;
}

export async function logoutAdmin() {
  try {
    const response = await protectedRequest('/admin/auth/logout', {
      method: 'POST',
      headers: adminHeaders(),
    });
    return parseResponse(response);
  } finally {
    clearAdminAccessToken();
    csrfToken = undefined;
  }
}

export async function getCustomerSession() {
  const response = await request('/customer/auth/session');
  if (response.status === 204 || response.status === 401 || response.status === 403) return null;
  return parseResponse(response);
}

export async function registerCustomer(credentials) {
  const response = await protectedRequest('/customer/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  return parseResponse(response);
}

export async function loginCustomer(credentials) {
  const response = await protectedRequest('/customer/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  return parseResponse(response);
}

export async function logoutCustomer() {
  try {
    const response = await protectedRequest('/customer/auth/logout', { method: 'POST' });
    return parseResponse(response);
  } finally {
    csrfToken = undefined;
  }
}

export async function fetchCustomerAccount(options = {}) {
  const response = await request('/customer/account', { signal: options.signal });
  return parseResponse(response);
}

export async function saveCustomerProfile(profile) {
  const response = await protectedRequest('/customer/account/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  return parseResponse(response);
}

export async function createCustomerAddress(address) {
  const response = await protectedRequest('/customer/account/addresses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(address),
  });
  return parseResponse(response);
}

export async function updateCustomerAddress(addressId, address) {
  const normalizedId = Number(addressId);
  if (!Number.isSafeInteger(normalizedId) || normalizedId < 1) {
    throw new Error('Endereço inválido. Atualize a página e tente novamente.');
  }
  const response = await protectedRequest(`/customer/account/addresses/${normalizedId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(address),
  });
  return parseResponse(response);
}

export async function deleteCustomerAddress(addressId) {
  const normalizedId = Number(addressId);
  if (!Number.isSafeInteger(normalizedId) || normalizedId < 1) {
    throw new Error('Endereço inválido. Atualize a página e tente novamente.');
  }
  const response = await protectedRequest(`/customer/account/addresses/${normalizedId}`, {
    method: 'DELETE',
  });
  return parseResponse(response);
}

const KNOWN_PAYMENT_METHODS = new Set(['CARTAO_CREDITO', 'BOLETO', 'PIX']);

export async function fetchPaymentMethods(options = {}) {
  const response = await request('/payments/methods', { signal: options.signal });
  const body = await parseResponse(response);
  const methods = Array.isArray(body?.methods)
    ? [...new Set(body.methods
      .map((method) => String(method || '').trim().toUpperCase())
      .filter((method) => KNOWN_PAYMENT_METHODS.has(method)))]
    : [];

  if (methods.length === 0) {
    throw new Error('O servidor não informou uma forma de pagamento disponível.');
  }
  return methods;
}

export async function createPaymentCheckout(checkoutData, idempotencyKey) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey || '')) {
    throw new Error('Seu navegador não oferece os recursos de segurança necessários para iniciar o pagamento. Atualize-o e tente novamente.');
  }

  const response = await protectedRequest('/customer/payments/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(checkoutData),
  });
  const checkout = await parseResponse(response);
  if (!checkout?.orderId || typeof checkout.whatsappUrl !== 'string') {
    throw new Error('O servidor não retornou uma sessão de pedido válida. Tente novamente.');
  }

  let waUrl;
  try {
    waUrl = new URL(checkout.whatsappUrl);
  } catch {
    throw new Error('O servidor retornou um endereço de WhatsApp inválido. Tente novamente.');
  }
  if (waUrl.protocol !== 'https:' || waUrl.hostname !== 'wa.me') {
    throw new Error('A URL de redirecionamento não é um link válido do WhatsApp. Tente novamente.');
  }

  return { orderId: checkout.orderId, whatsappUrl: waUrl.toString() };
}

function normalizedSessionId(sessionId) {
  const value = String(sessionId ?? '').trim();
  if (!/^[A-Za-z0-9_-]{1,255}$/.test(value)) {
    throw new Error('Identificador da sessão de pagamento inválido.');
  }
  return value;
}

function normalizedOrderId(orderId) {
  const value = String(orderId ?? '').trim();
  if (!/^[1-9]\d{0,18}$/.test(value)) {
    throw new Error('Identificador do pedido inválido.');
  }
  return value;
}

export async function fetchPaymentStatusBySession(sessionId, options = {}) {
  const query = new URLSearchParams({ sessionId: normalizedSessionId(sessionId) });
  const response = await request(`/customer/payments/status?${query}`, { signal: options.signal });
  return parseResponse(response);
}

export async function fetchOrderPaymentStatus(orderId, options = {}) {
  const response = await request(`/customer/payments/orders/${normalizedOrderId(orderId)}/status`, { signal: options.signal });
  return parseResponse(response);
}

export async function cancelPaymentOrder(orderId) {
  const response = await protectedRequest(`/customer/payments/orders/${normalizedOrderId(orderId)}/cancel`, {
    method: 'POST',
  });
  return parseResponse(response);
}

export async function refundAdminOrder(orderId) {
  const response = await adminRequest(`/admin/orders/${normalizedOrderId(orderId)}/refund`, {
    method: 'POST',
  });
  return parseResponse(response);
}

/**
 * Manually confirms that a WhatsApp payment was received.
 * Requires a valid admin Bearer token stored in the session.
 */
export async function confirmWhatsappPayment(orderId) {
  const response = await adminRequest(`/admin/orders/${normalizedOrderId(orderId)}/confirm-whatsapp-payment`, {
    method: 'POST',
  });
  return parseResponse(response);
}

/**
 * Cancels a pending WhatsApp order and releases its reserved inventory.
 * Requires a valid admin Bearer token stored in the session.
 */
export async function cancelWhatsappOrder(orderId) {
  const response = await adminRequest(`/admin/orders/${normalizedOrderId(orderId)}/cancel-whatsapp-order`, {
    method: 'POST',
  });
  return parseResponse(response);
}
