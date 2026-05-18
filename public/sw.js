const CACHE = 'anfitriao-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  // Skip cross-origin, API routes, and Supabase
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // Stale-while-revalidate for static assets (JS, CSS, fonts, images)
  const isAsset = ['script', 'style', 'font', 'image'].includes(e.request.destination)
  if (!isAsset) return

  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const fresh = fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone())
          return res
        })
        return cached ?? fresh
      })
    )
  )
})
