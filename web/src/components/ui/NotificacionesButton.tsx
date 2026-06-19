'use client'

import { Bell, BellRing, BellOff, Loader2 } from 'lucide-react'
import { usePushNotificaciones } from '@/hooks/usePushNotificaciones'

/**
 * Botón ícono para activar notificaciones push.
 * Igual de compacto que ThemeToggle/RefreshButton. iOS requiere que el permiso
 * se pida desde un gesto, por eso es un botón (no automático).
 */
export function NotificacionesButton() {
  const { estado, activar } = usePushNotificaciones()

  if (estado === 'no-soportado') return null

  const base = 'w-9 h-9 rounded-xl flex items-center justify-center transition-colors'

  if (estado === 'activo') {
    return (
      <span title="Notificaciones activas"
        className={`${base} bg-emerald-500/12 text-emerald-600 dark:text-emerald-400`}>
        <BellRing className="w-4 h-4" />
      </span>
    )
  }

  if (estado === 'activando') {
    return (
      <span title="Activando notificaciones…"
        className={`${base} bg-surface-high text-on-surface-variant`}>
        <Loader2 className="w-4 h-4 animate-spin" />
      </span>
    )
  }

  if (estado === 'denegado') {
    return (
      <span title="Notificaciones bloqueadas — actívalas en los ajustes del navegador/dispositivo"
        className={`${base} bg-red-500/10 text-red-600 dark:text-red-400`}>
        <BellOff className="w-4 h-4" />
      </span>
    )
  }

  return (
    <button
      onClick={activar}
      title="Activar notificaciones"
      aria-label="Activar notificaciones"
      className={`${base} bg-surface-high text-on-surface-variant hover:text-on-surface hover:bg-surface-highest`}
    >
      <Bell className="w-4 h-4" />
    </button>
  )
}
