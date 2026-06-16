'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { apiFetch } from '@/lib/api'
import { Activity } from 'lucide-react'

type Granularidad = 'horaria' | 'diaria' | 'mensual'
interface Punto { label: string; ingresos: number; pagos: number }

const titulosGran: Record<Granularidad, string> = {
  horaria: 'Tendencia por hora',
  diaria:  'Tendencia diaria',
  mensual: 'Tendencia mensual',
}

const subSubGran: Record<Granularidad, string> = {
  horaria: 'pagos por hora',
  diaria:  'pagos por día',
  mensual: 'pagos por mes',
}

export function TendenciaPagosCard({ desde, hasta, periodoLabel }: { desde: string; hasta: string; periodoLabel?: string }) {
  const { resolvedTheme } = useTheme()
  const isDark    = resolvedTheme === 'dark'
  const temaListo = resolvedTheme !== undefined

  // Misma queryKey que IngresosMensualesChart para reusar caché de React Query
  const { data, isLoading } = useQuery({
    queryKey: ['ventas-grafica', desde, hasta],
    queryFn: async () => apiFetch<{ data: { puntos: Punto[]; granularidad: Granularidad } }>(
      `/reportes/ventas-grafica?desde=${desde}&hasta=${hasta}`
    ),
    staleTime: 30_000,
  })

  const puntos       = data?.data?.puntos ?? []
  const granularidad = data?.data?.granularidad ?? 'mensual'

  const accent    = isDark ? '#a78bfa' : '#7c3aed'
  const gridColor = isDark ? 'rgba(167,139,250,0.08)' : 'rgba(124,58,237,0.08)'
  const tickColor = isDark ? '#c4b5fd' : '#4c1d95'

  // KPIs
  const total     = puntos.reduce((s, p) => s + p.pagos, 0)
  const mejor     = puntos.reduce((m, p) => (p.pagos > m.pagos ? p : m), puntos[0] ?? { label: '—', ingresos: 0, pagos: 0 })
  const conPagos  = puntos.filter(p => p.pagos > 0).length
  const promedio  = conPagos > 0 ? Math.round(total / conPagos) : 0

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'var(--primary-container)' }}>
            <Activity className="w-3.5 h-3.5 text-primary" />
          </div>
          <p className="text-[13px] font-semibold text-on-surface">{titulosGran[granularidad]}</p>
        </div>
        <span className="text-[11px] text-on-surface-variant capitalize">{periodoLabel ?? ''}</span>
      </div>
      <p className="text-[11px] text-on-surface-variant mb-3">Volumen de {subSubGran[granularidad]} en el período</p>

      {!temaListo || isLoading ? (
        <div className="h-40 rounded-xl bg-surface-high animate-pulse" />
      ) : puntos.length === 0 || total === 0 ? (
        <div className="h-40 flex items-center justify-center text-[12px] text-on-surface-variant">Sin pagos en este período</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={puntos} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gradTendenciaPagos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={accent} stopOpacity={0.30} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd"
                tickFormatter={(label: string) => {
                  if (granularidad === 'diaria') {
                    const m = label.match(/\d+/)
                    return m ? String(Number(m[0])) : label
                  }
                  if (granularidad === 'mensual') {
                    return label.split(/\s|\bde\b/).filter(Boolean)[0] ?? label
                  }
                  return label
                }}
              />
              <YAxis tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: isDark ? '#0f1e35' : '#fff',
                  border: `1px solid var(--outline-variant)`,
                  borderRadius: 10, padding: '8px 12px', fontSize: 12,
                }}
                labelStyle={{ fontWeight: 600 }}
                formatter={(v: number) => [`${v} pago${v !== 1 ? 's' : ''}`, 'Volumen']}
              />
              <Area type="monotone" dataKey="pagos" stroke={accent} strokeWidth={2.5}
                fill="url(#gradTendenciaPagos)" dot={false} activeDot={{ r: 4, fill: accent, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-3 pt-3 border-t border-outline-variant divide-x divide-outline-variant">
            <div className="px-3 first:pl-0">
              <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide">Total pagos</p>
              <p className="text-[15px] font-bold text-on-surface tabular-nums mt-0.5">{total}</p>
            </div>
            <div className="px-3">
              <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide">Mejor</p>
              <p className="text-[15px] font-bold text-on-surface tabular-nums mt-0.5">{mejor.pagos}</p>
              <p className="text-[10px] text-on-surface-variant capitalize truncate">{mejor.label}</p>
            </div>
            <div className="px-3 last:pr-0">
              <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide">Promedio</p>
              <p className="text-[15px] font-bold text-on-surface tabular-nums mt-0.5">{promedio}</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
