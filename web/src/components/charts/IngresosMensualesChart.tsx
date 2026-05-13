'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCOP } from '@/lib/utils'

// Datos placeholder — se conectan al API en producción
const data = [
  { mes: 'Ene', ingresos: 2400000 },
  { mes: 'Feb', ingresos: 3200000 },
  { mes: 'Mar', ingresos: 2800000 },
  { mes: 'Abr', ingresos: 4100000 },
  { mes: 'May', ingresos: 3800000 },
  { mes: 'Jun', ingresos: 5200000 },
]

export function IngresosMensualesChart() {
  return (
    <div className="card p-5 h-72">
      <h3 className="text-title-lg font-medium text-on-surface mb-4">Ingresos mensuales</h3>
      <ResponsiveContainer width="100%" height="80%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4edea3" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#4edea3" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="mes" tick={{ fill: '#c2c6d6', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: '#c2c6d6', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
          />
          <Tooltip
            contentStyle={{ background: '#1d2027', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
            labelStyle={{ color: '#e1e2ec', fontWeight: 600 }}
            formatter={(value: number) => [formatCOP(value), 'Ingresos']}
          />
          <Area
            type="monotone"
            dataKey="ingresos"
            stroke="#4edea3"
            strokeWidth={2}
            fill="url(#colorIngresos)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
