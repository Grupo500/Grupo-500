'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'
import { apiFetch } from '@/lib/api'
import { Users, TrendingUp, TrendingDown } from 'lucide-react'

interface PuntoData { label: string; cantidad: number }
interface Resp { puntos: PuntoData[]; total: number }

function toISO(d: Date) { return format(d, 'yyyy-MM-dd') }

export function EstudiantesMes({ desde, hasta }: { desde: string; hasta: string }) {
  const { resolvedTheme: theme } = useTheme()
  const isDark    = theme === 'dark'
  const temaListo = theme !== undefined

  const color = isDark ? '#95daff' : '#1a7de0'
  const verde = isDark ? '#6ee7b7' : '#16a34a'
  const rojo  = isDark ? '#f87171' : '#dc2626'

  // Mes anterior (para variación) derivado de `desde`
  const base       = new Date(desde + 'T00:00:00')
  const inicioAnt  = toISO(startOfMonth(subMonths(base, 1)))
  const finAnt     = toISO(endOfMonth(subMonths(base, 1)))

  const { data, isLoading } = useQuery({
    queryKey: ['estudiantes-por-mes', desde, hasta],
    queryFn: () => apiFetch(`/reportes/estudiantes-por-mes?desde=${desde}&hasta=${hasta}`) as Promise<{ data: Resp }>,
    staleTime: 60_000,
  })
  const { data: antData } = useQuery({
    queryKey: ['estudiantes-por-mes', inicioAnt, finAnt],
    queryFn: () => apiFetch(`/reportes/estudiantes-por-mes?desde=${inicioAnt}&hasta=${finAnt}`) as Promise<{ data: Resp }>,
    staleTime: 60_000,
  })

  const total    = data?.data?.total ?? 0
  const totalAnt = antData?.data?.total ?? 0
  const variacion = totalAnt > 0 ? Math.round(((total - totalAnt) / totalAnt) * 100) : null

  // Sparkline: acumulado del mes (curva suave, sin ejes)
  const serie = useMemo(() => {
    const puntos = data?.data?.puntos ?? []
    let acc = 0
    return puntos.map(p => { acc += p.cantidad; return { label: p.label, acc } })
  }, [data])

  return (
    <div className="card p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-md bg-[var(--primary-container)] flex items-center justify-center">
          <Users className="w-3.5 h-3.5 text-primary" />
        </div>
        <h3 className="text-[15px] font-semibold text-on-surface">Nuevos estudiantes</h3>
      </div>

      {!temaListo || isLoading ? (
        <div className="space-y-3">
          <div className="h-9 w-24 rounded bg-[var(--surface-high)] animate-pulse" />
          <div className="h-12 rounded bg-[var(--surface-high)] animate-pulse" />
        </div>
      ) : (
        <>
          {/* KPI */}
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[34px] font-bold text-on-surface tabular-nums leading-none">{total}</p>
              <p className="text-[11px] text-on-surface-variant mt-1">este mes</p>
            </div>
            {variacion !== null && (
              <p className="text-[12px] font-semibold flex items-center gap-0.5 mb-1"
                style={{ color: variacion >= 0 ? verde : rojo }}>
                {variacion >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {variacion >= 0 ? '+' : ''}{variacion}%
              </p>
            )}
          </div>

          {/* Sparkline (acumulado, sin ejes) */}
          <div className="mt-4 -mx-1">
            <ResponsiveContainer width="100%" height={56}>
              <AreaChart data={serie} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradEstud" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{ background: isDark ? '#0f1e35' : '#fff', border: `1px solid ${isDark ? 'rgba(149,218,255,0.12)' : 'rgba(0,48,96,0.10)'}`, borderRadius: 8, padding: '4px 10px', fontSize: 11 }}
                  labelStyle={{ display: 'none' }}
                  formatter={(v: number) => [`${v} acumulados`, '']}
                />
                <Area type="monotone" dataKey="acc" stroke={color} strokeWidth={2} fill="url(#gradEstud)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-on-surface-variant text-center mt-1">Acumulado del mes</p>
          </div>
        </>
      )}
    </div>
  )
}
