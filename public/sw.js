// public/sw.js
const VERSION = 'tt-v5-' + (self.registration?.scope || '') // bump when you deploy
const ASSET_CACHE = VERSION + ':assets'
const HTML_CACHE  = VERSION + ':html'

// Immediately take control on install
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(ASSET_CACHE))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)))
    await self.clients.claim()
  })())
})

// Network-first for HTML (prevents blank shell after deploy)
async function networkFirstHTML(request) {
  try {
    const res = await fetch(request, { cache: 'no-store' })
    const cache = await caches.open(HTML_CACHE)
    cache.put(request, res.clone())
    return res
  } catch (err) {
    const cache = await caches.open(HTML_CACHE)
    const cached = await cache.match(request)
    return cached || new Response('Offline', { status: 503, statusText: 'Offline' })
  }
}

// Cache-first for hashed assets (Vite bundles)
async function cacheFirstAsset(request) {
  const cache = await caches.open(ASSET_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const res = await fetch(request)
  if (res.ok) cache.put(request, res.clone())
  return res
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Only handle same-origin GET
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  const isHTML =
    req.destination === 'document' ||
    req.headers.get('accept')?.includes('text/html') ||
    url.pathname === '/' || url.pathname.endsWith('.html')

  const isAsset =
    /\.(js|css|ico|png|jpg|jpeg|gif|svg|webp|woff2?)$/i.test(url.pathname)

  if (isHTML) {
    event.respondWith(networkFirstHTML(req))
  } else if (isAsset) {
    event.respondWith(cacheFirstAsset(req))
  } // everything else (API) falls through to network
})
