'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { BarChart2 } from 'lucide-react'

interface Punto {
  label: string
  ventaTotal: number
  recaudo: number
  saldo: number
}

function Skeleton() {
  return (
    <div className="card p-5 h-80 animate-pulse">
      <div className="h-4 w-52 bg-[var(--surface-high)] rounded-md mb-5" />
      <div className="h-full bg-[var(--surface-high)] rounded-xl" style={{ height: '80%' }} />
    </div>
  )
}

const COLORS = {
  light: { ventaTotal: '#1a7de0', recaudo: '#2e9e6b', saldo: '#d97706' },
  dark:  { ventaTotal: '#95daff', recaudo: '#6ee7b7', saldo: '#fbbf24' },
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--surface-lowest)] border border-[var(--outline-variant)] rounded-xl shadow-float p-3 text-[12px] space-y-1.5 min-w-[180px]">
      <p className="font-semibold text-on-surface mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.fill }} />
            <span className="text-on-surface-variant">{p.name}</span>
          </span>
          <span className="font-semibold text-on-surface tabular">{formatCOP(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function FinancieroChart() {
  const { resolvedTheme: theme } = useTheme()
  const isDark    = theme === 'dark'
  const temaListo = theme !== undefined
  const colors    = isDark ? COLORS.dark : COLORS.light

  const gridColor = isDark ? 'rgba(149,218,255,0.06)' : 'rgba(0,48,96,0.06)'
  const tickColor = isDark ? '#95c8f0' : '#2a4172'

  const { data, isLoading, isError } = useQuery({
    queryKey: ['financiero'],
    queryFn: async () => {
      const token = await getClientToken()
      return createClientFetcher(token ?? '')('/reportes/financiero') as Promise<{ data: Punto[] }>
    },
    staleTime: 60_000,
  })

  if (!temaListo || isLoading) return <Skeleton />

  const puntos = data?.data ?? []

  return (
    <div className="card p-5 h-80">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-md bg-[var(--primary-container)] flex items-center justify-center">
          <BarChart2 className="w-3.5 h-3.5 text-primary" />
        </div>
        <h3 className="text-[15px] font-semibold text-on-surface">Venta total · Recaudo · Saldo</h3>
      </div>

      {isError || puntos.length === 0 ? (
        <div className="flex items-center justify-center h-[75%] text-[13px] text-on-surface-variant">
          Sin datos disponibles
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="88%">
          <BarChart data={puntos} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: tickColor, fontSize: 11, fontFamily: 'Inter' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tick={{ fill: tickColor, fontSize: 11, fontFamily: 'Inter' }}
              axisLine={false} tickLine={false}
              tickFormatter={(v) => v >= 1_000_000
                ? `$${(v / 1_000_000).toFixed(1)}M`
                : v >= 1_000
                  ? `$${(v / 1_000).toFixed(0)}K`
                  : `$${v}`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: isDark ? 'rgba(149,218,255,0.04)' : 'rgba(0,48,96,0.04)' }} />
            <Legend
              iconType="circle"
              iconSize={7}
              wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
            />
            <Bar dataKey="ventaTotal" name="Venta total" fill={colors.ventaTotal} radius={[4, 4, 0, 0]} />
            <Bar dataKey="recaudo"    name="Recaudo"     fill={colors.recaudo}    radius={[4, 4, 0, 0]} />
            <Bar dataKey="saldo"      name="Saldo"       fill={colors.saldo}      radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

