'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { useEffect, useRef, useState } from 'react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { apiFetch } from '@/lib/api'
import { Users, TrendingUp, TrendingDown } from 'lucide-react'

interface Resp { total: number }

function toISO(d: Date) { return format(d, 'yyyy-MM-dd') }

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number | null>(null)
  const prevTarget = useRef(0)

  useEffect(() => {
    if (target === 0) { setValue(0); return }
    const start     = prevTarget.current
    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed  = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(start + (target - start) * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
      else prevTarget.current = target
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return value
}

function Barra({ label, valor, max, color, delay }: { label: string; valor: number; max: number; color: string; delay: number }) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setWidth((valor / max) * 100), delay)
    return () => clearTimeout(t)
  }, [valor, max, delay])

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-on-surface-variant">{label}</span>
        <span className="text-[11px] font-bold text-on-surface tabular-nums">{valor}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-high overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${width}%`, background: color, transition: 'width 600ms cubic-bezier(0.23,1,0.32,1)' }} />
      </div>
    </div>
  )
}

export function EstudiantesMes({ desde, hasta }: { desde: string; hasta: string }) {
  const { resolvedTheme: theme } = useTheme()
  const isDark    = theme === 'dark'
  const temaListo = theme !== undefined

  const verde   = isDark ? '#6ee7b7' : '#16a34a'
  const rojo    = isDark ? '#f87171' : '#dc2626'
  const primary = isDark ? '#95daff' : '#1a7de0'

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

  const total    = data?.data?.total ?? 0
  const totalAnt = antData?.data?.total ?? 0
  const variacion = totalAnt > 0 ? Math.round(((total - totalAnt) / totalAnt) * 100) : null
  const max      = Math.max(total, totalAnt, 1)

  const displayTotal = useCountUp(total)

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
        <div className="animate-fade-in">
          <p className="text-[40px] font-bold text-on-surface tabular-nums leading-none">{displayTotal}</p>
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

          <div className="mt-5 space-y-3">
            <Barra label="Este mes"     valor={total}    max={max} color={primary}                          delay={100} />
            <Barra label="Mes anterior" valor={totalAnt} max={max} color={isDark ? '#4a6fa0' : '#9bb3d4'}  delay={250} />
          </div>
        </div>
      )}
    </div>
  )
}
