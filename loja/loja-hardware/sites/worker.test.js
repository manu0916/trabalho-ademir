import assert from 'node:assert/strict'
import test from 'node:test'
import worker from './worker.js'

const API_ORIGIN = 'https://backend.example'
const originalFetch = globalThis.fetch
const originalCaches = globalThis.caches

function createMemoryCache() {
  const entries = new Map()
  return {
    async match(request) {
      return entries.get(request.url)?.clone() || null
    },
    async put(request, response) {
      entries.set(request.url, response.clone())
    },
    async delete(request) {
      return entries.delete(request.url)
    },
  }
}

function createContext() {
  const promises = []
  return {
    waitUntil(promise) {
      promises.push(Promise.resolve(promise))
    },
    async drain() {
      await Promise.all(promises)
    },
  }
}

function siteRequest(path, options) {
  return new Request(`https://store.example${path}`, options)
}

test.beforeEach(() => {
  globalThis.caches = { default: createMemoryCache() }
})

test.afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalCaches === undefined) delete globalThis.caches
  else globalThis.caches = originalCaches
})

test('replaces upstream 524 responses with safe public catalog defaults', async () => {
  globalThis.fetch = async () => new Response('upstream timeout', { status: 524 })

  const productContext = createContext()
  const products = await worker.fetch(siteRequest('/api/products'), { API_ORIGIN }, productContext)
  assert.equal(products.status, 200)
  assert.equal(products.headers.get('x-kicks-upstream'), 'safe-default')
  assert.deepEqual(await products.json(), [])
  await productContext.drain()

  const heroContext = createContext()
  const hero = await worker.fetch(siteRequest('/api/storefront/hero'), { API_ORIGIN }, heroContext)
  assert.equal(hero.status, 200)
  assert.deepEqual(await hero.json(), { mode: 'PRODUCTS', intervalSeconds: 6, manualImages: [] })
  await heroContext.drain()
})

test('treats an unavailable anonymous session as signed out instead of returning 524', async () => {
  globalThis.fetch = async () => { throw new DOMException('timed out', 'AbortError') }
  const response = await worker.fetch(
    siteRequest('/api/admin/auth/session'),
    { API_ORIGIN },
    createContext(),
  )

  assert.equal(response.status, 204)
  assert.equal(response.headers.get('x-kicks-upstream'), 'session-unavailable')
})

test('returns a retryable JSON error for protected requests when the backend is unavailable', async () => {
  globalThis.fetch = async () => { throw new DOMException('timed out', 'AbortError') }
  const response = await worker.fetch(
    siteRequest('/api/admin/dashboard', { headers: { Authorization: 'Bearer example' } }),
    { API_ORIGIN },
    createContext(),
  )

  assert.equal(response.status, 503)
  assert.equal(response.headers.get('retry-after'), '10')
  assert.match((await response.json()).message, /iniciando/i)
})

test('uses the last successful public response when a later upstream request fails', async () => {
  const cachedProducts = [{ id: 7, name: 'Tênis Solar' }]
  globalThis.fetch = async () => Response.json(cachedProducts)

  const firstContext = createContext()
  const first = await worker.fetch(siteRequest('/api/products'), { API_ORIGIN }, firstContext)
  assert.deepEqual(await first.json(), cachedProducts)
  await firstContext.drain()

  globalThis.fetch = async () => { throw new DOMException('timed out', 'AbortError') }
  const fallbackContext = createContext()
  const fallback = await worker.fetch(siteRequest('/api/products'), { API_ORIGIN }, fallbackContext)
  assert.equal(fallback.status, 200)
  assert.equal(fallback.headers.get('x-kicks-upstream'), 'stale-cache')
  assert.deepEqual(await fallback.json(), cachedProducts)
  await fallbackContext.drain()
})

test('forwards successful upstream API responses unchanged', async () => {
  globalThis.fetch = async () => Response.json({ ok: true }, { status: 200 })
  const response = await worker.fetch(
    siteRequest('/api/admin/dashboard', { headers: { Authorization: 'Bearer example' } }),
    { API_ORIGIN },
    createContext(),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true })
})

test('clears the stale catalog after a successful full deletion', async () => {
  globalThis.fetch = async () => Response.json([{ id: 7, name: 'Tênis Solar' }])
  const warmContext = createContext()
  await worker.fetch(siteRequest('/api/products'), { API_ORIGIN }, warmContext)
  await warmContext.drain()

  globalThis.fetch = async (_url, options) => {
    if (options?.method === 'DELETE') {
      return Response.json({ deletedProducts: 1 })
    }
    throw new DOMException('timed out', 'AbortError')
  }

  const deleted = await worker.fetch(siteRequest('/api/products', {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer example',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ confirmation: 'APAGAR CATALOGO' }),
  }), { API_ORIGIN }, createContext())
  assert.equal(deleted.status, 200)

  const fallbackContext = createContext()
  const products = await worker.fetch(siteRequest('/api/products'), { API_ORIGIN }, fallbackContext)
  assert.equal(products.headers.get('x-kicks-upstream'), 'safe-default')
  assert.deepEqual(await products.json(), [])
  await fallbackContext.drain()
})
