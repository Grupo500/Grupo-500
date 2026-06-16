'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { apiFetch } from '@/lib/api'
import { formatCurso } from '@/lib/utils'
import { BookOpen } from 'lucide-react'

interface CursoData {
  id: string
  nombre: string
  precio: number
  _count: { estudiantes: number }
}

const COLORS_LIGHT = ['#1a7de0', '#2e9e6b', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#db2777', '#65a30d', '#b45309', '#0f766e']
const COLORS_DARK  = ['#95daff', '#6ee7b7', '#fbbf24', '#c4b5fd', '#fca5a5', '#67e8f9', '#f9a8d4', '#bef264', '#fcd34d', '#5eead4']

export function CursosVendidosRanked({ desde, hasta }: { desde: string; hasta: string }) {
  const { resolvedTheme: theme } = useTheme()
  const isDark    = theme === 'dark'
  const temaListo = theme !== undefined
  const colors    = isDark ? COLORS_DARK : COLORS_LIGHT
  const grisOtros = isDark ? '#3a4d6e' : '#c2d4ef'

  const { data, isLoading } = useQuery({
    queryKey: ['cursos-vendidos-reportes', desde, hasta],
    queryFn: async () => apiFetch(`/reportes/cursos?desde=${desde}&hasta=${hasta}`) as Promise<{ data: CursoData[] }>,
    staleTime: 30_000,
  })

  if (!temaListo || isLoading) {
    return (
      <div className="card p-5">
        <div className="h-4 w-44 rounded bg-surface-high animate-pulse mb-5" />
        <div className="flex justify-center">
          <div className="w-40 h-40 rounded-full bg-surface-high animate-pulse" />
        </div>
      </div>
    )
  }

  const todos  = (data?.data ?? [])
    .map(c => ({ nombre: c.nombre, vendidos: c._count.estudiantes }))
    .filter(c => c.vendidos > 0)
    .sort((a, b) => b.vendidos - a.vendidos)

  const total   = todos.reduce((s, c) => s + c.vendidos, 0)
  // En Reportes se muestran TODOS los cursos (sin agrupar en "Otros")
  const slices  = todos

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

      {todos.length === 0 ? (
        <p className="text-[13px] text-on-surface-variant text-center py-8">Sin ventas registradas en este período</p>
      ) : (
        <div className="flex flex-col lg:flex-row items-center gap-6">
          {/* Dona */}
          <div className="relative flex-shrink-0" style={{ width: 180, height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="vendidos"
                  nameKey="nombre"
                  innerRadius="78%"
                  outerRadius="100%"
                  paddingAngle={2}
                  cornerRadius={8}
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                  animationBegin={0}
                  animationDuration={800}
                >
                  {slices.map((s, i) => (
                    <Cell key={i} fill={s.nombre === 'Otros' ? grisOtros : colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [`${v} ventas (${total > 0 ? Math.round((v / total) * 100) : 0}%)`, '']}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--outline-variant)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[28px] font-bold text-on-surface tabular-nums leading-none">{total}</span>
              <span className="text-[11px] text-on-surface-variant mt-0.5">ventas</span>
            </div>
          </div>

          {/* Leyenda */}
          <div className="flex-1 space-y-2 w-full">
            {slices.map((c, i) => {
              const esOtros = c.nombre === 'Otros'
              const color   = esOtros ? grisOtros : colors[i % colors.length]
              const pct     = total > 0 ? Math.round((c.vendidos / total) * 100) : 0
              return (
                <div key={c.nombre} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
                  <span className={`text-[12px] flex-1 leading-snug truncate ${esOtros ? 'text-on-surface-variant' : 'text-on-surface'}`}>
                    {esOtros ? 'Otros' : formatCurso(c.nombre)}
                  </span>
                  <span className="text-[11px] text-on-surface-variant tabular-nums">{pct}%</span>
                  <span className={`text-[12px] font-bold tabular-nums ${esOtros ? 'text-on-surface-variant' : 'text-on-surface'}`}>
                    {c.vendidos}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
