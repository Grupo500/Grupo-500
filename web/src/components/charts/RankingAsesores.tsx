'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { TrendingUp, TrendingDown, Minus, Medal, Loader2 } from 'lucide-react'
import { formatCOP } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { createClientFetcher } from '@/lib/api'

interface AsesorRanking {
  id: string
  nombre: string
  totalVentas: number
  cobrado: number
  cantidadPagos: number
  totalEstudiantes: number
  variacion: number
  ventasAnterior: number
}

const medalColors = ['text-[#f59e0b]', 'text-[#94a3b8]', 'text-[#cd7f32]']

function getIniciales(nombre: string) {
  return nombre.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() ?? '').join('')
}

function VariacionBadge({ v }: { v: number }) {
  if (v > 2) return (
    <div className="flex items-center gap-1">
      <TrendingUp className="w-3 h-3 text-[#16a34a]" />
      <span className="text-[12px] font-bold tabular text-[#16a34a]">+{v}%</span>
    </div>
  )
  if (v < -2) return (
    <div className="flex items-center gap-1">
      <TrendingDown className="w-3 h-3 text-[var(--error)]" />
      <span className="text-[12px] font-bold tabular text-[var(--error)]">{v}%</span>
    </div>
  )
  return (
    <div className="flex items-center gap-1">
      <Minus className="w-3 h-3 text-on-surface-variant" />
      <span className="text-[12px] font-bold tabular text-on-surface-variant">{v > 0 ? '+' : ''}{v}%</span>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="card p-5 animate-pulse space-y-3">
      <div className="h-4 w-40 bg-[var(--surface-high)] rounded" />
      {[0,1,2,3].map(i => (
        <div key={i} className="h-10 bg-[var(--surface-high)] rounded-lg" />
      ))}
    </div>
  )
}

export function RankingAsesores() {
  const { getToken } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['ranking-asesores'],
    queryFn: async () => {
      const token = await getToken()
      return createClientFetcher(token ?? '')('/reportes/asesores') as Promise<{ data: AsesorRanking[] }>
    },
    staleTime: 60_000,
  })

  if (isLoading) return <Skeleton />

  const asesores = data?.data ?? []

  return (
    <div className="card p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold text-on-surface">Ranking asesores</h3>
        <span className="text-[11px] text-on-surface-variant font-medium">Este mes vs anterior</span>
      </div>

      {asesores.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-sm text-on-surface-variant">
          Sin datos de asesores
        </div>
      ) : (
        <div className="space-y-1">
          {/* Header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-2 pb-2 border-b border-[var(--outline-variant)]">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Asesor</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant text-right w-24">Ventas</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant text-right w-20">Cobrado</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant text-right w-14">Var.</span>
          </div>

          {asesores.map((a, i) => (
            <div
              key={a.id}
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
                    {getIniciales(a.nombre)}
                  </div>
                  {i < 3 && (
                    <Medal className={cn('absolute -top-1 -right-1 w-3.5 h-3.5', medalColors[i])} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-on-surface truncate">{a.nombre}</p>
                  <p className="text-[11px] text-on-surface-variant">{a.totalEstudiantes} estudiantes</p>
                </div>
              </div>

              {/* Ventas */}
              <span className="text-[13px] font-bold text-on-surface tabular text-right w-24">
                {formatCOP(a.totalVentas)}
              </span>

              {/* Cobrado */}
              <span className="text-[13px] font-medium text-on-surface-variant tabular text-right w-20">
                {formatCOP(a.cobrado)}
              </span>

              {/* Variación vs mes anterior */}
              <div className="flex items-center justify-end w-14">
                <VariacionBadge v={a.variacion} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
