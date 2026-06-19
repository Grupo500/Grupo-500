'use client'

import { useEffect } from 'react'
import { getClientToken } from '@/lib/api'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

/**
 * Pide permiso y suscribe el navegador a notificaciones push.
 * Activar solo cuando `activo` es true (ej: dashboard del asesor).
 */
export function usePushNotificaciones(activo: boolean) {
  useEffect(() => {
    if (!activo) return
    const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!VAPID) return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return
    if (Notification.permission === 'denied') return

    let cancelado = false

    ;(async () => {
      try {
        const permiso = Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission()
        if (permiso !== 'granted' || cancelado) return

        const reg = await navigator.serviceWorker.ready
        let sub = await reg.pushManager.getSubscription()
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID) as BufferSource,
          })
        }
        if (cancelado) return

        const token = await getClientToken()
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notificaciones/suscribir`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(sub),
        })
      } catch {
        /* permiso denegado o navegador sin soporte — silencioso */
      }
    })()

    return () => { cancelado = true }
  }, [activo])
}
