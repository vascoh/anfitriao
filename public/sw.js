const CACHE = 'anfitriao-v2'

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

// ─── Web Push ─────────────────────────────────────────────────────────────────
self.addEventListener('push', e => {
  let data = {}
  try { data = e.data ? e.data.json() : {} } catch { data = { body: e.data?.text() } }
  const title = data.title || 'Anfitrião'
  e.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/api/pwa-icon?size=192',
      badge: '/api/pwa-icon?size=96',
      data: { url: data.url || '/hoje' },
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/hoje'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
