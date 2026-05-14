'use client'

import { TrendingUp, TrendingDown, Minus, Medal } from 'lucide-react'
import { formatCOP } from '@/lib/utils'
import { cn } from '@/lib/utils'

const asesores = [
  { nombre: 'Carlos Moreno',  iniciales: 'CM', ventas: 5200000, cobrado: 4800000, estudiantes: 32, eficiencia: 92 },
  { nombre: 'Laura Ríos',     iniciales: 'LR', ventas: 4100000, cobrado: 3600000, estudiantes: 27, eficiencia: 88 },
  { nombre: 'Andrés Ospina',  iniciales: 'AO', ventas: 3800000, cobrado: 3200000, estudiantes: 24, eficiencia: 84 },
  { nombre: 'Sofía Vargas',   iniciales: 'SV', ventas: 2900000, cobrado: 2400000, estudiantes: 19, eficiencia: 83 },
]

const medalColors = ['text-[#f59e0b]', 'text-[#94a3b8]', 'text-[#cd7f32]']

export function RankingAsesores() {
  return (
    <div className="card p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold text-on-surface">Ranking asesores</h3>
        <span className="text-[11px] text-on-surface-variant font-medium">Este mes</span>
      </div>

      <div className="space-y-1">
        {/* Header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-2 pb-2 border-b border-[var(--outline-variant)]">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Asesor</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant text-right w-24">Ventas</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant text-right w-20">Cobrado</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant text-right w-14">Efic.</span>
        </div>

        {asesores.map((a, i) => (
          <div
            key={a.nombre}
            className={cn(
              'grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-2 py-2.5 rounded-lg transition-colors',
              'hover:bg-[var(--surface-high)]',
              i === 0 && 'bg-[var(--primary-container)]/40',
            )}
          >
            {/* Avatar + nombre */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-[var(--primary-container)] flex items-center justify-center text-[11px] font-bold text-primary">
                  {a.iniciales}
                </div>
                {i < 3 && (
                  <Medal className={cn('absolute -top-1 -right-1 w-3.5 h-3.5', medalColors[i])} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-on-surface truncate">{a.nombre}</p>
                <p className="text-[11px] text-on-surface-variant">{a.estudiantes} estudiantes</p>
              </div>
            </div>

            {/* Ventas */}
            <span className="text-[13px] font-bold text-on-surface tabular text-right w-24">
              {formatCOP(a.ventas)}
            </span>

            {/* Cobrado */}
            <span className="text-[13px] font-medium text-on-surface-variant tabular text-right w-20">
              {formatCOP(a.cobrado)}
            </span>

            {/* Eficiencia */}
            <div className="flex items-center justify-end gap-1 w-14">
              {a.eficiencia >= 85
                ? <TrendingUp className="w-3 h-3 text-[#16a34a]" />
                : a.eficiencia >= 70
                  ? <Minus className="w-3 h-3 text-tertiary" />
                  : <TrendingDown className="w-3 h-3 text-[var(--error)]" />
              }
              <span className={cn(
                'text-[12px] font-bold tabular',
                a.eficiencia >= 85 ? 'text-[#16a34a]' : a.eficiencia >= 70 ? 'text-tertiary' : 'text-[var(--error)]',
              )}>
                {a.eficiencia}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
