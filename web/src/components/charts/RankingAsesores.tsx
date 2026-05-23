'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Asesor {
  id: string
  nombre: string
  totalVentas: number
  cantidadPagos: number
  totalEstudiantes: number
  variacion: number
}

export function RankingAsesores() {

  const { data, isLoading } = useQuery({
    queryKey: ['ranking-asesores'],
    queryFn: async () => {
            return apiFetch<{ data: Asesor[] }>('/reportes/asesores')
    },
    staleTime: 30_000,
  })

  const asesores = data?.data ?? []

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-on-surface">Ranking asesores</p>
        <span className="text-[11px] text-on-surface-variant">Mes actual</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="flex items-center gap-3 py-2">
              <div className="w-6 h-6 rounded-full bg-surface-high animate-pulse" />
              <div className="flex-1 h-3.5 rounded bg-surface-high animate-pulse" />
              <div className="w-20 h-3.5 rounded bg-surface-high animate-pulse" />
            </div>
          ))}
        </div>
      ) : asesores.length === 0 ? (
        <p className="text-[13px] text-on-surface-variant text-center py-6">Sin datos este mes</p>
      ) : (
        <div className="space-y-1">
          {asesores.slice(0, 6).map((a, i) => {
            const medals = ['🥇', '🥈', '🥉']
            return (
              <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-high transition-colors">
                <span className="text-[13px] w-6 text-center flex-shrink-0">
                  {i < 3 ? medals[i] : <span className="text-on-surface-variant font-semibold">{i + 1}</span>}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-on-surface truncate">{a.nombre}</p>
                  <p className="text-[11px] text-on-surface-variant">{a.cantidadPagos} pagos · {a.totalEstudiantes} estudiantes</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[13px] font-bold text-on-surface">{formatCOP(a.totalVentas)}</p>
                  {a.variacion !== 0 && (
                    <p className={`text-[10px] font-semibold flex items-center justify-end gap-0.5 ${a.variacion > 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                      {a.variacion > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {a.variacion > 0 ? '+' : ''}{a.variacion}%
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

