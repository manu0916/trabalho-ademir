const DEFAULT_API_ORIGIN = 'https://trabalho-ademir-z2dy.onrender.com'
const PRIVATE_ADMIN_PATH = '/gestao-kicks'
const LEGACY_ADMIN_PATH = '/admin'
const SPA_SHELL_HTML = null
const PUBLIC_READ_TIMEOUT_MS = 12_000
const AUTH_TIMEOUT_MS = 45_000
const WRITE_TIMEOUT_MS = 75_000
const STALE_CACHE_SECONDS = 24 * 60 * 60
const TRANSIENT_UPSTREAM_STATUSES = new Set([502, 503, 504, 520, 521, 522, 523, 524, 525, 526])
const PUBLIC_API_FALLBACKS = new Map([
  ['/api/products', []],
  ['/api/storefront/hero', { mode: 'PRODUCTS', intervalSeconds: 6, manualImages: [] }],
])

function createContentSecurityPolicy() {
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16))
  const nonce = btoa(String.fromCharCode(...nonceBytes))

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' https: data: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://viacep.com.br data: blob:",
    "upgrade-insecure-requests",
  ].join('; ')
}

function resolveApiOrigin(value) {
  const origin = new URL(value || DEFAULT_API_ORIGIN)
  const isLocal = origin.hostname === 'localhost' || origin.hostname === '127.0.0.1'

  if (origin.protocol !== 'https:' && !(isLocal && origin.protocol === 'http:')) {
    throw new Error('API_ORIGIN precisa usar HTTPS.')
  }

  origin.pathname = '/'
  origin.search = ''
  origin.hash = ''
  return origin
}

function withSecurityHeaders(response, pathname) {
  const headers = new Headers(response.headers)
  headers.set('Content-Security-Policy', createContentSecurityPolicy())
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('X-Content-Type-Options', 'nosniff')

  if (pathname === PRIVATE_ADMIN_PATH || pathname === LEGACY_ADMIN_PATH) {
    headers.set('Cache-Control', 'private, no-store')
    headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function emptyFooterFallback() {
  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function emptySessionFallback() {
  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Kicks-Upstream': 'session-unavailable',
    },
  })
}

function unavailableApiResponse() {
  return Response.json(
    { message: 'O servidor da loja está iniciando. Aguarde alguns segundos e tente novamente.' },
    {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': '10',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  )
}

function requestTimeout(request, pathname, isFooterRead) {
  if (isFooterRead) return 8_000
  if (/\/auth\/(?:login|register|csrf)$/.test(pathname)) return AUTH_TIMEOUT_MS
  if (request.method === 'GET' || request.method === 'HEAD') return PUBLIC_READ_TIMEOUT_MS
  return WRITE_TIMEOUT_MS
}

function combinedSignal(requestSignal, timeoutMs) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  if (!requestSignal) return timeoutSignal
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([requestSignal, timeoutSignal])
  return timeoutSignal
}

function isSessionRead(request, pathname) {
  return request.method === 'GET'
    && (pathname === '/api/admin/auth/session' || pathname === '/api/customer/auth/session')
}

function isPublicFallbackRead(request, pathname) {
  return request.method === 'GET' && PUBLIC_API_FALLBACKS.has(pathname)
}

function staleCacheKey(incomingUrl) {
  const cacheUrl = new URL('/__kicks_upstream_cache', incomingUrl.origin)
  cacheUrl.searchParams.set('resource', `${incomingUrl.pathname}${incomingUrl.search}`)
  return new Request(cacheUrl, { method: 'GET' })
}

async function readStalePublicResponse(incomingUrl) {
  const cache = globalThis.caches?.default
  if (!cache) return null
  const cached = await cache.match(staleCacheKey(incomingUrl))
  if (!cached) return null

  const headers = new Headers(cached.headers)
  headers.set('Cache-Control', 'no-store')
  headers.set('X-Kicks-Upstream', 'stale-cache')
  return new Response(cached.body, { status: cached.status, headers })
}

async function storeStalePublicResponse(incomingUrl, response) {
  const cache = globalThis.caches?.default
  if (!cache || !response.ok) return

  const headers = new Headers(response.headers)
  headers.delete('set-cookie')
  headers.set('Cache-Control', `public, max-age=${STALE_CACHE_SECONDS}`)
  await cache.put(staleCacheKey(incomingUrl), new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  }))
}

async function deleteStalePublicResponse(incomingUrl) {
  const cache = globalThis.caches?.default
  if (!cache) return
  const productsUrl = new URL('/api/products', incomingUrl.origin)
  await cache.delete(staleCacheKey(productsUrl))
}

