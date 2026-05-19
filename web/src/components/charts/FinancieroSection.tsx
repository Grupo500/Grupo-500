'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { useTheme } from 'next-themes'
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { createClientFetcher } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { TrendingUp, Wallet, Clock, AlertTriangle } from 'lucide-react'

// ── Tipos ──────────────────────────────────────────────────────────────────
type Metrica = 'ventaTotal' | 'recaudo' | 'porCobrar' | 'mora'
type Periodo = 'diario' | 'semanal' | 'mensual'

interface Punto       { label: string; ventaTotal: number; recaudo: number; porCobrar: number; mora: number }
interface Totales     { ventaTotal: number; recaudo: number; porCobrar: number; mora: number }
interface Variaciones { ventaTotal: number | null; recaudo: number | null; porCobrar: number | null; mora: number | null }
interface Props       { periodo: Periodo }

// ── Config de métricas ──────────────────────────────────────────────────────
const METRICS = [
  { key: 'ventaTotal' as Metrica, label: 'Total facturado', sublabel: 'Registrado en el período', Icon: TrendingUp,    colorLight: '#1a7de0', colorDark: '#95daff' },
  { key: 'recaudo'    as Metrica, label: 'Recaudado',        sublabel: 'Efectivamente cobrado',    Icon: Wallet,        colorLight: '#16a34a', colorDark: '#6ee7b7' },
  { key: 'porCobrar'  as Metrica, label: 'Por cobrar',       sublabel: 'Pendiente sin vencer',     Icon: Clock,         colorLight: '#d97706', colorDark: '#fbbf24' },
  { key: 'mora'       as Metrica, label: 'En mora',          sublabel: 'Vencido sin pagar',        Icon: AlertTriangle, colorLight: '#dc2626', colorDark: '#f87171' },
]

function fmtCompact(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

// ── Count-up animado ────────────────────────────────────────────────────────
function useCountUp(target: number, enabled: boolean, duration = 900) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!enabled || target === 0) { setCurrent(target); return }

    const startTime = performance.now()
    const startVal  = 0

    const tick = (now: number) => {
      const elapsed  = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(startVal + (target - startVal) * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }

    const raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, enabled, duration])

  return current
}

function AnimatedValue({ value, isLoading, color }: { value: number; isLoading: boolean; color: string }) {
  const animated = useCountUp(value, !isLoading)

  if (isLoading) {
    return <div className="h-6 w-16 bg-[var(--surface-high)] rounded animate-pulse" />
  }

  return (
    <p
      className="text-[16px] sm:text-[19px] font-bold tabular-nums leading-tight"
      style={{ color, transition: 'color 200ms' }}
    >
      {fmtCompact(animated)}
    </p>
  )
}

function ChartSkeleton() {
  return <div className="h-48 rounded-xl bg-[var(--surface-high)] animate-pulse" />
}

function CustomTooltip({ active, payload, label, color }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--surface-lowest)] border border-[var(--outline-variant)] rounded-xl shadow-float px-4 py-2.5 text-[12px]">
      <p className="font-semibold text-on-surface mb-1">{label}</p>
      <p className="font-bold" style={{ color }}>{formatCOP(payload[0]?.value ?? 0)}</p>
    </div>
  )
}

