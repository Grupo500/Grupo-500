'use client'

import { useState } from 'react'
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
const METRICS: {
  key: Metrica
  label: string
  sublabel: string
  Icon: React.ElementType
  colorLight: string
  colorDark: string
  gradStart: string
}[] = [
  {
    key:        'ventaTotal',
    label:      'Venta total',
    sublabel:   'Total registrado',
    Icon:       TrendingUp,
    colorLight: '#1a7de0',
    colorDark:  '#95daff',
    gradStart:  'rgba(26,125,224,0.18)',
  },
  {
    key:        'recaudo',
    label:      'Recaudo',
    sublabel:   'Efectivamente cobrado',
    Icon:       Wallet,
    colorLight: '#16a34a',
    colorDark:  '#6ee7b7',
    gradStart:  'rgba(22,163,74,0.18)',
  },
  {
    key:        'saldo',
    label:      'Saldo',
    sublabel:   'Pendiente + vencido',
    Icon:       AlertTriangle,
    colorLight: '#d97706',
    colorDark:  '#fbbf24',
    gradStart:  'rgba(217,119,6,0.18)',
  },
]

// ── Formato compacto para COP ───────────────────────────────────────────────
function fmtCompact(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

// ── Skeleton del chart ──────────────────────────────────────────────────────
function ChartSkeleton() {
  return (
    <div className="h-52 rounded-xl bg-[var(--surface-high)] animate-pulse" />
  )
}

// ── Tooltip personalizado ───────────────────────────────────────────────────
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
export function FinancieroSection({ ventaTotal, recaudo, saldo }: Props) {
  const [selected, setSelected] = useState<Metrica>('ventaTotal')
  const { getToken } = useAuth()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const { data: chartData, isLoading } = useQuery({
    queryKey: ['financiero-mensual'],
    queryFn: async () => {
      const token = await getToken()
      return createClientFetcher(token ?? '')('/reportes/financiero') as Promise<{ data: Punto[] }>
    },
    staleTime: 5 * 60_000,
  })

  const puntos = chartData?.data ?? []
  const totales: Record<Metrica, number> = { ventaTotal, recaudo, saldo }
  const base = ventaTotal || 1

  const metric  = METRICS.find(m => m.key === selected)!
  const color   = isDark ? metric.colorDark : metric.colorLight

  // Variación mes actual vs anterior en el chart
  const last  = puntos[puntos.length - 1]?.[selected] ?? 0
  const prev  = puntos[puntos.length - 2]?.[selected] ?? 0
  const delta = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0

  return (
    <div className="space-y-3">

      {/* ── 3 tarjetas ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2.5">
        {METRICS.map(m => {
          const isSelected = selected === m.key
          const val  = totales[m.key]
          const pct  = Math.round((val / base) * 100)
          const c    = isDark ? m.colorDark : m.colorLight
          const Icon = m.Icon

          return (
            <button
              key={m.key}
              onClick={() => setSelected(m.key)}
              className="relative overflow-hidden rounded-2xl p-3.5 text-left transition-all duration-200 focus:outline-none"
              style={{
                background: isSelected
                  ? `linear-gradient(135deg, ${c}22 0%, ${c}10 100%)`
                  : 'var(--surface-lowest)',
                border: `1.5px solid ${isSelected ? c : 'var(--outline-variant)'}`,
                boxShadow: isSelected
                  ? `0 4px 20px ${c}22, 0 0 0 1px ${c}18`
                  : '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              {/* Ícono */}
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center mb-2.5"
                style={{ background: `${c}18` }}
              >
                <Icon className="w-4 h-4" style={{ color: c }} />
              </div>

              {/* Valor */}
              <p
                className="text-[15px] sm:text-[17px] font-bold tabular-nums leading-tight"
                style={{ color: isSelected ? c : 'var(--on-surface)' }}
              >
                {fmtCompact(val)}
              </p>

              {/* Label */}
              <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-on-surface-variant leading-tight">
                {m.label}
              </p>

              {/* Barra de progreso */}
              <div className="mt-2.5 h-1 rounded-full bg-[var(--surface-high)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: c, opacity: isSelected ? 1 : 0.45 }}
                />
              </div>

              {/* Indicador seleccionado */}
              {isSelected && (
                <div
                  className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full"
                  style={{ background: c }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Gráfica del métrico seleccionado ────────────────────────────── */}
      <div
        className="rounded-2xl p-4 transition-all duration-300"
        style={{
          border: `1.5px solid ${color}20`,
          background: isDark ? 'var(--surface-lowest)' : '#fff',
          boxShadow: `0 2px 16px ${color}10`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[13px] font-semibold text-on-surface">{metric.label}</p>
            <p className="text-[11px] text-on-surface-variant">{metric.sublabel}</p>
          </div>
          {puntos.length > 1 && (
            <span
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{
                color,
                background: `${color}15`,
              }}
            >
              {delta > 0 ? '+' : ''}{delta}% vs mes ant.
            </span>
          )}
        </div>

        {/* Chart */}
        {isLoading ? (
          <ChartSkeleton />
        ) : puntos.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-[13px] text-on-surface-variant">
            Sin datos disponibles
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={puntos} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${selected}`} x1="0" y1="0" x2="0" y2="1">
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
                fill={`url(#grad-${selected})`}
                dot={false}
                activeDot={{ r: 5, fill: color, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
