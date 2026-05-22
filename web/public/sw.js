// Service Worker — Grupo 500 PWA
// Estrategia: Network-first para páginas/API, Cache-first para assets estáticos

const CACHE_NAME = 'grupo500-v1'
const STATIC_CACHE = 'grupo500-static-v1'

// Assets estáticos que cacheamos siempre
const PRECACHE_ASSETS = [
  '/favicon.ico',
  '/favicon-192x192.png',
  '/favicon-512x512.png',
  '/apple-touch-icon.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/manifest.webmanifest',
]

// ── Install: precachear assets estáticos ─────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS))
  )
  self.skipWaiting()
})

// ── Activate: limpiar caches viejos ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch: estrategia según tipo de recurso ───────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // No interceptar: peticiones a la API, autenticación, o cross-origin no conocido
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.origin !== self.location.origin
  ) {
    return // dejar pasar sin interceptar
  }

  // Assets estáticos (imágenes, fuentes, iconos): Cache-first
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?|ttf)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Navegación (páginas HTML): Network-first con fallback offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/'))
      )
    )
    return
  }
})

// ── Mensajes desde el cliente (skipWaiting bajo demanda) ─────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting()
  }
})
