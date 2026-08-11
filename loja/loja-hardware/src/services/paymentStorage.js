const CART_STORAGE_KEY = 'nexus-cart-v1';
const CHECKOUT_ATTEMPT_STORAGE_KEY = 'nexus-checkout-attempt-v2';
const CHECKOUT_ATTEMPT_TTL_MS = 24 * 60 * 60 * 1000;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readJson(storage, key) {
  try {
    return JSON.parse(storage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function normalizedOrderId(orderId) {
  const value = String(orderId ?? '').trim();
  return /^[1-9]\d{0,18}$/.test(value) ? value : null;
}

export function snapshotCartItems(items) {
  if (!Array.isArray(items)) return [];

  const quantities = new Map();
  items.forEach((item) => {
    const productId = String(item?.productId ?? item?.id ?? '').trim();
    const quantity = Number(item?.quantity);
    if (!/^[1-9]\d{0,18}$/.test(productId) || !Number.isInteger(quantity) || quantity <= 0) return;
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  });

  return [...quantities.entries()]
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort((left, right) => left.productId.localeCompare(right.productId, 'en', { numeric: true }));
}

function sameSnapshot(left, right) {
  return JSON.stringify(snapshotCartItems(left)) === JSON.stringify(snapshotCartItems(right));
}

function createIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  if (typeof globalThis.crypto?.getRandomValues !== 'function') return null;

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function removeCheckoutAttempt() {
  try {
    sessionStorage.removeItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
  } catch {
    // Nothing else is required when storage is unavailable.
  }
}

function storeCheckoutAttempt(attempt) {
  try {
    sessionStorage.setItem(CHECKOUT_ATTEMPT_STORAGE_KEY, JSON.stringify(attempt));
    return true;
  } catch {
    return false;
  }
}

export function readStoredCart() {
  const cart = readJson(localStorage, CART_STORAGE_KEY);
  if (!Array.isArray(cart)) return [];

  return cart.filter((item) => (
    item
    && (typeof item.id === 'number' || typeof item.id === 'string')
    && Number.isInteger(item.quantity)
    && item.quantity > 0
  ));
}

export function storeCart(cart) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // The in-memory cart remains available when storage is blocked or full.
  }
}

export function readPendingCheckout() {
  const attempt = readJson(sessionStorage, CHECKOUT_ATTEMPT_STORAGE_KEY);
  const startedAt = Number(attempt?.startedAt);
  const items = snapshotCartItems(attempt?.items);

  if (!UUID_V4_PATTERN.test(attempt?.idempotencyKey || '')
      || !Number.isFinite(startedAt)
      || Date.now() - startedAt > CHECKOUT_ATTEMPT_TTL_MS
      || startedAt > Date.now() + 60_000
      || items.length === 0) {
    if (attempt) removeCheckoutAttempt();
    return null;
  }

  const orderId = attempt.orderId == null ? null : normalizedOrderId(attempt.orderId);
  if (attempt.orderId != null && !orderId) {
    removeCheckoutAttempt();
    return null;
  }

  return {
    idempotencyKey: attempt.idempotencyKey,
    items,
    orderId,
    startedAt,
  };
}

export function beginCheckoutAttempt(items) {
  const snapshot = snapshotCartItems(items);
  if (snapshot.length === 0) throw new Error('Sua sacola está vazia ou contém itens inválidos.');

  const current = readPendingCheckout();
  if (current && sameSnapshot(current.items, snapshot)) return current;

  const idempotencyKey = createIdempotencyKey();
  if (!idempotencyKey) {
    throw new Error('Seu navegador não oferece os recursos necessários para iniciar um pagamento seguro.');
  }

  const attempt = { idempotencyKey, items: snapshot, orderId: null, startedAt: Date.now() };
  if (!storeCheckoutAttempt(attempt)) {
    throw new Error('Não foi possível guardar esta tentativa de pagamento. Libere o armazenamento da sessão e tente novamente.');
  }
  return attempt;
}

export function rememberPendingCheckout(orderId, items, idempotencyKey) {
  const normalizedId = normalizedOrderId(orderId);
  const current = readPendingCheckout();
  if (!normalizedId
      || !current
      || current.idempotencyKey !== idempotencyKey
      || !sameSnapshot(current.items, items)) return false;

  return storeCheckoutAttempt({ ...current, orderId: normalizedId });
}

export function discardCheckoutAttempt(idempotencyKey) {
  const current = readPendingCheckout();
  if (!current || current.idempotencyKey !== idempotencyKey) return false;
  removeCheckoutAttempt();
  return true;
}

export function forgetPendingCheckout(orderId) {
  const current = readPendingCheckout();
  const normalizedId = normalizedOrderId(orderId);
  if (!current || !normalizedId || current.orderId !== normalizedId) return false;
  removeCheckoutAttempt();
  return true;
}

export function pendingCheckoutMatchesOrder(orderId, pendingCheckout = readPendingCheckout()) {
  const normalizedId = normalizedOrderId(orderId);
  return Boolean(normalizedId && pendingCheckout?.orderId === normalizedId);
}

export function subtractPurchasedItems(cart, purchasedItems) {
  const purchasedQuantities = new Map(
    snapshotCartItems(purchasedItems).map((item) => [item.productId, item.quantity]),
  );

  return cart.flatMap((item) => {
    const purchasedQuantity = purchasedQuantities.get(String(item.id));
    if (!purchasedQuantity) return [item];
    const remainingQuantity = item.quantity - purchasedQuantity;
    return remainingQuantity > 0 ? [{ ...item, quantity: remainingQuantity }] : [];
  });
}
