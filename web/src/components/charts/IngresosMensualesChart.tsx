'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { useTheme } from 'next-themes'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { createClientFetcher } from '@/lib/api'
import { formatCOP } from '@/lib/utils'

interface Punto { label: string; ingresos: number; pagos: number }

export function IngresosMensualesChart() {
  const { getToken } = useAuth()
  const { resolvedTheme } = useTheme()
  const isDark            = resolvedTheme === 'dark'
  const temaListo         = resolvedTheme !== undefined

  const { data, isLoading } = useQuery({
    queryKey: ['ventas-grafica-mensual'],
    queryFn: async () => {
      const token = await getToken()
      return createClientFetcher(token)<{ data: { puntos: Punto[]; variacion: number; actual: number } }>('/reportes/ventas-grafica?periodo=mensual')
    },
    staleTime: 60_000,
  })

  const puntos = data?.data?.puntos ?? []
  const primary      = isDark ? '#95daff' : '#1a7de0'
  const gridColor    = isDark ? 'rgba(149,218,255,0.06)' : 'rgba(0,48,96,0.06)'
  const tickColor    = isDark ? '#95c8f0' : '#2a4172'

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-on-surface">Ingresos mensuales</p>
        <span className="text-[11px] text-on-surface-variant">Últimos 6 meses</span>
      </div>

      {!temaListo || isLoading ? (
        <div className="h-56 rounded-xl bg-surface-high animate-pulse" />
      ) : puntos.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-[13px] text-on-surface-variant">Sin datos</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={puntos} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="gradIngresosMensuales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={primary} stopOpacity={0.25} />
                <stop offset="100%" stopColor={primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: tickColor, fontSize: 11, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: tickColor, fontSize: 11, fontFamily: 'Inter' }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v/1_000).toFixed(0)}K` : `$${v}`} />
            <Tooltip
              contentStyle={{
                background: isDark ? '#0f1e35' : '#fff',
                border: `1px solid ${isDark ? 'rgba(149,218,255,0.12)' : 'rgba(0,48,96,0.10)'}`,
                borderRadius: 10,
                padding: '8px 12px',
              }}
              labelStyle={{ color: isDark ? '#d6eaff' : '#001d3d', fontWeight: 600, fontSize: 12 }}
              formatter={(v: number) => [formatCOP(v), 'Ingresos']}
              itemStyle={{ color: primary, fontSize: 12 }}
            />
            <Area type="monotone" dataKey="ingresos" stroke={primary} strokeWidth={2.5}
              fill="url(#gradIngresosMensuales)" dot={false} activeDot={{ r: 5, fill: primary, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
