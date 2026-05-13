'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCOP } from '@/lib/utils'

const data = [
  { nombre: 'Asesor 1', ventas: 5200000 },
  { nombre: 'Asesor 2', ventas: 4100000 },
  { nombre: 'Asesor 3', ventas: 3800000 },
  { nombre: 'Asesor 4', ventas: 2900000 },
]

export function RankingAsesores() {
  return (
    <div className="card p-5 h-64">
      <h3 className="text-title-lg font-medium text-on-surface mb-4">Ranking asesores</h3>
      <ResponsiveContainer width="100%" height="80%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#c2c6d6', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
          />
          <YAxis dataKey="nombre" type="category" tick={{ fill: '#c2c6d6', fontSize: 12 }} axisLine={false} tickLine={false} width={60} />
          <Tooltip
            contentStyle={{ background: '#1d2027', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
            formatter={(value: number) => [formatCOP(value), 'Ventas']}
          />
          <Bar dataKey="ventas" fill="#adc6ff" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
