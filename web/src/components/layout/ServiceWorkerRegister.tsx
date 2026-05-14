'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').then((reg) => {

      // Cuando el SW nuevo está listo para activarse, recargar la página
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          // SW nuevo instalado y esperando — forzar activación y recargar
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage('skipWaiting')
          }
        })
      })

      // Cuando el controller cambia (nuevo SW activo), recargar todas las pestañas
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload()
      })

      // Verificar actualizaciones cada 5 minutos
      setInterval(() => reg.update(), 5 * 60 * 1000)

    }).catch((err) => console.error('SW registration failed:', err))
  }, [])

  return null
}
