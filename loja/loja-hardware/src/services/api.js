const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
// Vercel forwards /api to the backend. Keeping production requests same-origin
// lets the browser safely read the non-HttpOnly XSRF cookie.
const API_URL = import.meta.env.PROD
  ? '/api'
  : configuredApiUrl
  ? `${configuredApiUrl.replace(/\/$/, '')}${configuredApiUrl.endsWith('/api') ? '' : '/api'}`
  : '/api';
let csrfToken;
let csrfTokenRequest;
let productsRequest;
let adminAccessToken;

async function parseResponse(response) {
  if (!response.ok) {
    let message = `Erro na API (${response.status})`;
    try {
      const body = await response.json();
      message = body.message || body.detail || message;
    } catch {
      // The API can return an empty response for some requests.
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
    return new Error('Falha de conexão: não foi possível alcançar o backend.');
  }
  return error;
}

async function request(path, options = {}) {
  try {
    return await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: 'include',
    });
  } catch (error) {
    throw normalizeConnectionError(error);
  }
}

async function adminRequest(path, options = {}) {
  if (!adminAccessToken) {
    const error = new Error('Sua sess\u00e3o administrativa expirou. Entre novamente para continuar.');
    error.status = 401;
    throw error;
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${adminAccessToken}`);
  return request(path, { ...options, headers });
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
        throw new Error('Não foi possível preparar a proteção de segurança da sessão. Atualize a página e tente novamente.');
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

  // A login, logout, or reverse-proxy cookie update can invalidate the token
  // between requests. Refresh it once before surfacing an access error.
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
  // Product writes require the current signed administrator token. They are
  // deliberately excluded from CSRF because Vercel's reverse proxy can rotate
  // the browser cookie independently of the proxied request.
  const response = await adminRequest('/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Vercel rewrites can alter the security context associated with headers.
    // The signed token is also sent in the JSON body and validated by the
    // product endpoint before any write is made.
    body: JSON.stringify({ ...productData, adminAccessToken }),
  });
  return parseResponse(response);
}

export async function updateProductStock(productId, stockQuantity) {
  const response = await adminRequest(`/products/${productId}/stock`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stockQuantity, adminAccessToken }),
  });
  return parseResponse(response);
}

export async function fetchAdminDashboard() {
  const response = await adminRequest('/admin/dashboard');
  return parseResponse(response);
}

export async function getAdminSession() {
  // This is intentionally a plain request: after a browser refresh the
  // short-lived token only held in memory no longer exists. The server checks
  // the existing session and returns a fresh token when it is still valid.
  const response = await request('/admin/auth/session');
  if (response.status === 401 || response.status === 403) {
    adminAccessToken = undefined;
    return null;
  }
  const session = await parseResponse(response);
  adminAccessToken = session.accessToken || undefined;
  return adminAccessToken ? session : null;
}

export async function loginAdmin(credentials) {
  adminAccessToken = undefined;
  const response = await protectedRequest('/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const session = await parseResponse(response);
  adminAccessToken = session.accessToken || undefined;
  csrfToken = undefined;
  await getCsrfToken();
  return session;
}

export async function logoutAdmin() {
  try {
    const response = await protectedRequest('/admin/auth/logout', {
      method: 'POST',
      headers: adminAccessToken ? { Authorization: `Bearer ${adminAccessToken}` } : undefined,
    });
    return parseResponse(response);
  } finally {
    adminAccessToken = undefined;
    csrfToken = undefined;
  }
}

export async function getCustomerSession() {
  const response = await request('/customer/auth/session');
  if (response.status === 401 || response.status === 403) return null;
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
