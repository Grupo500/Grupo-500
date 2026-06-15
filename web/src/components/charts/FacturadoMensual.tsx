'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { apiFetch } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface Punto { label: string; ventaTotal: number }
interface PeriodoResp { totales: { ventaTotal: number }; puntos: Punto[] }

function toISO(d: Date) { return format(d, 'yyyy-MM-dd') }
function fmtCompact(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

export function FacturadoMensual() {
  const { resolvedTheme: theme } = useTheme()
  const isDark    = theme === 'dark'
  const temaListo = theme !== undefined

  const now           = new Date()
  const inicioActual  = toISO(startOfMonth(now))
  const finActual     = toISO(endOfMonth(now))
  const mesAnterior   = subMonths(now, 1)
  const inicioAnt     = toISO(startOfMonth(mesAnterior))
  const finAnt        = toISO(endOfMonth(mesAnterior))

  const color   = isDark ? '#95daff' : '#1a7de0'
  const sombra  = isDark ? 'rgba(148,167,190,0.45)' : 'rgba(100,116,139,0.40)'
  const tickFill = { fill: isDark ? '#95c8f0' : '#2a4172', fontSize: 10, fontFamily: 'Inter' }

  const { data: actualData, isLoading: la } = useQuery({
    queryKey: ['financiero-periodo', inicioActual, finActual],
    queryFn: async () => apiFetch(`/reportes/financiero-periodo?desde=${inicioActual}&hasta=${finActual}`) as Promise<{ data: PeriodoResp }>,
    staleTime: 30_000,
  })
  const { data: antData, isLoading: lp } = useQuery({
    queryKey: ['financiero-periodo', inicioAnt, finAnt],
    queryFn: async () => apiFetch(`/reportes/financiero-periodo?desde=${inicioAnt}&hasta=${finAnt}`) as Promise<{ data: PeriodoResp }>,
    staleTime: 30_000,
  })

  const isLoading = la || lp
  const totalActual = actualData?.data?.totales?.ventaTotal ?? 0
  const totalAnt    = antData?.data?.totales?.ventaTotal ?? 0
  const variacion   = totalAnt > 0 ? Math.round(((totalActual - totalAnt) / totalAnt) * 100) : null

  // Fusionar por día del mes (índice): actual (frente) + anterior (sombra)
  const puntos = useMemo(() => {
    const act = actualData?.data?.puntos ?? []
    const ant = antData?.data?.puntos ?? []
    const n = Math.max(act.length, ant.length)
    return Array.from({ length: n }, (_, i) => ({
      label: String(i + 1),
      actual: act[i]?.ventaTotal ?? null,
      anterior: ant[i]?.ventaTotal ?? 0,
    }))
  }, [actualData, antData])

  const mesLabel = format(now, 'MMMM', { locale: es })

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Título + mes */}
        <p className="text-[13px] font-semibold text-on-surface whitespace-nowrap">Total facturado</p>
        <p className="text-[11px] text-on-surface-variant capitalize whitespace-nowrap">{mesLabel}</p>
        {/* Leyenda — centro */}
        <div className="flex items-center gap-3 text-[10px] text-on-surface-variant flex-1 justify-center">
          <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: color }} /> Mes actual</span>
          <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: sombra }} /> Mes anterior</span>
        </div>
        {/* Total */}
        <div className="text-right ml-auto">
          {isLoading ? (
            <div className="h-6 w-24 rounded bg-[var(--surface-high)] animate-pulse" />
          ) : (
            <>
              <p className="text-[20px] font-bold tabular-nums leading-none" style={{ color }}>{fmtCompact(totalActual)}</p>
              {variacion !== null && (
                <p className="mt-1 text-[11px] font-semibold flex items-center justify-end gap-0.5"
                  style={{ color: variacion >= 0 ? '#16a34a' : '#dc2626' }}>
                  {variacion >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {variacion >= 0 ? '+' : ''}{variacion}% vs mes anterior
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {!temaListo || isLoading ? (
        <div className="h-64 rounded-xl bg-[var(--surface-high)] animate-pulse" />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={puntos} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="gradFactActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.24} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} vertical={false} />
            <XAxis dataKey="label" tick={tickFill} axisLine={false} tickLine={false} interval={1} minTickGap={4} />
            <YAxis tick={tickFill} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v/1_000).toFixed(0)}K` : `$${v}`} />
            <Tooltip
              contentStyle={{ background: isDark ? '#0f1e35' : '#fff', border: `1px solid ${isDark ? 'rgba(149,218,255,0.12)' : 'rgba(0,48,96,0.10)'}`, borderRadius: 10, fontSize: 12 }}
              labelFormatter={(l) => `Día ${l}`}
              formatter={(v: number, name) => [formatCOP(v), name === 'actual' ? 'Mes actual' : 'Mes anterior']}
            />
            {/* Sombra del mes anterior (detrás) */}
            <Area type="monotone" dataKey="anterior" stroke={sombra} strokeWidth={1.5} strokeDasharray="4 3"
              fill={sombra} fillOpacity={0.12} dot={false} />
            {/* Mes actual (frente) */}
            <Area type="monotone" dataKey="actual" stroke={color} strokeWidth={2.5}
              fill="url(#gradFactActual)" dot={false} activeDot={{ r: 5, fill: color, strokeWidth: 0 }} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