function PctBar({ pct, color, label, value }: { pct: number; color: string; label: string; value: number }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 150)
    return () => clearTimeout(t)
  }, [pct])

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="font-medium text-on-surface-variant">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="tabular-nums font-semibold text-on-surface">{fmtCompact(value)}</span>
          <span className="tabular-nums text-on-surface-variant w-8 text-right">{pct}%</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-[var(--surface-high)] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${width}%`, background: color, transition: 'width 600ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        />
      </div>
    </div>
  )
}

// ── Componente principal ────────────────────────────────────────────────────
export function FinancieroSection({ periodo }: Props) {
  const [selected, setSelected] = useState<Metrica>('ventaTotal')
  const { getToken } = useAuth()
  const { theme }    = useTheme()
  const isDark       = theme === 'dark'

  const { data, isLoading } = useQuery({
    queryKey: ['financiero-periodo', periodo],
    queryFn: async () => {
      const token = await getToken()
      return createClientFetcher(token ?? '')(`/reportes/financiero-periodo?periodo=${periodo}`) as Promise<{
        data: { totales: Totales; variaciones: Variaciones; puntos: Punto[] }
      }>
    },
    staleTime: 60_000,
  })

  const totales     = data?.data?.totales     ?? { ventaTotal: 0, recaudo: 0, porCobrar: 0, mora: 0 }
  const variaciones = data?.data?.variaciones ?? { ventaTotal: null, recaudo: null, porCobrar: null, mora: null } as Variaciones
  const puntos      = data?.data?.puntos      ?? []
  const base        = totales.ventaTotal || 1

  const metric = METRICS.find(m => m.key === selected)!
  const color  = isDark ? metric.colorDark : metric.colorLight

  const last  = puntos[puntos.length - 1]?.[selected] ?? 0
  const prev  = puntos[puntos.length - 2]?.[selected] ?? 0
  const delta = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0

  // Label del período
  const now = new Date()
  const periodoLabel = periodo === 'diario'
    ? `Hoy, ${now.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}`
    : periodo === 'semanal'
    ? 'Esta semana'
    : now.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-3">

      {/* Label período */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[12px] font-semibold text-on-surface uppercase tracking-wide">
          {periodoLabel}
        </p>
        <span className="text-[11px] text-on-surface-variant">Período en curso</span>
      </div>

      {/* ── 4 tarjetas ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {METRICS.map((m, idx) => {
          const isSelected = selected === m.key
          const val  = totales[m.key]
          const c    = isDark ? m.colorDark : m.colorLight
          const Icon = m.Icon

          return (
            <button
              key={m.key}
              onClick={() => setSelected(m.key)}
              className="relative overflow-hidden rounded-2xl p-3.5 text-left focus:outline-none"
              style={{
                background: isSelected
                  ? `linear-gradient(135deg, ${c}28 0%, ${c}14 100%), var(--surface-lowest)`
                  : 'var(--surface-lowest)',
                border: `1.5px solid ${isSelected ? c : 'var(--outline-variant)'}`,
                boxShadow: isSelected ? `0 4px 24px ${c}28, 0 0 0 1px ${c}18` : '0 1px 4px rgba(0,0,0,0.04)',
                transform: isSelected ? 'scale(1.015)' : 'scale(1)',
                transition: `all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
                transitionDelay: `${idx * 20}ms`,
              }}
            >
              {/* Ícono + título */}
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${c}18` }}>
                  <Icon className="w-4 h-4" style={{ color: c }} />
                </div>
                <p className="text-[12px] sm:text-[13px] font-semibold text-on-surface leading-tight flex-1">{m.label}</p>
              </div>

              {/* Valor con count-up */}
              <AnimatedValue
                value={val}
                isLoading={isLoading}
                color={isSelected ? c : 'var(--on-surface)'}
              />

              {/* Variación vs período anterior */}
              {(() => {
                const v = variaciones[m.key]
                if (isLoading || v === null) return (
                  <p className="mt-0.5 text-[10px] text-on-surface-variant/60 leading-tight hidden sm:block">{m.sublabel}</p>
                )
                const positive = v >= 0
                return (
                  <p className="mt-1 text-[10px] font-semibold leading-tight hidden sm:flex items-center gap-0.5"
                    style={{ color: positive ? '#16a34a' : '#dc2626' }}>
                    {positive ? '▲' : '▼'} {positive ? '+' : ''}{v}% vs anterior
                  </p>
                )
              })()}

              {/* Punto indicador */}
              <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full"
                style={{ background: c, opacity: isSelected ? 1 : 0, transform: isSelected ? 'scale(1)' : 'scale(0)', transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              />
            </button>
          )
        })}
      </div>

      {/* ── Gráfica + distribución ──────────────────────────────────────────── */}
      <div className="rounded-2xl p-4"
        style={{ border: `1.5px solid ${color}20`, background: isDark ? 'var(--surface-lowest)' : '#fff', boxShadow: `0 2px 20px ${color}12`, transition: 'border-color 300ms, box-shadow 300ms' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[13px] font-semibold text-on-surface">{metric.label}</p>
            <p className="text-[11px] text-on-surface-variant">{metric.sublabel}</p>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ color, background: `${color}15`, transition: 'all 300ms' }}>
            {delta > 0 ? '+' : ''}{delta}% vs anterior
          </span>
        </div>

        {/* Chart */}
        {isLoading ? <ChartSkeleton /> : puntos.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-[13px] text-on-surface-variant">Sin datos</div>
        ) : (
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={puntos} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-fin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={color} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: isDark ? '#95c8f0' : '#2a4172', fontSize: 10, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: isDark ? '#95c8f0' : '#2a4172', fontSize: 10, fontFamily: 'Inter' }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v/1_000).toFixed(0)}K` : `$${v}`} />
              <Tooltip content={<CustomTooltip color={color} />} />
              <Area key={selected} type="monotone" dataKey={selected} stroke={color} strokeWidth={2.5}
                fill="url(#grad-fin)" dot={false} activeDot={{ r: 5, fill: color, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {/* Distribución */}
        <div className="mt-4 pt-4 border-t border-[var(--outline-variant)]/40 space-y-3">
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">Distribución</p>
          {METRICS.map(m => {
            const c   = isDark ? m.colorDark : m.colorLight
            const val = totales[m.key]
            const pct = Math.round((val / base) * 100)
            return <PctBar key={m.key} pct={pct} color={c} label={m.label} value={val} />
          })}
        </div>
      </div>
    </div>
  )
}
