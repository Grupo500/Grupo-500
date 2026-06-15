'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { apiFetch } from '@/lib/api'
import { formatCurso } from '@/lib/utils'
import { BookOpen } from 'lucide-react'

interface CursoData {
  id: string
  nombre: string
  precio: number
  _count: { estudiantes: number }
}

const COLORS_LIGHT = ['#1a7de0', '#16a34a', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#db2777', '#65a30d']
const COLORS_DARK  = ['#95daff', '#6ee7b7', '#fbbf24', '#c4b5fd', '#fca5a5', '#67e8f9', '#f9a8d4', '#bef264']

export function CursosVendidosRanked({ desde, hasta }: { desde: string; hasta: string }) {
  const { resolvedTheme: theme } = useTheme()
  const isDark    = theme === 'dark'
  const temaListo = theme !== undefined
  const colors    = isDark ? COLORS_DARK : COLORS_LIGHT

  const { data, isLoading } = useQuery({
    queryKey: ['cursos-vendidos-reportes', desde, hasta],
    queryFn: async () => apiFetch(`/reportes/cursos?desde=${desde}&hasta=${hasta}`) as Promise<{ data: CursoData[] }>,
    staleTime: 30_000,
  })

  if (!temaListo || isLoading) {
    return (
      <div className="card p-5">
        <div className="h-4 w-40 rounded bg-surface-high animate-pulse mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 rounded-xl bg-surface-high animate-pulse" />)}
        </div>
      </div>
    )
  }

  const cursos = (data?.data ?? [])
    .map(c => ({ nombre: c.nombre, vendidos: c._count.estudiantes }))
    .filter(c => c.vendidos > 0)
    .sort((a, b) => b.vendidos - a.vendidos)

  const total = cursos.reduce((s, c) => s + c.vendidos, 0)

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[var(--primary-container)] flex items-center justify-center">
            <BookOpen className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-[15px] font-semibold text-on-surface">Cursos más vendidos</h3>
        </div>
        <span className="text-[11px] text-on-surface-variant tabular-nums">
          {total} venta{total !== 1 ? 's' : ''} totales
        </span>
      </div>

      {cursos.length === 0 ? (
        <p className="text-[13px] text-on-surface-variant text-center py-8">Sin ventas registradas en este período</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {cursos.map((c, i) => {
            const color    = colors[i % colors.length]
            const pct      = total > 0 ? Math.round((c.vendidos / total) * 100) : 0
            const isTop    = i === 0
            return (
              <div
                key={c.nombre}
                className="relative rounded-2xl border border-outline-variant bg-surface-lowest p-3.5 flex flex-col gap-2 hover:shadow-[var(--shadow-float)] transition-shadow overflow-hidden"
                style={isTop ? { borderColor: `${color}66` } : undefined}
              >
                {/* Acento lateral */}
                <span
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ background: color }}
                />
                {/* Posición */}
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums"
                    style={{ background: `${color}1f`, color }}
                  >
                    #{i + 1}
                  </span>
                  <span className="text-[10px] text-on-surface-variant tabular-nums">{pct}%</span>
                </div>
                {/* Nombre */}
                <p className="text-[12px] font-semibold text-on-surface leading-tight line-clamp-2 min-h-[2.2em]" title={c.nombre}>
                  {formatCurso(c.nombre)}
                </p>
                {/* Ventas */}
                <div className="flex items-baseline gap-1 mt-auto">
                  <span className="text-[22px] font-bold tabular-nums leading-none" style={{ color }}>{c.vendidos}</span>
                  <span className="text-[10px] text-on-surface-variant">vendido{c.vendidos !== 1 ? 's' : ''}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
