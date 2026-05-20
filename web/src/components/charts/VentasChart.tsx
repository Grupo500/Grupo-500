'use client'


import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { useTheme } from 'next-themes'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { createClientFetcher } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { cn } from '@/lib/utils'

type Periodo = 'diario' | 'semanal' | 'mensual'

function Skeleton() {
  return (
    <div className="card p-5 h-64 animate-pulse">
      <div className="h-4 w-36 bg-[var(--surface-high)] rounded-md mb-4" />
      <div className="h-full bg-[var(--surface-high)] rounded-xl" style={{ height: '75%' }} />
    </div>
  )
}

export function VentasChart({ periodo }: { periodo: Periodo }) {
  const { getToken } = useAuth()
  const { resolvedTheme: theme } = useTheme()
  const isDark = theme === 'dark'

  const primary       = isDark ? '#95daff' : '#1a7de0'
  const gridColor     = isDark ? 'rgba(149,218,255,0.06)' : 'rgba(0,48,96,0.06)'
  const tickColor     = isDark ? '#95c8f0' : '#2a4172'
  const tooltipBg     = isDark ? '#0f1e35' : '#ffffff'
  const tooltipBorder = isDark ? 'rgba(149,218,255,0.12)' : 'rgba(0,48,96,0.10)'
  const labelColor    = isDark ? '#d6eaff' : '#001d3d'

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ventas-grafica', periodo],
    queryFn: async () => {
      const token = await getToken()
      return createClientFetcher(token ?? '')(`/reportes/ventas-grafica?periodo=${periodo}`) as Promise<{
        data: { puntos: { label: string; ingresos: number; pagos: number }[]; variacion: number; actual: number; anterior: number }
      }>
    },
    staleTime: 60_000,
  })

  if (isLoading) return <Skeleton />

  const puntos    = data?.data?.puntos    ?? []
  const variacion = data?.data?.variacion ?? 0
  const actual    = data?.data?.actual    ?? 0

  const labelPeriodo = periodo === 'diario' ? 'vs día anterior' : periodo === 'semanal' ? 'vs semana anterior' : 'vs mes anterior'

  return (
    <div className="card p-5 h-64">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[15px] font-semibold text-on-surface">Ventas</h3>
      </div>

      {/* Variación */}
      <div className="mb-3 h-5 flex justify-end">
        {actual > 0 && (
          <div className={cn(
            'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full',
            variacion > 0
              ? 'text-[#16a34a] bg-[#16a34a]/10 border border-[#16a34a]/20'
              : variacion < 0
                ? 'text-[var(--error)] bg-[var(--error-container)] border border-[var(--error)]/20'
                : 'text-on-surface-variant bg-[var(--surface-high)]',
          )}>
            {variacion > 0
              ? <TrendingUp  className="w-3 h-3" />
              : variacion < 0
                ? <TrendingDown className="w-3 h-3" />
                : <Minus className="w-3 h-3" />}
            <span>{variacion > 0 ? '+' : ''}{variacion}%</span>
            <span className="font-normal opacity-70">{labelPeriodo}</span>
          </div>
        )}
      </div>

      {/* Chart */}
      {isError || puntos.length === 0 ? (
        <div className="flex items-center justify-center h-[75%] text-[13px] text-on-surface-variant">
          Sin datos para este período
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="82%">
          <AreaChart data={puntos} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={primary} stopOpacity={0.25} />
                <stop offset="100%" stopColor={primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: tickColor, fontSize: 11, fontFamily: 'Inter' }}
              axisLine={false} tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: tickColor, fontSize: 11, fontFamily: 'Inter' }}
              axisLine={false} tickLine={false}
              tickFormatter={(v) => v >= 1_000_000
                ? `$${(v / 1_000_000).toFixed(1)}M`
                : v >= 1_000
                  ? `$${(v / 1_000).toFixed(0)}K`
                  : `$${v}`}
            />
            <Tooltip
              contentStyle={{
                background: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: 10,
                boxShadow: '0 4px 16px rgba(0,48,96,0.10)',
                padding: '10px 14px',
              }}
              labelStyle={{ color: labelColor, fontWeight: 600, fontSize: 13, marginBottom: 4 }}
              formatter={(value: number, _: string, entry: any) => [
                `${formatCOP(value)}  ·  ${entry.payload.pagos} pago${entry.payload.pagos !== 1 ? 's' : ''}`,
                'Ingresos',
              ]}
              itemStyle={{ color: primary, fontSize: 13 }}
            />
            <Area
              type="monotone"
              dataKey="ingresos"
              stroke={primary}
              strokeWidth={2.5}
              fill="url(#gradVentas)"
              dot={false}
              activeDot={{ r: 5, fill: primary, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
