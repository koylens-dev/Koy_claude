/* Irie's Cuisine service worker.
 * - App shell + offline page precached.
 * - Hashed Next.js assets: cache-first (they never change).
 * - Menu photos: stale-while-revalidate (fast on 3G, refreshed in the background).
 * - Public pages (menu, catering): network-first with cached fallback.
 * - Never caches private pages (staff, admin, account, checkout, tracking) or API calls.
 */
const VERSION = 'v2'
const STATIC = `iries-static-${VERSION}`
const PAGES = `iries-pages-${VERSION}`
const IMAGES = `iries-images-${VERSION}`
const PRECACHE = ['/offline.html', '/brand/logo-on-light.png', '/icons/icon-192.png', '/icons/icon-512.png', '/manifest.webmanifest']
const PUBLIC_PAGE = /^\/($|menu\/|catering$|privacy$|terms$)/
const MAX_IMAGES = 80

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC, PAGES, IMAGES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i])
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Hashed build assets
  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(STATIC).then((c) => c.put(req, res.clone()))
            return res
          }),
      ),
    )
    return
  }

  // Optimised menu images
  if ((url.origin === self.location.origin && url.pathname.startsWith('/_next/image')) || url.pathname.startsWith('/storage/v1/object/public/menu/')) {
    event.respondWith(
      caches.open(IMAGES).then(async (cache) => {
        const hit = await cache.match(req)
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone()).then(() => trim(IMAGES, MAX_IMAGES))
            return res
          })
          .catch(() => hit)
        return hit || network
      }),
    )
    return
  }

  // Page navigations
  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    const cacheable = PUBLIC_PAGE.test(url.pathname)
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (cacheable && res.ok) caches.open(PAGES).then((c) => c.put(req, res.clone()))
          return res
        })
        .catch(async () => (cacheable && (await caches.match(req))) || caches.match('/offline.html')),
    )
  }
})
