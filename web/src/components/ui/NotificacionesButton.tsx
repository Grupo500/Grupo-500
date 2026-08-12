'use client'

import { Bell, BellRing, BellOff, Loader2 } from 'lucide-react'
import { usePushNotificaciones } from '@/hooks/usePushNotificaciones'
import { cn } from '@/lib/utils'

/**
 * Botón ícono para activar notificaciones push.
 * Igual de compacto que ThemeToggle/RefreshButton. iOS requiere que el permiso
 * se pida desde un gesto, por eso es un botón (no automático).
 *
 * `className` deja repintarlo para el header, que va sobre fondo oscuro fijo y
 * no sigue el tema de la app. Se fusiona con tailwind-merge, así que lo que
 * llegue de afuera reemplaza el color de fondo en vez de apilarse con él.
 */
export function NotificacionesButton({ className }: { className?: string }) {
  const { estado, activar } = usePushNotificaciones()

  if (estado === 'no-soportado') return null

  const base = 'w-9 h-9 rounded-xl flex items-center justify-center transition-colors'

  if (estado === 'activo') {
    return (
      <span title="Notificaciones activas"
        className={cn(base, 'bg-surface-high text-emerald-600 dark:text-emerald-400', className)}>
        <BellRing className="w-4 h-4" />
      </span>
    )
  }

  if (estado === 'activando') {
    return (
      <span title="Activando notificaciones…"
        className={cn(base, 'bg-surface-high text-on-surface-variant', className)}>
        <Loader2 className="w-4 h-4 animate-spin" />
      </span>
    )
  }

  if (estado === 'denegado') {
    return (
      <span title="Notificaciones bloqueadas — actívalas en los ajustes del navegador/dispositivo"
        className={cn(base, 'bg-surface-high text-red-600 dark:text-red-400', className)}>
        <BellOff className="w-4 h-4" />
      </span>
    )
  }

  return (
    <button
      onClick={activar}
      title="Activar notificaciones"
      aria-label="Activar notificaciones"
      className={cn(base, 'bg-surface-high text-on-surface-variant hover:text-on-surface hover:bg-surface-highest', className)}
    >
      <Bell className="w-4 h-4" />
    </button>
  )
}
