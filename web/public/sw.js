// Cache version — se actualiza con cada deploy de Vercel via query param
const CACHE_NAME = 'grupo500-v3'

self.addEventListener('install', () => {
  // Activar inmediatamente sin esperar a que cierren las pestañas
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Eliminar caches viejos
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  // No interceptar API, Clerk, ni navegación HTML — siempre frescos desde red
  const url = new URL(event.request.url)

  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/sign-in') ||
    url.pathname.startsWith('/sign-up') ||
    url.hostname !== self.location.hostname ||   // nunca interceptar dominios externos
    event.request.mode === 'navigate'            // páginas HTML siempre desde red
  ) return

  // Assets estáticos (_next/static): cache-first (tienen hash en el nombre)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Todo lo demás: network-first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})

// Escuchar mensaje de skipWaiting desde el cliente
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting()
})
