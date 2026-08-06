const API_URL = '/api';
let csrfToken;
let csrfTokenRequest;
let productsRequest;

async function parseResponse(response) {
  if (!response.ok) {
    let message = `Erro na API (${response.status})`;
    try {
      const body = await response.json();
      message = body.message || message;
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
      credentials: 'same-origin',
    });
  } catch (error) {
    throw normalizeConnectionError(error);
  }
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  if (csrfTokenRequest) return csrfTokenRequest;

  csrfTokenRequest = request('/admin/auth/csrf')
    .then(parseResponse)
    .then((body) => {
      csrfToken = body.token;
      return csrfToken;
    });

  try {
    return await csrfTokenRequest;
  } finally {
    csrfTokenRequest = undefined;
  }
}

async function protectedRequest(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('X-XSRF-TOKEN', await getCsrfToken());
  return request(path, { ...options, headers });
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
  const response = await protectedRequest('/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData),
  });
  return parseResponse(response);
}

export async function getAdminSession() {
  const response = await request('/admin/auth/session');
  if (response.status === 401 || response.status === 403) return null;
  return parseResponse(response);
}

export async function loginAdmin(credentials) {
  const response = await protectedRequest('/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const session = await parseResponse(response);
  csrfToken = undefined;
  await getCsrfToken();
  return session;
}

export async function logoutAdmin() {
  const response = await protectedRequest('/admin/auth/logout', { method: 'POST' });
  csrfToken = undefined;
  return parseResponse(response);
}
