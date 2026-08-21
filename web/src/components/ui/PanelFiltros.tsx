'use client'

/**
 * Un solo botón para todos los filtros de una lista.
 *
 * Los filtros vivían en una tira que se arrastraba de lado y cortaba el último
 * por la mitad, y el buscador se quedaba sin ancho. Ahora van juntos detrás de
 * «Filtros», y el buscador ocupa el renglón entero (Hotman, 21-ago).
 *
 * En celular el panel sube desde abajo, que es donde alcanza el pulgar, y pasa
 * por encima de la barra de navegación —una hoja inferior nunca queda tapada
 * por ella—. En tablet y escritorio cuelga del botón, como el desplegable de
 * responsable de Entregables: el mismo contenido, en el sitio que corresponde
 * a cada pantalla.
 *
 * Se aplica al tocar, no al confirmar: el botón del pie solo cierra, así que
 * arrastrar la hoja hacia abajo no pierde nada.
 */

import { useEffect, useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PanelFiltros({ activos, onLimpiar, children, pie }: {
  /** Cuántos filtros hay puestos. Cero deja el botón apagado. */
  activos: number
  onLimpiar?: () => void
  children: React.ReactNode
  /** Texto del botón que cierra, normalmente con el conteo del resultado. */
  pie?: React.ReactNode
}) {
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    if (!abierto) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [abierto])

  const cerrar = () => setAbierto(false)

  const cuerpo = (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[15px] font-bold tracking-tight text-on-surface md:text-[15.5px]">Filtros</p>
        {activos > 0 && onLimpiar && (
          <button
            onClick={onLimpiar}
            className="cursor-pointer text-[12.5px] font-semibold text-primary hover:underline"
          >
            Limpiar
          </button>
        )}
      </div>
      <div className="space-y-4">{children}</div>
      {pie && (
        <button
          onClick={cerrar}
          className="mt-5 flex h-11 w-full cursor-pointer items-center justify-center rounded-2xl bg-primary text-[14px] font-bold text-on-primary transition-all hover:bg-primary/90 active:scale-[0.99] md:mt-4 md:h-10 md:rounded-xl md:text-[13.5px]"
        >
          {pie}
        </button>
      )}
    </>
  )

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        aria-expanded={abierto}
        className={cn(
          'flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border px-4 text-[13.5px] font-semibold transition-colors',
          activos > 0
            ? 'border-primary bg-primary text-on-primary shadow-[0_4px_14px_-4px_rgba(32,148,255,0.75)]'
            : 'border-outline-variant bg-surface-lowest text-on-surface-variant hover:border-outline hover:text-on-surface',
        )}
      >
        <SlidersHorizontal className="w-4 h-4" />
        {/* El número basta para saber que la lista está recortada; el detalle
            está a un toque. Con el botón apagado se lee la palabra. */}
        {activos > 0
          ? <span className="grid h-[19px] min-w-[19px] place-items-center rounded-full bg-white/25 px-1.5 text-[11px] font-bold tabular-nums">{activos}</span>
          : 'Filtros'}
      </button>

      {abierto && (
        <>
          {/* Cierra al tocar fuera. Oscurece solo en celular, donde el panel
              ocupa media pantalla. */}
          <div
            onClick={cerrar}
            className="fixed inset-0 z-40 max-md:bg-black/55 max-md:backdrop-blur-[2px]"
          />

          {/* Tablet y escritorio */}
          <div className="absolute right-0 top-[calc(100%+9px)] z-50 hidden w-[330px] rounded-2xl border border-outline-variant bg-surface-lowest p-4 shadow-[0_22px_50px_-20px_rgba(0,29,61,0.42)] animate-slide-up md:block">
            {cuerpo}
          </div>

          {/* Celular */}
          <div
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-surface-lowest px-5 pt-2.5 shadow-[0_-12px_40px_-12px_rgba(0,29,61,0.4)] animate-slide-up md:hidden"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
          >
            <span aria-hidden className="mx-auto mb-3.5 block h-1 w-9 rounded-full bg-outline-variant" />
            <button
              onClick={cerrar}
              aria-label="Cerrar"
              className="absolute right-4 top-4 grid w-8 h-8 cursor-pointer place-items-center rounded-full bg-surface-high text-on-surface-variant"
            >
              <X className="w-4 h-4" />
            </button>
            {cuerpo}
          </div>
        </>
      )}
    </div>
  )
}

/** Un filtro de opciones excluyentes, en pastillas. */
export function GrupoSegmentado<T extends string>({ titulo, valor, onCambio, opciones }: {
  titulo: string
  valor: T
  onCambio: (v: T) => void
  opciones: { val: T; label: string }[]
}) {
  return (
    <div>
      <span className="mb-2 block text-[11.5px] font-semibold text-on-surface-variant">{titulo}</span>
      <div className="grid gap-1 rounded-2xl bg-surface-low p-1" style={{ gridTemplateColumns: `repeat(${opciones.length},1fr)` }}>
        {opciones.map(o => (
          <button
            key={o.val}
            onClick={() => onCambio(o.val)}
            aria-pressed={valor === o.val}
            className={cn(
              'grid h-9 cursor-pointer place-items-center rounded-xl text-[13px] font-semibold transition-colors',
              valor === o.val
                ? 'bg-surface-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Un filtro de sí o no, con su explicación: una pastilla no dice si está puesta. */
export function Interruptor({ titulo, detalle, activo, onCambio }: {
  titulo: string
  detalle: string
  activo: boolean
  onCambio: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={() => onCambio(!activo)}
      className={cn(
        'flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3 text-left transition-colors',
        activo
          ? 'border-primary/45 bg-primary/[0.07]'
          : 'border-outline-variant hover:border-outline',
      )}
    >
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-on-surface">{titulo}</span>
        <span className="mt-0.5 block text-[11.5px] text-on-surface-variant">{detalle}</span>
      </span>
      <span className={cn(
        'relative h-[27px] w-[46px] flex-shrink-0 rounded-full transition-colors',
        activo ? 'bg-primary' : 'bg-surface-highest',
      )}>
        <span className={cn(
          'absolute top-[3px] h-[21px] w-[21px] rounded-full bg-white shadow transition-[left]',
          activo ? 'left-[22px]' : 'left-[3px]',
        )} />
      </span>
    </button>
  )
}
