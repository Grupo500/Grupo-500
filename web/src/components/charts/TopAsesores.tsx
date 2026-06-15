'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { apiFetch } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { TrendingUp, TrendingDown, Users } from 'lucide-react'

interface Asesor {
  id: string
  nombre: string
  image: string | null
  totalVentas: number
  cantidadPagos: number
  totalEstudiantes: number
  comisionGanada: number
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
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-[13px] font-semibold text-on-surface">Top 5 asesores</p>
        <span className="text-[11px] text-on-surface-variant">Este mes</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="card h-44 animate-pulse" />)}
        </div>
      ) : top.length === 0 ? (
        <div className="card p-8 text-center text-[13px] text-on-surface-variant">Sin ventas de asesores este mes</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {top.map((a, i) => {
            const iniciales = a.nombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
            return (
              <div key={a.id}
                className="card p-4 flex flex-col items-center text-center transition-shadow duration-200 hover:shadow-[var(--shadow-float)]">
                {/* Posición */}
                <span className="text-[16px] leading-none h-5 flex items-center">
                  {i < 3 ? MEDALLAS[i] : <span className="text-[13px] font-bold text-on-surface-variant">{i + 1}</span>}
                </span>
                {/* Avatar: foto o iniciales */}
                <div className="w-12 h-12 rounded-full overflow-hidden bg-primary/15 flex items-center justify-center my-2 ring-2 ring-primary/10">
                  {a.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.image} alt={a.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-[13px] font-bold text-primary">{iniciales}</span>
                  )}
                </div>
                {/* Nombre */}
                <p className="text-[12px] font-semibold text-on-surface leading-tight line-clamp-2 min-h-[2.2em]" title={a.nombre}>{a.nombre}</p>
                {/* Ventas */}
                <p className="text-[14px] font-bold text-on-surface tabular-nums mt-1.5">{formatCOP(a.totalVentas)}</p>
                {/* Ventas / estudiantes */}
                <p className="text-[10px] text-on-surface-variant flex items-center gap-1 mt-0.5">
                  <Users className="w-3 h-3" /> {a.cantidadPagos} venta{a.cantidadPagos !== 1 ? 's' : ''}
                </p>
                {/* Comisión ganada */}
                {a.comisionGanada > 0 && (
                  <p className="text-[10px] mt-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                    Comisión {formatCOP(a.comisionGanada)}
                  </p>
                )}
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
