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

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
function desgloseEntregables(o: OpcionResponsable) {
  const publicadas = o.total - o.pendientes
  const partes = [
    o.pendientes > 0 ? `${o.pendientes} pendiente${o.pendientes !== 1 ? 's' : ''}` : null,
    publicadas > 0 ? `${publicadas} publicada${publicadas !== 1 ? 's' : ''}` : null,
  ].filter(Boolean)
  return partes.join(' · ')
}

export function FiltroResponsable({ valor, onCambio, opciones, total, desglose = desgloseEntregables }: {
  /** Id del miembro, '__sin__' para las que nadie tomó, '' para todo el equipo. */
  valor: string
  onCambio: (v: string) => void
  opciones: OpcionResponsable[]
  total: number
  /** La cifra bajo cada nombre. Por defecto habla de entregables
   *  ("pendientes · publicadas"); Cobros la redacta en su idioma. */
  desglose?: (o: OpcionResponsable) => string
}) {
  const [abierto, setAbierto] = useState(false)
  const caja  = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [montado, setMontado] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => setMontado(true), [])

  /**
   * El panel se dibuja en el `body` y no debajo del botón.
   *
   * La barra de filtros tiene scroll horizontal para que quepan los cinco
   * controles, y un panel posicionado dentro de ella lo recortaba: se abría
   * "dentro de la fila", asomando unos pocos píxeles y obligando a hacer
   * scroll para verlo (Hotman, 20-ago).
   */
  useLayoutEffect(() => {
    if (!abierto) return
    const medir = () => {
      const t = caja.current?.getBoundingClientRect()
      if (!t) return
      const margen = 12
      const ancho = 284
      // Si no cabe hacia la derecha, se alinea por el borde derecho del botón.
      const izq = Math.max(margen, Math.min(t.left, window.innerWidth - ancho - margen))
      setPos({ top: t.bottom + 8, left: izq })
    }
    medir()
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)
    return () => {
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
    }
  }, [abierto])

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node
      if (caja.current?.contains(t) || panel.current?.contains(t)) return
      setAbierto(false)
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

      {abierto && montado && pos && createPortal(
        <div
          ref={panel}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: 284 }}
          className="z-[9999] max-h-[min(60vh,420px)] overflow-y-auto rounded-2xl border border-outline-variant bg-surface-lowest py-1.5 shadow-2xl animate-slide-up"
        >
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
        </div>,
        document.body,
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
