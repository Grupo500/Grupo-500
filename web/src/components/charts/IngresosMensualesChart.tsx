'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { apiFetch } from '@/lib/api'
import { formatCOP } from '@/lib/utils'

type Periodo = 'diario' | 'semanal' | 'mensual'

interface Punto { label: string; ingresos: number; pagos: number }

const subtitulos: Record<Periodo, string> = {
  diario:  'Últimos 14 días',
  semanal: 'Últimas 8 semanas',
  mensual: 'Últimos 6 meses',
}

const titulos: Record<Periodo, string> = {
  diario:  'Ingresos diarios',
  semanal: 'Ingresos semanales',
  mensual: 'Ingresos mensuales',
}

function fmtCompact(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="min-w-0 px-4 first:pl-0 last:pr-0">
      <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide truncate">{label}</p>
      <p className="text-[15px] font-bold tabular-nums leading-tight mt-0.5 truncate" style={color ? { color } : undefined}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-on-surface-variant capitalize truncate">{sub}</p>}
    </div>
  )
}

export function IngresosMensualesChart({ periodo = 'mensual' }: { periodo?: Periodo }) {
  const { resolvedTheme } = useTheme()
  const isDark            = resolvedTheme === 'dark'
  const temaListo         = resolvedTheme !== undefined

  const { data, isLoading } = useQuery({
    queryKey: ['ventas-grafica', periodo],
    queryFn: async () => {
            return apiFetch<{ data: { puntos: Punto[]; variacion: number; actual: number } }>(`/reportes/ventas-grafica?periodo=${periodo}`)
    },
    staleTime: 30_000,
  })

  const puntos    = data?.data?.puntos ?? []
  const primary   = isDark ? '#95daff' : '#1a7de0'
  const gridColor = isDark ? 'rgba(149,218,255,0.06)' : 'rgba(0,48,96,0.06)'
  const tickColor = isDark ? '#95c8f0' : '#2a4172'

  // ── KPIs derivados de la serie ──────────────────────────────────────────
  const total        = puntos.reduce((s, p) => s + p.ingresos, 0)
  const mejor        = puntos.reduce((m, p) => (p.ingresos > m.ingresos ? p : m), puntos[0] ?? { label: '—', ingresos: 0, pagos: 0 })
  const mesesActivos = puntos.filter(p => p.ingresos > 0).length
  const promedio     = mesesActivos > 0 ? total / mesesActivos : 0
  const crecimiento  = data?.data?.variacion ?? 0
  const verde        = isDark ? '#6ee7b7' : '#16a34a'
  const rojo         = isDark ? '#f87171' : '#dc2626'

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-on-surface">{titulos[periodo]}</p>
        <span className="text-[11px] text-on-surface-variant">{subtitulos[periodo]}</span>
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
                borderRadius: 10, padding: '8px 12px',
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

      {/* ── Mini-KPIs ───────────────────────────────────────────────────── */}
      {temaListo && !isLoading && puntos.length > 0 && (
        <div className="grid grid-cols-4 gap-0 pt-3 border-t border-outline-variant divide-x divide-outline-variant">
          <Kpi label="Total 6 meses"     value={fmtCompact(total)} />
          <Kpi label="Mejor mes"         value={fmtCompact(mejor.ingresos)} sub={mejor.label} />
          <Kpi label="Promedio mensual"  value={fmtCompact(promedio)} />
          <Kpi
            label="Crecimiento"
            value={`${crecimiento > 0 ? '▲ +' : crecimiento < 0 ? '▼ ' : ''}${crecimiento}%`}
            color={crecimiento > 0 ? verde : crecimiento < 0 ? rojo : undefined}
          />
        </div>
      )}
    </div>
  )
}
