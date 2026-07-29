// Service Worker — Grupo 500 PWA v4
// Solo guarda imágenes como respaldo sin conexión. NO cachea páginas ni JS.
//
// v4 corrige un error real: antes las imágenes se servían "cache-first" sin
// caducidad, así que un ícono que ya estuviera guardado no volvía a pedirse
// nunca. Al cambiar la mascota o las insignias de Brito, el usuario seguía
// viendo las viejas y solo un Ctrl+Shift+R (que salta el service worker) las
// actualizaba. Los archivos de /public conservan su URL cuando cambian de
// contenido, así que cache-first es justo la estrategia equivocada para ellos.

const STATIC_CACHE = 'grupo500-static-v4'

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

  // Imágenes: la red manda, el caché es solo el respaldo sin conexión.
  //
  // Vercel ya las sirve con `max-age=0, must-revalidate` y ETag, así que una
  // imagen sin cambios se resuelve con un 304 diminuto: no se gana casi nada
  // sirviéndola desde el caché, y sí se pierde la garantía de que esté al día.
  if (
    request.destination === 'image' ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp)$/)
  ) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copia = res.clone()   // clonar ANTES de devolver: el cuerpo se consume una sola vez
            caches.open(STATIC_CACHE).then((c) => c.put(request, copia))
          }
          return res
        })
        .catch(() => caches.match(request).then((cached) => cached ?? Response.error()))
    )
  }
})

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting()
})

// ── Notificaciones push ──────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) {}
  const title = data.title || 'Grupo 500'
  const options = {
    body: data.body || '',
    icon: '/favicon-192x192.png',
    badge: '/favicon-192x192.png',
    vibrate: [80, 40, 80],
    data: { url: data.url || '/dashboard' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(url); return c.focus() }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
