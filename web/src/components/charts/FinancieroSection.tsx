'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { useTheme } from 'next-themes'
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { createClientFetcher } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { TrendingUp, Wallet, AlertTriangle } from 'lucide-react'

// ── Tipos ──────────────────────────────────────────────────────────────────
type Metrica = 'ventaTotal' | 'recaudo' | 'saldo'
interface Punto { label: string; ventaTotal: number; recaudo: number; saldo: number }
interface Props { ventaTotal: number; recaudo: number; saldo: number }

// ── Config de métricas ──────────────────────────────────────────────────────
const METRICS = [
  {
    key:        'ventaTotal' as Metrica,
    label:      'Venta total',
    sublabel:   'Total registrado',
    Icon:       TrendingUp,
    colorLight: '#1a7de0',
    colorDark:  '#95daff',
  },
  {
    key:        'recaudo' as Metrica,
    label:      'Recaudo',
    sublabel:   'Efectivamente cobrado',
    Icon:       Wallet,
    colorLight: '#16a34a',
    colorDark:  '#6ee7b7',
  },
  {
    key:        'saldo' as Metrica,
    label:      'Saldo',
    sublabel:   'Pendiente + vencido',
    Icon:       AlertTriangle,
    colorLight: '#d97706',
    colorDark:  '#fbbf24',
  },
]

