'use client'

import { useCallback, useEffect, useState } from 'react'
import { getClientToken } from '@/lib/api'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export type EstadoPush = 'idle' | 'no-soportado' | 'denegado' | 'activando' | 'activo'

/**
 * Notificaciones push del asesor.
 *
 * iOS NO permite pedir el permiso automáticamente: debe dispararse desde un
 * gesto del usuario. Por eso este hook NO pide permiso solo — expone `activar()`
 * para conectarlo a un botón. Funciona en iPhone, Android y PC por igual.
 */
export function usePushNotificaciones() {
  const [estado, setEstado] = useState<EstadoPush>('idle')

  // Detectar estado inicial (soporte / permiso ya concedido)
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setEstado('no-soportado')
      return
    }
    if (Notification.permission === 'denied') { setEstado('denegado'); return }
    if (Notification.permission === 'granted') {
      navigator.serviceWorker.ready
        .then(reg => reg.pushManager.getSubscription())
        .then(sub => { if (sub) setEstado('activo') })
        .catch(() => {})
    }
  }, [])

  const activar = useCallback(async () => {
    const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!VAPID) return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setEstado('no-soportado')
      return
    }

    try {
      setEstado('activando')
      const permiso = await Notification.requestPermission()
      if (permiso !== 'granted') {
        setEstado(permiso === 'denied' ? 'denegado' : 'idle')
        return
      }

      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID) as BufferSource,
        })
      }

      const token = await getClientToken()
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notificaciones/suscribir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(sub),
      })
      setEstado('activo')
    } catch {
      setEstado('idle')
    }
  }, [])

  return { estado, activar }
}
