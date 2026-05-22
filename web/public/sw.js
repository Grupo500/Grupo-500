// Service Worker — Grupo 500 PWA v2
// Solo cachea íconos/imágenes estáticas. NO cachea páginas ni JS de Next.js.

const STATIC_CACHE = 'grupo500-static-v2'

const PRECACHE_ASSETS = [
  '/favicon.ico',
  '/favicon-192x192.png',
  '/favicon-512x512.png',
  '/apple-touch-icon.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/manifest.webmanifest',
]

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS))
  )
  self.skipWaiting()
})

// ── Activate: eliminar TODOS los caches anteriores ───────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k !== STATIC_CACHE)
        .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// ── Fetch: solo íconos/imágenes van a cache, TODO LO DEMÁS va a la red ───────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Pasar todo a la red excepto imágenes/iconos propios
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/api/') ||
    request.mode === 'navigate'
  ) {
    return // red directa, sin caché
  }

  // Solo iconos e imágenes estáticas: cache-first
  if (
    request.destination === 'image' ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((res) => {
          if (res.ok) {
            caches.open(STATIC_CACHE).then((c) => c.put(request, res.clone()))
          }
          return res
        })
      })
    )
  }
})

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting()
})
