'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { apiFetch } from '@/lib/api'
import { Users } from 'lucide-react'

interface MesData { label: string; mes: number; cantidad: number }

function Skeleton() {
  return (
    <div className="card p-5 h-72 animate-pulse">
      <div className="h-4 w-48 bg-[var(--surface-high)] rounded-md mb-2" />
      <div className="h-3 w-24 bg-[var(--surface-high)] rounded mb-5" />
      <div className="flex items-end gap-1 h-40 px-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-[var(--surface-high)] rounded-t"
            style={{ height: `${20 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload, label, color }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--surface-lowest)] border border-[var(--outline-variant)] rounded-xl shadow-float px-4 py-2.5 text-[12px]">
      <p className="font-semibold text-on-surface mb-1 capitalize">{label}</p>
      <p className="font-bold" style={{ color }}>{payload[0]?.value} estudiante{payload[0]?.value !== 1 ? 's' : ''}</p>
    </div>
  )
}

export function EstudiantesMes() {
  const { resolvedTheme: theme } = useTheme()
  const isDark    = theme === 'dark'
  const temaListo = theme !== undefined

  const color      = isDark ? '#95daff' : '#1a7de0'
  const colorActual = isDark ? '#6ee7b7' : '#16a34a'
  const gridColor  = isDark ? 'rgba(149,218,255,0.06)' : 'rgba(0,48,96,0.06)'
  const tickColor  = isDark ? '#95c8f0' : '#2a4172'

  const { data, isLoading } = useQuery({
    queryKey: ['estudiantes-por-mes'],
    queryFn: () => apiFetch('/reportes/estudiantes-por-mes') as Promise<{
      data: { meses: MesData[]; total: number; anio: number }
    }>,
    staleTime: 60_000,
  })

  if (!temaListo || isLoading) return <Skeleton />

  const meses   = data?.data?.meses ?? []
  const total   = data?.data?.total ?? 0
  const anio    = data?.data?.anio  ?? new Date().getFullYear()
  const mesActual = new Date().getMonth()

  return (
    <div className="card p-5 h-72">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[var(--primary-container)] flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-on-surface leading-tight">Ingresos de estudiantes</h3>
            <p className="text-[11px] text-on-surface-variant">{anio}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[19px] font-bold text-on-surface tabular leading-tight">{total}</p>
          <p className="text-[11px] text-on-surface-variant">total en el año</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height="72%">
        <BarChart data={meses} margin={{ top: 0, right: 4, left: -20, bottom: 0 }} barSize={14}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: tickColor, fontSize: 10, fontFamily: 'Inter' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: tickColor, fontSize: 10, fontFamily: 'Inter' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip color={color} />} cursor={{ fill: isDark ? 'rgba(149,218,255,0.04)' : 'rgba(0,48,96,0.04)' }} />
          <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>
            {meses.map((m, i) => (
              <Cell
                key={i}
                fill={i === mesActual ? colorActual : color}
                opacity={i > mesActual ? 0.3 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
