'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { TrendingUp, TrendingDown, Users } from 'lucide-react'

interface Asesor {
  id: string
  nombre: string
  totalVentas: number
  cantidadPagos: number
  totalEstudiantes: number
  variacion: number
}

const MEDALLAS = ['🥇', '🥈', '🥉']

export function TopAsesores() {
  const { data, isLoading } = useQuery({
    queryKey: ['ranking-asesores', 'mes-actual'],
    queryFn: async () => apiFetch<{ data: Asesor[] }>('/reportes/asesores'),
    staleTime: 30_000,
  })

  const top = (data?.data ?? []).slice(0, 5)

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-on-surface">Top 5 asesores</p>
        <span className="text-[11px] text-on-surface-variant">Este mes</span>
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl bg-surface-high animate-pulse" />)}
        </div>
      ) : top.length === 0 ? (
        <p className="text-[13px] text-on-surface-variant text-center py-8">Sin ventas de asesores este mes</p>
      ) : (
        <div className="space-y-2.5">
          {top.map((a, i) => {
            const iniciales = a.nombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
            return (
              <div key={a.id}
                className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-high/40 p-3 transition-colors hover:bg-surface-high">
                {/* Posición */}
                <span className="w-6 text-center text-[15px] flex-shrink-0">
                  {i < 3 ? MEDALLAS[i] : <span className="text-[13px] font-bold text-on-surface-variant">{i + 1}</span>}
                </span>
                {/* Avatar inicial */}
                <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-[12px] font-bold text-primary">{iniciales}</span>
                </div>
                {/* Nombre + estudiantes */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-on-surface truncate">{a.nombre}</p>
                  <p className="text-[11px] text-on-surface-variant flex items-center gap-1">
                    <Users className="w-3 h-3" /> {a.totalEstudiantes} estudiante{a.totalEstudiantes !== 1 ? 's' : ''} · {a.cantidadPagos} venta{a.cantidadPagos !== 1 ? 's' : ''}
                  </p>
                </div>
                {/* Ventas + variación */}
                <div className="text-right flex-shrink-0">
                  <p className="text-[14px] font-bold text-on-surface tabular-nums">{formatCOP(a.totalVentas)}</p>
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
