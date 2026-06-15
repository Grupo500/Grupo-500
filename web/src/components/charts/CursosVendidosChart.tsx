'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { apiFetch } from '@/lib/api'
import { BookOpen } from 'lucide-react'

interface CursoData {
  id: string
  nombre: string
  precio: number
  _count: { estudiantes: number }
}

function Skeleton() {
  return (
    <div className="card p-5 h-72 animate-pulse">
      <div className="h-4 w-44 bg-[var(--surface-high)] rounded-md mb-5" />
      <div className="flex justify-center">
        <div className="w-32 h-32 rounded-full bg-[var(--surface-high)]" />
      </div>
    </div>
  )
}

const COLORS_LIGHT = ['#1a7de0', '#2e9e6b', '#d97706', '#7c3aed', '#dc2626', '#0891b2']
const COLORS_DARK  = ['#95daff', '#6ee7b7', '#fbbf24', '#c4b5fd', '#fca5a5', '#67e8f9']

function truncar(nombre: string, max = 20) {
  return nombre.length > max ? nombre.slice(0, max - 1) + '…' : nombre
}

export function CursosVendidosChart({ desde, hasta }: { desde: string; hasta: string }) {
  const { resolvedTheme: theme } = useTheme()
  const isDark    = theme === 'dark'
  const temaListo = theme !== undefined

  const colors        = isDark ? COLORS_DARK : COLORS_LIGHT
  const tooltipBg     = isDark ? '#0f1e35' : '#ffffff'
  const tooltipBorder = isDark ? 'rgba(149,218,255,0.12)' : 'rgba(0,48,96,0.10)'
  const labelColor    = isDark ? '#d6eaff' : '#001d3d'

  const { data, isLoading, isError } = useQuery({
    queryKey: ['cursos-vendidos', desde, hasta],
    queryFn: async () => apiFetch(`/reportes/cursos?desde=${desde}&hasta=${hasta}`) as Promise<{ data: CursoData[] }>,
    staleTime: 30_000,
  })

  if (!temaListo || isLoading) return <Skeleton />

  const cursos = (data?.data ?? [])
    .map(c => ({ nombre: c.nombre, vendidos: c._count.estudiantes }))
    .filter(c => c.vendidos > 0)
    .slice(0, 6)

  const total = cursos.reduce((s, c) => s + c.vendidos, 0)

  return (
    <div className="card p-5 h-72 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-md bg-[var(--primary-container)] flex items-center justify-center">
          <BookOpen className="w-3.5 h-3.5 text-primary" />
        </div>
        <h3 className="text-[15px] font-semibold text-on-surface">Cursos más vendidos</h3>
      </div>

      {isError || cursos.length === 0 ? (
        <div className="flex items-center justify-center flex-1 text-[13px] text-on-surface-variant">
          Sin datos disponibles
        </div>
      ) : (
        <div className="flex-1 flex items-center gap-3 min-h-0">
          {/* Dona con total al centro */}
          <div className="relative flex-shrink-0" style={{ width: 130, height: 130 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={cursos}
                  dataKey="vendidos"
                  nameKey="nombre"
                  innerRadius="62%"
                  outerRadius="100%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {cursos.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 10, padding: '6px 12px' }}
                  labelStyle={{ color: labelColor, fontWeight: 600, fontSize: 12 }}
                  formatter={(v: number) => [`${v} venta${v !== 1 ? 's' : ''}`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[20px] font-bold text-on-surface tabular-nums leading-none">{total}</span>
              <span className="text-[10px] text-on-surface-variant">ventas</span>
            </div>
          </div>

          {/* Leyenda */}
          <div className="flex-1 min-w-0 space-y-1.5 overflow-y-auto">
            {cursos.map((c, i) => (
              <div key={c.nombre} className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: colors[i % colors.length] }} />
                <span className="text-[11px] text-on-surface truncate flex-1" title={c.nombre}>{truncar(c.nombre)}</span>
                <span className="text-[11px] font-bold text-on-surface tabular-nums flex-shrink-0">{c.vendidos}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
