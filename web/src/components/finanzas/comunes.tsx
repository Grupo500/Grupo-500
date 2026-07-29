'use client'

import { format, startOfMonth, endOfMonth } from 'date-fns'
import { useCountUp } from '@/hooks/useCountUp'
import { formatCOP } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'

/** Meses capitalizados: en la app nada va en mayúscula sostenida. */
export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function toISO(d: Date) { return format(d, 'yyyy-MM-dd') }

export function rangoDelMes(month: string | null): { desde: string; hasta: string } {
  const base = month ? new Date(month + '-15') : new Date()
  return { desde: toISO(startOfMonth(base)), hasta: toISO(endOfMonth(base)) }
}

/** "2026-07" → "Julio 2026" */
export function nombreMes(clave: string): string {
  const [anio, mes] = clave.split('-')
  return `${MESES[Number(mes) - 1]} ${anio}`
}

export function pct(v: number | null, decimales = 1): string {
  if (v === null || !Number.isFinite(v)) return '—'
  return `${(v * 100).toFixed(decimales).replace('.', ',')}%`
}

export function numero(v: number): string {
  return Math.round(v).toLocaleString('es-CO')
}

/**
 * Variación con flecha y color.
 *
 * `bajarEsBueno` invierte el color sin invertir la flecha: en el CAC bajar es
 * una buena noticia, pero la flecha debe seguir apuntando hacia donde se movió
 * el número o se vuelve ilegible.
 */
export function Variacion({ valor, bajarEsBueno = false, className }: {
  valor: number | null
  bajarEsBueno?: boolean
  className?: string
}) {
  if (valor === null) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-[11.5px] text-on-surface-variant', className)}>
        <Minus className="w-3 h-3" />
        Sin base de comparación
      </span>
    )
  }
  const sube = valor >= 0
  const bueno = bajarEsBueno ? !sube : sube
  const color = valor === 0 ? 'var(--on-surface-variant)' : bueno ? '#16a34a' : '#dc2626'
  const Icono = sube ? ArrowUp : ArrowDown
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11.5px] font-semibold tabular-nums', className)} style={{ color }}>
      <Icono className="w-3 h-3 shrink-0" />
      {pct(Math.abs(valor))}
    </span>
  )
}

/** Tarjeta de indicador con cifra animada, acumulado y variación. */
export function TarjetaKPI({
  etiqueta, valor, formato = 'moneda', acumulado, variacion, bajarEsBueno, nota, cargando,
}: {
  etiqueta: string
  valor: number
  formato?: 'moneda' | 'entero' | 'veces' | 'porcentaje'
  acumulado?: number
  variacion?: number | null
  bajarEsBueno?: boolean
  nota?: string
  cargando?: boolean
}) {
  const animado = useCountUp(cargando ? 0 : valor)

  const dar = (v: number) => {
    if (formato === 'moneda') return formatCOP(v)
    if (formato === 'entero') return numero(v)
    if (formato === 'veces') return `${(v).toFixed(2).replace('.', ',')}x`
    return pct(v)
  }

  if (cargando) {
    return (
      <div className="card p-4">
        <div className="h-3 w-24 rounded bg-surface-high animate-pulse mb-3" />
        <div className="h-7 w-32 rounded bg-surface-high animate-pulse mb-2" />
        <div className="h-3 w-28 rounded bg-surface-high animate-pulse" />
      </div>
    )
  }

  return (
    <div className="card p-4">
      <p className="text-[11.5px] font-medium text-on-surface-variant">{etiqueta}</p>
      <p className="text-[22px] sm:text-[24px] font-bold tabular-nums leading-tight text-on-surface mt-1">
        {/* El count-up solo tiene sentido en cifras que crecen desde cero */}
        {dar(formato === 'moneda' || formato === 'entero' ? animado : valor)}
      </p>
      <div className="flex items-center gap-2 flex-wrap mt-1.5">
        {variacion !== undefined && <Variacion valor={variacion} bajarEsBueno={bajarEsBueno} />}
        {acumulado !== undefined && (
          <span className="text-[11px] text-on-surface-variant tabular-nums">
            Acumulado {dar(acumulado)}
          </span>
        )}
      </div>
      {nota && <p className="text-[10.5px] text-on-surface-variant/80 mt-1">{nota}</p>}
    </div>
  )
}
