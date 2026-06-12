'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import {
  BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { apiFetch } from '@/lib/api'
import { Users } from 'lucide-react'

interface PuntoData { label: string; cantidad: number }

function Skeleton() {
  return (
    <div className="card p-5 h-72 animate-pulse">
      <div className="h-4 w-48 bg-[var(--surface-high)] rounded-md mb-2" />
      <div className="h-3 w-24 bg-[var(--surface-high)] rounded mb-5" />
      <div className="flex items-end gap-1 h-40 px-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex-1 bg-[var(--surface-high)] rounded-t" style={{ height: `${30 + (i % 4) * 15}%` }} />
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

export function EstudiantesMes({ desde, hasta }: { desde: string; hasta: string }) {
  const { resolvedTheme: theme } = useTheme()
  const isDark    = theme === 'dark'
  const temaListo = theme !== undefined

  const color       = isDark ? '#95daff' : '#1a7de0'
  const colorActual = isDark ? '#6ee7b7' : '#16a34a'
  const gridColor   = isDark ? 'rgba(149,218,255,0.06)' : 'rgba(0,48,96,0.06)'
  const tickColor   = isDark ? '#95c8f0' : '#2a4172'

  const { data, isLoading } = useQuery({
    queryKey: ['estudiantes-por-mes', desde, hasta],
    queryFn: () => apiFetch(`/reportes/estudiantes-por-mes?desde=${desde}&hasta=${hasta}`) as Promise<{
      data: { puntos: PuntoData[]; total: number }
    }>,
    staleTime: 60_000,
  })

  if (!temaListo || isLoading) return <Skeleton />

  const puntos  = data?.data?.puntos ?? []
  const total   = data?.data?.total  ?? 0

  // Detectar si el rango es un año completo para marcar el mes actual
  const desdeDate = new Date(desde + 'T00:00:00')
  const hastaDate = new Date(hasta + 'T00:00:00')
  const diasRango = Math.round((hastaDate.getTime() - desdeDate.getTime()) / 86400000) + 1
  const esAnual   = diasRango >= 365
  const mesActual = new Date().getMonth()

  return (
    <div className="card p-5 h-72">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[var(--primary-container)] flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-[15px] font-semibold text-on-surface">Ingresos de estudiantes</h3>
        </div>
        <div className="text-right">
          <p className="text-[19px] font-bold text-on-surface tabular leading-tight">{total}</p>
          <p className="text-[11px] text-on-surface-variant">en el período</p>
        </div>
      </div>

      {puntos.length === 0 ? (
        <div className="flex items-center justify-center h-[72%] text-[13px] text-on-surface-variant">Sin datos</div>
      ) : (
        <ResponsiveContainer width="100%" height="72%">
          <BarChart data={puntos} margin={{ top: 0, right: 4, left: -20, bottom: 0 }} barSize={esAnual ? 14 : 10}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: tickColor, fontSize: 10, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: tickColor, fontSize: 10, fontFamily: 'Inter' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip color={color} />} cursor={{ fill: isDark ? 'rgba(149,218,255,0.04)' : 'rgba(0,48,96,0.04)' }} />
            <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>
              {puntos.map((_, i) => (
                <Cell
                  key={i}
                  fill={esAnual && i === mesActual ? colorActual : color}
                  opacity={esAnual && i > mesActual ? 0.3 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
