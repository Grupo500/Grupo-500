'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { apiFetch } from '@/lib/api'
import { formatCOP } from '@/lib/utils'

function toISO(d: Date) { return format(d, 'yyyy-MM-dd') }

type Periodo = 'diario' | 'semanal' | 'mensual'
type Granularidad = 'horaria' | 'diaria' | 'mensual'

interface Punto { label: string; ingresos: number | null; pagos: number }

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

const titulosGran: Record<Granularidad, string> = {
  horaria: 'Ingresos por hora',
  diaria:  'Ingresos diarios',
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

interface Props { periodo?: Periodo; desde?: string; hasta?: string; periodoLabel?: string }

export function IngresosMensualesChart({ periodo = 'mensual', desde, hasta, periodoLabel }: Props) {
  const { resolvedTheme } = useTheme()
  const isDark            = resolvedTheme === 'dark'
  const temaListo         = resolvedTheme !== undefined

  const usaRango = !!(desde && hasta)
  const url = usaRango
    ? `/reportes/ventas-grafica?desde=${desde}&hasta=${hasta}`
    : `/reportes/ventas-grafica?periodo=${periodo}`

  const { data, isLoading } = useQuery({
    queryKey: ['ventas-grafica', usaRango ? desde : periodo, usaRango ? hasta : ''],
    queryFn: async () => apiFetch<{ data: { puntos: Punto[]; variacion: number; actual: number; granularidad: Granularidad } }>(url),
    staleTime: 30_000,
  })

  const puntos      = data?.data?.puntos ?? []
  const granularidad = data?.data?.granularidad
  const titulo    = usaRango && granularidad ? titulosGran[granularidad] : titulos[periodo]
  const subtitulo = usaRango ? (periodoLabel ?? 'Rango seleccionado') : subtitulos[periodo]
  const primary   = isDark ? '#95daff' : '#1a7de0'
  const sombra    = isDark ? 'rgba(148,167,190,0.45)' : 'rgba(100,116,139,0.40)'
  const gridColor = isDark ? 'rgba(149,218,255,0.06)' : 'rgba(0,48,96,0.06)'
  const tickColor = isDark ? '#95c8f0' : '#2a4172'

  // ── Comparativo con mes anterior (igual que el gráfico del dashboard) ────
  // Solo aplica en vista diaria de un mes completo (uso real desde /reportes)
  const comparativo = usaRango && granularidad === 'diaria'
  let inicioAnt: string | undefined
  let finAnt: string | undefined
  if (comparativo && desde) {
    const mesAnt = subMonths(new Date(desde + 'T00:00:00'), 1)
    inicioAnt = toISO(startOfMonth(mesAnt))
    finAnt    = toISO(endOfMonth(mesAnt))
  }

  const { data: antData } = useQuery({
    queryKey: ['ventas-grafica', 'anterior', inicioAnt, finAnt],
    queryFn: async () => apiFetch<{ data: { puntos: Punto[] } }>(`/reportes/ventas-grafica?desde=${inicioAnt}&hasta=${finAnt}`),
    enabled: !!(comparativo && inicioAnt && finAnt),
    staleTime: 30_000,
  })

  const puntosComparativo = useMemo(() => {
    if (!comparativo) return []
    const act = puntos
    const ant = antData?.data?.puntos ?? []
    const n = Math.max(act.length, ant.length)
    return Array.from({ length: n }, (_, i) => ({
      label: String(i + 1),
      actual: act[i]?.ingresos ?? null,
      anterior: ant[i]?.ingresos ?? 0,
    }))
  }, [comparativo, puntos, antData])

  // ── KPIs derivados de la serie (ignora días futuros con ingresos null) ────
  const total        = puntos.reduce((s, p) => s + (p.ingresos ?? 0), 0)
  const mejor        = puntos.reduce((m, p) => ((p.ingresos ?? 0) > (m.ingresos ?? 0) ? p : m), puntos[0] ?? { label: '—', ingresos: 0, pagos: 0 })
  const mesesActivos = puntos.filter(p => (p.ingresos ?? 0) > 0).length
  const promedio     = mesesActivos > 0 ? total / mesesActivos : 0
  const crecimiento  = data?.data?.variacion ?? 0
  const verde        = isDark ? '#6ee7b7' : '#16a34a'
  const rojo         = isDark ? '#f87171' : '#dc2626'

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-semibold text-on-surface">{titulo}</p>
          <span className="text-[11px] text-on-surface-variant capitalize">{subtitulo}</span>
        </div>
        {comparativo && (
          <div className="flex items-center gap-3 text-[10px] text-on-surface-variant">
            <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: primary }} /> Mes actual</span>
            <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: sombra }} /> Mes anterior</span>
          </div>
        )}
      </div>

      {!temaListo || isLoading ? (
        <div className="h-56 rounded-xl bg-surface-high animate-pulse" />
      ) : puntos.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-[13px] text-on-surface-variant">Sin datos</div>
      ) : comparativo ? (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={puntosComparativo} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="gradIngresosMensuales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={primary} stopOpacity={0.25} />
                <stop offset="100%" stopColor={primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: tickColor, fontSize: 11, fontFamily: 'Poppins, system-ui, sans-serif' }} axisLine={false} tickLine={false} interval={1} minTickGap={4} />
            <YAxis tick={{ fill: tickColor, fontSize: 11, fontFamily: 'Poppins, system-ui, sans-serif' }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v/1_000).toFixed(0)}K` : `$${v}`} />
            <Tooltip
              contentStyle={{
                background: isDark ? '#0f1e35' : '#fff',
                border: `1px solid ${isDark ? 'rgba(149,218,255,0.12)' : 'rgba(0,48,96,0.10)'}`,
                borderRadius: 10, padding: '8px 12px',
              }}
              labelStyle={{ color: isDark ? '#d6eaff' : '#001d3d', fontWeight: 600, fontSize: 12 }}
              labelFormatter={(l) => `Día ${l}`}
              formatter={(v: number, name) => [formatCOP(v), name === 'actual' ? 'Mes actual' : 'Mes anterior']}
            />
            {/* Sombra del mes anterior (detrás) */}
            <Area type="monotone" dataKey="anterior" stroke={sombra} strokeWidth={1.5} strokeDasharray="4 3"
              fill={sombra} fillOpacity={0.12} dot={false} />
            {/* Mes actual (frente) */}
            <Area type="monotone" dataKey="actual" stroke={primary} strokeWidth={2.5}
              fill="url(#gradIngresosMensuales)" dot={false} activeDot={{ r: 5, fill: primary, strokeWidth: 0 }} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
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
            <XAxis dataKey="label" tick={{ fill: tickColor, fontSize: 11, fontFamily: 'Poppins, system-ui, sans-serif' }} axisLine={false} tickLine={false}
              tickFormatter={(label: string) => {
                if (granularidad === 'diaria') {
                  // "02 jun" o "2 de jun" → "2"
                  const m = label.match(/\d+/)
                  return m ? String(Number(m[0])) : label
                }
                if (granularidad === 'mensual') {
                  // "ene 26" / "ene de 26" → "ene"
                  return label.split(/\s|\bde\b/).filter(Boolean)[0] ?? label
                }
                return label
              }}
            />
            <YAxis tick={{ fill: tickColor, fontSize: 11, fontFamily: 'Poppins, system-ui, sans-serif' }} axisLine={false} tickLine={false}
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
              fill="url(#gradIngresosMensuales)" dot={false} activeDot={{ r: 5, fill: primary, strokeWidth: 0 }} connectNulls={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* ── Mini-KPIs ───────────────────────────────────────────────────── */}
      {temaListo && !isLoading && puntos.length > 0 && (
        <div className="grid grid-cols-4 gap-0 pt-3 border-t border-outline-variant divide-x divide-outline-variant">
          <Kpi label={usaRango ? 'Total período' : 'Total 6 meses'} value={fmtCompact(total)} />
          <Kpi label={granularidad === 'horaria' ? 'Mejor hora' : granularidad === 'diaria' ? 'Mejor día' : 'Mejor mes'} value={fmtCompact(mejor.ingresos ?? 0)} sub={mejor.label} />
          <Kpi label={granularidad === 'horaria' ? 'Promedio horario' : granularidad === 'diaria' ? 'Promedio diario' : 'Promedio mensual'} value={fmtCompact(promedio)} />
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