function publicJsonFallback(pathname) {
  return Response.json(PUBLIC_API_FALLBACKS.get(pathname), {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Kicks-Upstream': 'safe-default',
    },
  })
}

async function warmPublicResource(upstreamUrl, incomingUrl) {
  try {
    const response = await fetch(upstreamUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(70_000),
    })
    if (response.ok) await storeStalePublicResponse(incomingUrl, response)
  } catch {
    // The next browser request will retry normally.
  }
}

function scheduleWarmup(context, upstreamUrl, incomingUrl) {
  if (typeof context?.waitUntil === 'function') {
    context.waitUntil(warmPublicResource(upstreamUrl, incomingUrl))
  }
}

async function publicReadFallback(context, upstreamUrl, incomingUrl) {
  const cached = await readStalePublicResponse(incomingUrl)
  scheduleWarmup(context, upstreamUrl, incomingUrl)
  return cached || publicJsonFallback(incomingUrl.pathname)
}

async function proxyApi(request, env, context) {
  let apiOrigin

  try {
    apiOrigin = resolveApiOrigin(env.API_ORIGIN)
  } catch {
    return Response.json(
      { message: 'A integração da loja está temporariamente indisponível.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const incomingUrl = new URL(request.url)
  const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, apiOrigin)
  const headers = new Headers(request.headers)
  const isFooterRead = request.method === 'GET'
    && incomingUrl.pathname === '/api/storefront/footer'
  const isFallbackRead = isPublicFallbackRead(request, incomingUrl.pathname)
  const isAnonymousSessionRead = isSessionRead(request, incomingUrl.pathname)
    && !request.headers.has('Authorization')

  for (const header of ['host', 'origin', 'referer', 'content-length', 'connection']) {
    headers.delete(header)
  }

  headers.set('X-Forwarded-Host', incomingUrl.host)
  headers.set('X-Forwarded-Proto', 'https')

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? null : request.body,
      redirect: 'manual',
      signal: combinedSignal(request.signal, requestTimeout(request, incomingUrl.pathname, isFooterRead)),
    })

    if (isFooterRead && [401, 403, 404].includes(upstreamResponse.status)) {
      return emptyFooterFallback()
    }

    if (TRANSIENT_UPSTREAM_STATUSES.has(upstreamResponse.status)) {
      if (isFooterRead) return emptyFooterFallback()
      if (isAnonymousSessionRead) return emptySessionFallback()
      if (isFallbackRead) return publicReadFallback(context, upstreamUrl, incomingUrl)
      return unavailableApiResponse()
    }

    if (request.method === 'DELETE' && incomingUrl.pathname === '/api/products' && upstreamResponse.ok) {
      await deleteStalePublicResponse(incomingUrl)
    }

    if (isFallbackRead && upstreamResponse.ok) {
      const cacheResponse = upstreamResponse.clone()
      if (typeof context?.waitUntil === 'function') {
        context.waitUntil(storeStalePublicResponse(incomingUrl, cacheResponse))
      } else {
        await storeStalePublicResponse(incomingUrl, cacheResponse)
      }
    }

    const responseHeaders = new Headers(upstreamResponse.headers)

    for (const header of [
      'access-control-allow-credentials',
      'access-control-allow-origin',
      'access-control-expose-headers',
    ]) {
      responseHeaders.delete(header)
    }

    responseHeaders.set('X-Content-Type-Options', 'nosniff')
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    })
  } catch {
    if (isFooterRead) return emptyFooterFallback()
    if (isAnonymousSessionRead) return emptySessionFallback()
    if (isFallbackRead) return publicReadFallback(context, upstreamUrl, incomingUrl)
    return unavailableApiResponse()
  }
}

async function serveStorefront(request, env) {
  const url = new URL(request.url)
  const isDocumentRequest = request.method === 'GET'
    && (url.pathname === '/' || request.headers.get('accept')?.includes('text/html'))

  if (isDocumentRequest) {
    if (typeof SPA_SHELL_HTML !== 'string') {
      return new Response('A loja está temporariamente indisponível.', { status: 503 })
    }

    const response = new Response(SPA_SHELL_HTML, {
      status: url.pathname === LEGACY_ADMIN_PATH ? 404 : 200,
      headers: {
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
    return withSecurityHeaders(response, url.pathname)
  }

  return withSecurityHeaders(await env.ASSETS.fetch(request), url.pathname)
}

export default {
  async fetch(request, env, context) {
    const pathname = new URL(request.url).pathname

    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return proxyApi(request, env, context)
    }

    return serveStorefront(request, env)
  },
}
