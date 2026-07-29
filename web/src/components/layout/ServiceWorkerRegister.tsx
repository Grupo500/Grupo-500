'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Si ya había un service worker controlando la página, un cambio de
    // controlador significa que se activó una versión nueva y conviene
    // recargar. En la primera visita no: ahí el cambio es la instalación
    // inicial y recargar solo hace parpadear la página sin motivo.
    const habiaControlador = Boolean(navigator.serviceWorker.controller)

    const alCambiarControlador = () => {
      if (habiaControlador) window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', alCambiarControlador)

    let intervalo: ReturnType<typeof setInterval> | undefined

    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Un worker que quedó esperando de una carga anterior no vuelve a
      // disparar `updatefound`: hay que empujarlo o se queda ahí indefinidamente.
      if (reg.waiting) reg.waiting.postMessage('skipWaiting')

      reg.addEventListener('updatefound', () => {
        const nuevo = reg.installing
        if (!nuevo) return
        nuevo.addEventListener('statechange', () => {
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
            nuevo.postMessage('skipWaiting')
          }
        })
      })

      intervalo = setInterval(() => reg.update(), 5 * 60 * 1000)
    }).catch((err) => console.error('SW registration failed:', err))

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', alCambiarControlador)
      if (intervalo) clearInterval(intervalo)
    }
  }, [])

  return null
}
