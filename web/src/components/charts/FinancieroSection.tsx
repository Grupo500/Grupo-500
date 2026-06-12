'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { apiFetch } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { TrendingUp, Wallet, Clock, AlertTriangle } from 'lucide-react'

// ── Tipos ──────────────────────────────────────────────────────────────────
type Metrica = 'ventaTotal' | 'recaudo' | 'porCobrar' | 'mora'

interface Punto       { label: string; ventaTotal: number; recaudo: number; porCobrar: number; mora: number }
interface Totales     { ventaTotal: number; recaudo: number; porCobrar: number; mora: number }
interface Variaciones { ventaTotal: number | null; recaudo: number | null; porCobrar: number | null; mora: number | null }
interface Props       { desde: string; hasta: string }

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
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased    = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(target * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }
    const raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, enabled, duration])
  return current
}

function AnimatedValue({ value, isLoading, color }: { value: number; isLoading: boolean; color: string }) {
  const animated = useCountUp(value, !isLoading)
  if (isLoading) return <div className="h-6 w-16 bg-[var(--surface-high)] rounded animate-pulse" />
  return (
    <p className="text-[16px] sm:text-[19px] font-bold tabular-nums leading-tight" style={{ color, transition: 'color 200ms' }}>
      {fmtCompact(animated)}
    </p>
  )
}

function ChartSkeleton() {
  return <div className="h-44 rounded-xl bg-[var(--surface-high)] animate-pulse" />
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

// ── Componente principal ────────────────────────────────────────────────────
export function FinancieroSection({ desde, hasta }: Props) {
  const [selected, setSelected] = useState<Metrica>('ventaTotal')
  const { resolvedTheme: theme } = useTheme()
  const isDark                   = theme === 'dark'
  const temaListo                = theme !== undefined

  const { data, isLoading } = useQuery({
    queryKey: ['financiero-periodo', desde, hasta],
    queryFn: async () => {
      return apiFetch(`/reportes/financiero-periodo?desde=${desde}&hasta=${hasta}`) as Promise<{
        data: { totales: Totales; variaciones: Variaciones; puntos: Punto[] }
      }>
    },
    staleTime: 30_000,
  })

  const totales     = data?.data?.totales     ?? { ventaTotal: 0, recaudo: 0, porCobrar: 0, mora: 0 }
  const variaciones = data?.data?.variaciones ?? { ventaTotal: null, recaudo: null, porCobrar: null, mora: null } as Variaciones
  const puntos      = data?.data?.puntos      ?? []

  const metric = METRICS.find(m => m.key === selected)!
  const color  = isDark ? metric.colorDark : metric.colorLight

  // Label del período
  const fmt = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
  const periodoLabel = desde === hasta
    ? fmt(desde)
    : `${fmt(desde)} – ${fmt(hasta)}`

  return (
    <div className="space-y-3">

      {/* Label período */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[12px] font-semibold text-on-surface uppercase tracking-wide">
          {periodoLabel}
        </p>
        <span className="text-[11px] text-on-surface-variant">Período en curso</span>
      </div>

      {/* ── 4 tarjetas — snapshot del período ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {METRICS.map((m, idx) => {
          const isSelected = selected === m.key
          const val        = totales[m.key]
          const v          = variaciones[m.key]
          const c          = isDark ? m.colorDark : m.colorLight
          const Icon       = m.Icon
          const positive   = (v ?? 0) >= 0

          return (
            <button
              key={m.key}
              onClick={() => setSelected(m.key)}
              className="relative overflow-hidden rounded-2xl p-3.5 text-left focus:outline-none cursor-pointer"
              style={{
                background: isSelected
                  ? `linear-gradient(135deg, ${c}28 0%, ${c}14 100%), var(--surface-lowest)`
                  : 'var(--surface-lowest)',
                border:      `1.5px solid ${isSelected ? c : 'var(--outline-variant)'}`,
                boxShadow:   isSelected ? `0 4px 24px ${c}28, 0 0 0 1px ${c}18` : '0 1px 4px rgba(0,0,0,0.04)',
                transform:   isSelected ? 'scale(1.015)' : 'scale(1)',
                transition:  `all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
                transitionDelay: `${idx * 20}ms`,
              }}
            >
              {/* Ícono + label */}
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${c}18` }}>
                  {isLoading
                    ? <div className="w-4 h-4 rounded bg-[var(--surface-high)] animate-pulse" />
                    : <Icon className="w-4 h-4" style={{ color: c }} />}
                </div>
                {isLoading
                  ? <div className="h-3 w-20 rounded bg-[var(--surface-high)] animate-pulse flex-1" />
                  : <p className="text-[12px] sm:text-[13px] font-semibold text-on-surface leading-tight flex-1">{m.label}</p>}
              </div>

              {/* Valor animado */}
              <AnimatedValue value={val} isLoading={isLoading} color={isSelected ? c : 'var(--on-surface)'} />

              {/* Variación vs período anterior */}
              {isLoading ? (
                <div className="h-3 w-16 rounded bg-[var(--surface-high)] animate-pulse mt-1.5" />
              ) : v !== null ? (
                <p className="mt-1 text-[10px] font-semibold leading-tight flex items-center gap-0.5"
                  style={{ color: positive ? '#16a34a' : '#dc2626' }}>
                  {positive ? '▲' : '▼'} {positive ? '+' : ''}{v}% vs anterior
                </p>
              ) : (
                <p className="mt-0.5 text-[10px] text-on-surface-variant/50 leading-tight">{m.sublabel}</p>
              )}

              {/* Punto selector activo */}
              <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full"
                style={{ background: c, opacity: isSelected ? 1 : 0, transform: isSelected ? 'scale(1)' : 'scale(0)', transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              />
            </button>
          )
        })}
      </div>

      {/* ── Gráfica de tendencia ────────────────────────────────────────────── */}
      <div className="rounded-2xl p-4"
        style={{
          border:     `1.5px solid ${color}20`,
          background: isDark ? 'var(--surface-lowest)' : '#fff',
          boxShadow:  `0 2px 20px ${color}12`,
          transition: 'border-color 300ms, box-shadow 300ms',
        }}
      >
        <p className="text-[13px] font-semibold text-on-surface mb-3" style={{ transition: 'color 300ms' }}>
          Tendencia · <span style={{ color }}>{metric.label}</span>
        </p>
        {!temaListo || isLoading ? <ChartSkeleton /> : puntos.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-[13px] text-on-surface-variant">Sin datos</div>
        ) : (
          <ResponsiveContainer width="100%" height={176}>
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
      </div>
    </div>
  )
}