function fmtCompact(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${n}`
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

// ── Barra de porcentaje animada ─────────────────────────────────────────────
function PctBar({ pct, color, label, value, animate }: {
  pct: number; color: string; label: string; value: number; animate: boolean
}) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setWidth(animate ? pct : pct), animate ? 80 : 0)
    return () => clearTimeout(t)
  }, [pct, animate])

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: color }} />
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
          style={{
            width: `${width}%`,
            background: color,
            transition: 'width 600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      </div>
    </div>
  )
}

// ── Componente principal ────────────────────────────────────────────────────
export function FinancieroSection({ ventaTotal, recaudo, saldo }: Props) {
  const [selected, setSelected]   = useState<Metrica>('ventaTotal')
  const [visible,  setVisible]    = useState(false)
  const [pctReady, setPctReady]   = useState(false)
  const prevSelected = useRef<Metrica>('ventaTotal')

  const { getToken } = useAuth()
  const { theme }    = useTheme()
  const isDark       = theme === 'dark'

  // Fade-in al montar
  useEffect(() => { const t = setTimeout(() => setVisible(true), 50); return () => clearTimeout(t) }, [])
  // Animar barras al montar
  useEffect(() => { const t = setTimeout(() => setPctReady(true), 200); return () => clearTimeout(t) }, [])

  const { data: chartData, isLoading } = useQuery({
    queryKey: ['financiero-mensual'],
    queryFn: async () => {
      const token = await getToken()
      return createClientFetcher(token ?? '')('/reportes/financiero') as Promise<{ data: Punto[] }>
    },
    staleTime: 5 * 60_000,
  })

  const puntos  = chartData?.data ?? []
  const totales: Record<Metrica, number> = { ventaTotal, recaudo, saldo }
  const base    = ventaTotal || 1

  const metric = METRICS.find(m => m.key === selected)!
  const color  = isDark ? metric.colorDark : metric.colorLight

  const last  = puntos[puntos.length - 1]?.[selected] ?? 0
  const prev  = puntos[puntos.length - 2]?.[selected] ?? 0
  const delta = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0

  const handleSelect = (key: Metrica) => {
    prevSelected.current = selected
    setSelected(key)
  }

  return (
    <div
      className="space-y-3"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(8px)', transition: 'opacity 400ms ease, transform 400ms ease' }}
    >
      {/* ── 3 tarjetas ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2.5">
        {METRICS.map((m, idx) => {
          const isSelected = selected === m.key
          const val  = totales[m.key]
          const c    = isDark ? m.colorDark : m.colorLight
          const Icon = m.Icon

          return (
            <button
              key={m.key}
              onClick={() => handleSelect(m.key)}
              className="relative overflow-hidden rounded-2xl p-3.5 text-left focus:outline-none"
              style={{
                background: isSelected
                  ? `linear-gradient(135deg, ${c}20 0%, ${c}0c 100%)`
                  : 'var(--surface-lowest)',
                border: `1.5px solid ${isSelected ? c : 'var(--outline-variant)'}`,
                boxShadow: isSelected
                  ? `0 4px 24px ${c}28, 0 0 0 1px ${c}18`
                  : '0 1px 4px rgba(0,0,0,0.04)',
                transform: isSelected ? 'scale(1.015)' : 'scale(1)',
                transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                transitionDelay: `${idx * 30}ms`,
              }}
            >
              {/* Ícono + título */}
              <div className="flex items-center gap-2 mb-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${c}18`, transition: 'background 200ms' }}
                >
                  <Icon className="w-4 h-4" style={{ color: c }} />
                </div>
                <p className="text-[12px] sm:text-[13px] font-semibold text-on-surface leading-tight">
                  {m.label}
                </p>
              </div>

              {/* Valor */}
              <p
                className="text-[16px] sm:text-[19px] font-bold tabular-nums leading-tight"
                style={{
                  color: isSelected ? c : 'var(--on-surface)',
                  transition: 'color 200ms',
                }}
              >
                {fmtCompact(val)}
              </p>

              {/* Sublabel — solo desktop */}
              <p className="mt-0.5 text-[10px] text-on-surface-variant/60 leading-tight hidden sm:block">
                {m.sublabel}
              </p>

              {/* Punto indicador seleccionado */}
              <div
                className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full"
                style={{
                  background: c,
                  opacity: isSelected ? 1 : 0,
                  transform: isSelected ? 'scale(1)' : 'scale(0)',
                  transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              />
            </button>
          )
        })}
      </div>

      {/* ── Gráfica + barras de distribución ────────────────────────────── */}
      <div
        className="rounded-2xl p-4"
        style={{
          border: `1.5px solid ${color}20`,
          background: isDark ? 'var(--surface-lowest)' : '#fff',
          boxShadow: `0 2px 20px ${color}12`,
          transition: 'border-color 300ms, box-shadow 300ms',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div
            style={{ transition: 'opacity 200ms' }}
          >
            <p className="text-[13px] font-semibold text-on-surface">{metric.label}</p>
            <p className="text-[11px] text-on-surface-variant">{metric.sublabel}</p>
          </div>
          <span
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ color, background: `${color}15`, transition: 'all 300ms' }}
          >
            {delta > 0 ? '+' : ''}{delta}% vs mes ant.
          </span>
        </div>

        {/* Chart */}
        {isLoading ? (
          <ChartSkeleton />
        ) : puntos.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-[13px] text-on-surface-variant">
            Sin datos disponibles
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={puntos} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-fin`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={color} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: isDark ? '#95c8f0' : '#2a4172', fontSize: 10, fontFamily: 'Inter' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fill: isDark ? '#95c8f0' : '#2a4172', fontSize: 10, fontFamily: 'Inter' }}
                axisLine={false} tickLine={false}
                tickFormatter={v =>
                  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M`
                  : v >= 1_000   ? `$${(v / 1_000).toFixed(0)}K`
                  : `$${v}`
                }
              />
              <Tooltip content={<CustomTooltip color={color} />} />
              <Area
                key={selected}
                type="monotone"
                dataKey={selected}
                stroke={color}
                strokeWidth={2.5}
                fill="url(#grad-fin)"
                dot={false}
                activeDot={{ r: 5, fill: color, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {/* ── Barras de distribución (3 métricas juntas) ─────────────── */}
        <div className="mt-4 pt-4 border-t border-[var(--outline-variant)]/40 space-y-3">
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-2">
            Distribución
          </p>
          {METRICS.map(m => {
            const c   = isDark ? m.colorDark : m.colorLight
            const val = totales[m.key]
            const pct = Math.round((val / base) * 100)
            return (
              <PctBar
                key={m.key}
                pct={pct}
                color={c}
                label={m.label}
                value={val}
                animate={pctReady}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
