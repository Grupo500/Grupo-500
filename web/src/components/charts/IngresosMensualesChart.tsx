'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTheme } from 'next-themes'
import { formatCOP } from '@/lib/utils'

const data = [
  { mes: 'Ene', ingresos: 2400000 },
  { mes: 'Feb', ingresos: 3200000 },
  { mes: 'Mar', ingresos: 2800000 },
  { mes: 'Abr', ingresos: 4100000 },
  { mes: 'May', ingresos: 3800000 },
  { mes: 'Jun', ingresos: 5200000 },
]

export function IngresosMensualesChart() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const primary    = isDark ? '#95daff' : '#1a7de0'
  const gridColor  = isDark ? 'rgba(149,218,255,0.06)' : 'rgba(0,48,96,0.06)'
  const tickColor  = isDark ? '#95c8f0' : '#2a4172'
  const tooltipBg  = isDark ? '#0f1e35' : '#ffffff'
  const tooltipBorder = isDark ? 'rgba(149,218,255,0.12)' : 'rgba(0,48,96,0.10)'
  const labelColor = isDark ? '#d6eaff' : '#001d3d'

  return (
    <div className="card p-5 h-72">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold text-on-surface">Ingresos mensuales</h3>
        <span className="chip-info text-[11px]">Últimos 6 meses</span>
      </div>
      <ResponsiveContainer width="100%" height="82%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor={primary} stopOpacity={0.25} />
              <stop offset="100%" stopColor={primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="mes"
            tick={{ fill: tickColor, fontSize: 12, fontFamily: 'Inter' }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tick={{ fill: tickColor, fontSize: 11, fontFamily: 'Inter' }}
            axisLine={false} tickLine={false}
            tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
          />
          <Tooltip
            contentStyle={{
              background: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: 10,
              boxShadow: '0 4px 16px rgba(0,48,96,0.10)',
              padding: '10px 14px',
            }}
            labelStyle={{ color: labelColor, fontWeight: 600, fontSize: 13, marginBottom: 4 }}
            formatter={(value: number) => [formatCOP(value), 'Ingresos']}
            itemStyle={{ color: primary, fontSize: 13 }}
          />
          <Area
            type="monotone"
            dataKey="ingresos"
            stroke={primary}
            strokeWidth={2.5}
            fill="url(#gradIngresos)"
            dot={false}
            activeDot={{ r: 5, fill: primary, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
