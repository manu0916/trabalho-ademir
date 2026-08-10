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
    try {
      const body = await response.json();
      message = body.message || body.detail || message;
    } catch {
      // Some endpoints intentionally return an empty response.
    }
    const error = new Error(message);
    error.status = response.status;
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

export async function saveProduct(productData) {
  const response = await adminRequest('/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData),
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

export async function createOrder(orderData) {
  const response = await protectedRequest('/customer/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData),
  });
  return parseResponse(response);
}

export async function createPaymentCheckout(checkoutData) {
  const response = await protectedRequest('/customer/payments/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(checkoutData),
  });
  return parseResponse(response);
}
