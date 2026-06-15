'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
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
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const verde  = isDark ? '#6ee7b7' : '#16a34a'
  const rojo   = isDark ? '#f87171' : '#dc2626'

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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-40 rounded-xl bg-surface-high animate-pulse" />)}
        </div>
      ) : top.length === 0 ? (
        <p className="text-[13px] text-on-surface-variant text-center py-8">Sin ventas de asesores este mes</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          {top.map((a, i) => {
            const iniciales = a.nombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
            return (
              <div key={a.id}
                className="flex flex-col items-center text-center rounded-xl bg-surface-high/50 p-3 transition-colors duration-200 hover:bg-surface-high">
                {/* Posición */}
                <span className="text-[16px] leading-none mb-2 h-5 flex items-center">
                  {i < 3 ? MEDALLAS[i] : <span className="text-[13px] font-bold text-on-surface-variant">{i + 1}</span>}
                </span>
                {/* Avatar inicial */}
                <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center mb-2">
                  <span className="text-[13px] font-bold text-primary">{iniciales}</span>
                </div>
                {/* Nombre */}
                <p className="text-[12px] font-semibold text-on-surface leading-tight line-clamp-2 min-h-[2.2em]" title={a.nombre}>{a.nombre}</p>
                {/* Ventas */}
                <p className="text-[13px] font-bold text-on-surface tabular-nums mt-1.5">{formatCOP(a.totalVentas)}</p>
                {/* Estudiantes */}
                <p className="text-[10px] text-on-surface-variant flex items-center gap-1 mt-0.5">
                  <Users className="w-3 h-3" /> {a.cantidadPagos} venta{a.cantidadPagos !== 1 ? 's' : ''}
                </p>
                {/* Variación */}
                {a.variacion !== 0 && (
                  <p className="text-[10px] font-semibold flex items-center gap-0.5 mt-1"
                    style={{ color: a.variacion > 0 ? verde : rojo }}>
                    {a.variacion > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {a.variacion > 0 ? '+' : ''}{a.variacion}%
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
