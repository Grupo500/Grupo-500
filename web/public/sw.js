// Service Worker — Grupo 500
// Por ahora solo se registra; sin caché ni intercepción de fetch.
// Cuando se implemente PWA completa, este archivo se reemplaza.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// No interceptamos fetch — dejamos que todo pase normalmente a la red
