'use client'

/**
 * Filtrar por quién tiene el trabajo.
 *
 * La lista trae solo a quien tiene tareas en el período —no a las once
 * personas del área— y cada nombre viene con su cifra: se elige sabiendo qué
 * se va a encontrar, en vez de a ciegas (Hotman, 20-ago).
 *
 * Es de uno en uno. Varios a la vez obligaría a un botón de "Aplicar" y a
 * decidir qué pasa al cerrar sin aplicarlo; con cuatro personas activas no
 * compensa.
 */

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, User, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AvatarMiembro } from './AvatarMiembro'

export interface OpcionResponsable {
  id: string
  nombre: string
  foto: string | null
  total: number
  pendientes: number
}

/** "6 pendientes · 4 publicadas", y solo lo que aplique. */
function desglose(o: OpcionResponsable) {
  const publicadas = o.total - o.pendientes
  const partes = [
    o.pendientes > 0 ? `${o.pendientes} pendiente${o.pendientes !== 1 ? 's' : ''}` : null,
    publicadas > 0 ? `${publicadas} publicada${publicadas !== 1 ? 's' : ''}` : null,
  ].filter(Boolean)
  return partes.join(' · ')
}

export function FiltroResponsable({ valor, onCambio, opciones, total }: {
  /** Id del miembro, '__sin__' para las que nadie tomó, '' para todo el equipo. */
  valor: string
  onCambio: (v: string) => void
  opciones: OpcionResponsable[]
  total: number
}) {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    window.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fuera)
      window.removeEventListener('keydown', esc)
    }
  }, [abierto])

  const elegido = opciones.find(o => o.id === valor)

  const elegir = (id: string) => { onCambio(id === valor ? '' : id); setAbierto(false) }

  return (
    <div ref={caja} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        aria-expanded={abierto}
        className={cn(
          'flex h-[38px] cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border px-3.5 text-[13px] font-medium transition-colors',
          elegido
            ? 'border-primary/45 bg-primary-container text-on-surface'
            : 'border-outline-variant bg-surface-lowest text-on-surface hover:border-outline',
          abierto && 'border-primary',
        )}
      >
        {elegido && elegido.id !== '__sin__'
          ? <AvatarMiembro id={elegido.id} nombre={elegido.nombre} image={elegido.foto} size={20} />
          : <User className={cn('size-3.5', elegido ? 'text-primary' : 'text-on-surface-variant')} />}
        <span className="max-w-[140px] truncate">{elegido ? elegido.nombre : 'Responsable'}</span>
        <ChevronDown className={cn('size-3.5 shrink-0 text-on-surface-variant transition-transform', abierto && 'rotate-180')} />
      </button>

      {abierto && (
        <div className="absolute left-0 top-11 z-[70] w-[284px] overflow-hidden rounded-2xl border border-outline-variant bg-surface-lowest py-1.5 shadow-2xl animate-slide-up">
          <Fila
            seleccionada={valor === ''}
            onClick={() => elegir('')}
            avatar={
              <span className="grid size-[26px] place-items-center rounded-full bg-surface-high text-on-surface-variant">
                <Users className="size-3.5" />
              </span>
            }
            nombre="Todo el equipo"
            n={total}
          />

          <div className="my-1.5 h-px bg-outline-variant" />

          {opciones.map(o => (
            <Fila
              key={o.id}
              seleccionada={valor === o.id}
              onClick={() => elegir(o.id)}
              avatar={
                o.id === '__sin__'
                  ? <span className="grid size-[26px] place-items-center rounded-full border border-dashed border-outline text-[11px] font-bold text-on-surface-variant">?</span>
                  : <AvatarMiembro id={o.id} nombre={o.nombre} image={o.foto} size={26} />
              }
              nombre={o.nombre}
              detalle={desglose(o)}
              n={o.total}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Una fila del desplegable.
 *
 * Rejilla fija y no `flex`: la fila de "Todo el equipo" no tiene foto de
 * persona y con flex su nombre arrancaba 36px a la izquierda de los demás. El
 * visto va al final —reservarle sitio a la izquierda dejaba un canal vacío
 * delante de cada avatar en todas las filas menos la elegida.
 */
function Fila({ seleccionada, onClick, avatar, nombre, detalle, n }: {
  seleccionada: boolean
  onClick: () => void
  avatar: React.ReactNode
  nombre: string
  detalle?: string
  n: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-selected={seleccionada}
      className={cn(
        'grid w-full cursor-pointer grid-cols-[26px_1fr_auto_14px] items-center gap-2.5 px-3.5 py-1.5 text-left transition-colors',
        seleccionada ? 'bg-primary/[0.08]' : 'hover:bg-surface-low',
      )}
    >
      {avatar}
      <span className="min-w-0">
        <span className={cn('block truncate text-[13px] text-on-surface', seleccionada ? 'font-semibold' : 'font-medium')}>
          {nombre}
        </span>
        {detalle && (
          <span className="mt-px block truncate text-[10.5px] text-on-surface-variant opacity-70">{detalle}</span>
        )}
      </span>
      <span className={cn(
        'text-[12.5px] font-semibold tabular-nums',
        seleccionada ? 'text-on-surface' : 'text-on-surface-variant',
      )}>
        {n}
      </span>
      <Check className={cn('size-3.5 text-primary transition-opacity', seleccionada ? 'opacity-100' : 'opacity-0')} />
    </button>
  )
}
