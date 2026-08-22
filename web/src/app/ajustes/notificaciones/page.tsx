'use client'

/**
 * Notificaciones: los avisos del navegador en este equipo. La bandeja de la
 * campana siempre está; esto es el refuerzo de escritorio, y el permiso lo
 * decide el navegador, así que aquí se muestra en qué va y cómo cambiarlo.
 */

import { BellRing, BellOff, Bell, Loader2, Check } from 'lucide-react'
import { usePushNotificaciones } from '@/hooks/usePushNotificaciones'
import { Tarjeta } from '@/components/ajustes/Tarjeta'

const AVISOS = [
  { color: 'var(--primary)', titulo: 'Te asignan un trabajo',  texto: 'Alguien te encarga una pieza en el Planificador.' },
  { color: '#dc2626',        titulo: 'Te piden cambios',       texto: 'Una corrección sobre algo que entregaste.' },
  { color: '#16a34a',        titulo: 'Un trabajo quedó hecho', texto: 'Algo que repartiste ya está terminado.' },
  { color: '#d97706',        titulo: 'Te aprobaron un cobro',  texto: 'Entra en la cuenta de cobro del sábado.' },
]

export default function NotificacionesPage() {
  const { estado, activar } = usePushNotificaciones()

  return (
    <>
      <Tarjeta
        titulo="En este equipo"
        descripcion="Los avisos del navegador, además de la campana dentro de la app."
        accion={
          estado === 'idle' ? (
            <button type="button" onClick={() => activar()} className="btn-primary"><Bell className="size-4" />Activar en este equipo</button>
          ) : estado === 'activando' ? (
            <span className="inline-flex h-9 items-center gap-2 text-[12.5px] text-on-surface-variant"><Loader2 className="size-4 animate-spin" />Activando…</span>
          ) : estado === 'activo' ? (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#dcfce7] px-3 text-[12px] font-semibold text-[#166534]"><Check className="size-3.5" />Activadas</span>
          ) : null
        }
      >
        {estado === 'no-soportado' && (
          <p className="flex items-center gap-2 text-[12.5px] text-on-surface-variant"><BellOff className="size-4" />Este navegador no permite avisos de escritorio. La campana de la app sigue funcionando igual.</p>
        )}
        {estado === 'denegado' && (
          <p className="flex items-start gap-2 text-[12.5px] text-on-surface-variant"><BellOff className="mt-0.5 size-4 shrink-0 text-[#dc2626]" /><span>Están <b className="font-semibold text-on-surface">bloqueadas en el navegador</b>. Para volver a permitirlas: en la barra de direcciones, toca el candado junto a la dirección de la app, busca "Notificaciones" y ponlas en "Permitir". Luego recarga.</span></p>
        )}
        {estado === 'activo' && (
          <p className="flex items-center gap-2 text-[12.5px] text-on-surface-variant"><BellRing className="size-4 text-[#16a34a]" />Te llega un aviso en este equipo aunque la app no esté abierta en primer plano.</p>
        )}
        {estado === 'idle' && (
          <p className="text-[12.5px] text-on-surface-variant">Todavía no las has activado aquí. Al activar, el navegador te pide permiso una sola vez.</p>
        )}
        {estado === 'activando' && (
          <p className="text-[12.5px] text-on-surface-variant">Responde al permiso que muestra el navegador.</p>
        )}
      </Tarjeta>

      <Tarjeta titulo="Qué te avisa la plataforma" descripcion="Todo lo que te afecta a ti. Llega a la campana y, si las activaste, también a este equipo.">
        <ul className="divide-y divide-outline-variant">
          {AVISOS.map(a => (
            <li key={a.titulo} className="flex items-center gap-3 py-2.5">
              <span className="size-[9px] shrink-0 rounded-full" style={{ background: a.color }} />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-on-surface">{a.titulo}</span>
                <span className="block text-[11.5px] text-on-surface-variant">{a.texto}</span>
              </span>
            </li>
          ))}
        </ul>
      </Tarjeta>
    </>
  )
}
