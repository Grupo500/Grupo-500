'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
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
      <div className="space-y-3 px-2">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-3 w-20 bg-[var(--surface-high)] rounded" />
            <div
              className="h-6 bg-[var(--surface-high)] rounded"
              style={{ width: `${[70, 55, 40, 25][i]}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

const COLORS_LIGHT = ['#1a7de0', '#2e9e6b', '#d97706', '#7c3aed', '#dc2626']
const COLORS_DARK  = ['#95daff', '#6ee7b7', '#fbbf24', '#c4b5fd', '#fca5a5']

function truncar(nombre: string, max = 22) {
  return nombre.length > max ? nombre.slice(0, max - 1) + '…' : nombre
}

type Periodo = 'diario' | 'semanal' | 'mensual'

export function CursosVendidosChart({ periodo = 'mensual' }: { periodo?: Periodo }) {
  const { resolvedTheme: theme } = useTheme()
  const isDark    = theme === 'dark'
  const temaListo = theme !== undefined

  const colors    = isDark ? COLORS_DARK : COLORS_LIGHT
  const gridColor = isDark ? 'rgba(149,218,255,0.06)' : 'rgba(0,48,96,0.06)'
  const tickColor = isDark ? '#95c8f0' : '#2a4172'
  const tooltipBg = isDark ? '#0f1e35' : '#ffffff'
  const tooltipBorder = isDark ? 'rgba(149,218,255,0.12)' : 'rgba(0,48,96,0.10)'
  const labelColor    = isDark ? '#d6eaff' : '#001d3d'

  const { data, isLoading, isError } = useQuery({
    queryKey: ['cursos-vendidos', periodo],
    queryFn: async () => {
      return apiFetch(`/reportes/cursos?periodo=${periodo}`) as Promise<{ data: CursoData[] }>
    },
    staleTime: 30_000,
  })

  if (!temaListo || isLoading) return <Skeleton />

  const cursos = (data?.data ?? [])
    .slice(0, 6)
    .map(c => ({ nombre: truncar(c.nombre), vendidos: c._count.estudiantes }))

  return (
    <div className="card p-5 h-72">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-md bg-[var(--primary-container)] flex items-center justify-center">
          <BookOpen className="w-3.5 h-3.5 text-primary" />
        </div>
        <h3 className="text-[15px] font-semibold text-on-surface">Cursos más vendidos</h3>
      </div>

      {isError || cursos.length === 0 ? (
        <div className="flex items-center justify-center h-[75%] text-[13px] text-on-surface-variant">
          Sin datos disponibles
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="82%">
          <BarChart
            data={cursos}
            layout="vertical"
            margin={{ top: 0, right: 16, left: 4, bottom: 0 }}
            barSize={14}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: tickColor, fontSize: 11, fontFamily: 'Inter' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="nombre"
              width={90}
              tick={{ fill: tickColor, fontSize: 11, fontFamily: 'Inter' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: isDark ? 'rgba(149,218,255,0.04)' : 'rgba(0,48,96,0.04)' }}
              contentStyle={{
                background: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: 10,
                boxShadow: '0 4px 16px rgba(0,48,96,0.10)',
                padding: '8px 14px',
              }}
              labelStyle={{ color: labelColor, fontWeight: 600, fontSize: 13, marginBottom: 2 }}
              formatter={(value: number) => [`${value} estudiante${value !== 1 ? 's' : ''}`, 'Vendidos']}
              itemStyle={{ fontSize: 13 }}
            />
            <Bar dataKey="vendidos" radius={[0, 6, 6, 0]}>
              {cursos.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

