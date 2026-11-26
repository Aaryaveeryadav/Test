/* Sahayak service worker — low-bandwidth friendly, honest offline behaviour.
 *
 * Strategy:
 *  - Static assets (/_next/static, fonts, icons): cache-first, updated in the
 *    background (stale-while-revalidate).
 *  - Page navigations: network-first with a styled offline fallback page —
 *    live data always wins when the network is there.
 *  - /api/*: never cached. Tutor answers and data must come from the server.
 *  - POST requests: never intercepted.
 */
const VERSION = 'sahayak-v1'
const STATIC_CACHE = `${VERSION}-static`
const PAGE_CACHE = `${VERSION}-pages`
const OFFLINE_URL = '/offline.html'
const PRECACHE = [OFFLINE_URL, '/icon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return // live data only, never cached

  // Static assets: cache-first with background refresh.
  if (url.pathname.startsWith('/_next/static') || url.pathname === '/icon.svg') {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req)
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone())
            return res
          })
          .catch(() => hit)
        return hit ?? fetchPromise
      })
    )
    return
  }

  // Navigations: network-first, offline fallback page when unreachable.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(PAGE_CACHE).then((cache) => cache.put(req, res.clone()))
          return res.clone()
        })
        .catch(async () => {
          const cached = await caches.open(PAGE_CACHE).then((c) => c.match(req))
          return cached ?? caches.match(OFFLINE_URL)
        })
    )
  }
})
