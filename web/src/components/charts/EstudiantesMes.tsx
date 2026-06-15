'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { apiFetch } from '@/lib/api'
import { Users, TrendingUp, TrendingDown } from 'lucide-react'

interface Resp { total: number }

function toISO(d: Date) { return format(d, 'yyyy-MM-dd') }

export function EstudiantesMes({ desde, hasta }: { desde: string; hasta: string }) {
  const { resolvedTheme: theme } = useTheme()
  const isDark    = theme === 'dark'
  const temaListo = theme !== undefined

  const verde = isDark ? '#6ee7b7' : '#16a34a'
  const rojo  = isDark ? '#f87171' : '#dc2626'
  const primary = isDark ? '#95daff' : '#1a7de0'

  // Mes anterior (para variación) derivado de `desde`
  const base      = new Date(desde + 'T00:00:00')
  const inicioAnt = toISO(startOfMonth(subMonths(base, 1)))
  const finAnt    = toISO(endOfMonth(subMonths(base, 1)))

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

  const total     = data?.data?.total ?? 0
  const totalAnt  = antData?.data?.total ?? 0
  const variacion = totalAnt > 0 ? Math.round(((total - totalAnt) / totalAnt) * 100) : null

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-md bg-[var(--primary-container)] flex items-center justify-center">
          <Users className="w-3.5 h-3.5 text-primary" />
        </div>
        <h3 className="text-[15px] font-semibold text-on-surface">Nuevos estudiantes</h3>
      </div>

      {!temaListo || isLoading ? (
        <div className="h-12 w-28 rounded bg-[var(--surface-high)] animate-pulse" />
      ) : (
        <>
          <p className="text-[40px] font-bold text-on-surface tabular-nums leading-none">{total}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[12px] text-on-surface-variant">este mes</span>
            {variacion !== null && (
              <span className="text-[12px] font-semibold flex items-center gap-0.5"
                style={{ color: variacion >= 0 ? verde : rojo }}>
                {variacion >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {variacion >= 0 ? '+' : ''}{variacion}%
              </span>
            )}
          </div>

          {/* Comparación con el mes anterior */}
          {(() => {
            const max = Math.max(total, totalAnt, 1)
            const Barra = ({ label, valor, color }: { label: string; valor: number; color: string }) => (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-on-surface-variant">{label}</span>
                  <span className="text-[11px] font-bold text-on-surface tabular-nums">{valor}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-high overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(valor / max) * 100}%`, background: color }} />
                </div>
              </div>
            )
            return (
              <div className="mt-5 space-y-3">
                <Barra label="Este mes" valor={total} color={primary} />
                <Barra label="Mes anterior" valor={totalAnt} color={isDark ? '#4a6fa0' : '#9bb3d4'} />
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}
