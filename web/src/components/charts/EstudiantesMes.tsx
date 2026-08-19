'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { useEffect, useRef, useState } from 'react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { apiFetch } from '@/lib/api'
import { Users, TrendingUp, TrendingDown } from 'lucide-react'

interface Resp { total: number; puntos: { label: string; cantidad: number }[] }

/**
 * El día a día del mes en una línea pequeña + proyección de cierre. El
 * endpoint ya devolvía la serie diaria (puntos); aquí solo se dibuja. La
 * proyección es ritmo simple: total ÷ días corridos × días del mes.
 */
function Sparkline({ puntos, diasDelMes, isDark }: {
  puntos: { cantidad: number }[]; diasDelMes: number; isDark: boolean
}) {
  const ANCHO = 300, ALTO = 44, M = 4
  const transcurridos = puntos.length
  if (transcurridos < 2) return null
  const max = Math.max(...puntos.map(p => p.cantidad), 1)
  const x = (i: number) => M + (i / (diasDelMes - 1)) * (ANCHO - 2 * M)
  const y = (v: number) => ALTO - M - (v / max) * (ALTO - 2 * M)
  const linea = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.cantidad).toFixed(1)}`).join(' ')
  // Tramo punteado: desde el último día real hasta fin de mes, al promedio.
  const promedio = puntos.reduce((s, p) => s + p.cantidad, 0) / transcurridos
  const proyeccion = transcurridos < diasDelMes
    ? `M${x(transcurridos - 1).toFixed(1)},${y(puntos[transcurridos - 1].cantidad).toFixed(1)} L${x(diasDelMes - 1).toFixed(1)},${y(promedio).toFixed(1)}`
    : null
  const azul = isDark ? '#95daff' : '#1a7de0'
  return (
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} preserveAspectRatio="none" className="w-full h-11" aria-hidden="true">
      <path d={linea} fill="none" stroke={azul} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {proyeccion && <path d={proyeccion} fill="none" stroke={azul} strokeWidth="2" strokeDasharray="4 4" opacity="0.45" />}
      <circle cx={x(transcurridos - 1)} cy={y(puntos[transcurridos - 1].cantidad)} r="3.5" fill={azul} />
    </svg>
  )
}

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
  const hoy       = new Date()
  const mesAnt    = subMonths(base, 1)
  const inicioAnt = toISO(startOfMonth(mesAnt))
  // Mismo corte de días: si estamos a día 3 de julio, comparar jun 1–3
  const corteAnt  = new Date(mesAnt.getFullYear(), mesAnt.getMonth(), hoy.getDate())
  const finMesAnt = endOfMonth(mesAnt)
  const finAnt    = toISO(corteAnt > finMesAnt ? finMesAnt : corteAnt)

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

  // Serie diaria y proyección de cierre — solo para el mes en curso.
  const esMesActual = desde === toISO(startOfMonth(hoy))
  const diasDelMes  = endOfMonth(hoy).getDate()
  const diaHoy      = hoy.getDate()
  const puntosHastaHoy = (data?.data?.puntos ?? []).slice(0, diaHoy)
  const proyeccion = diaHoy > 0 ? Math.round((total / diaHoy) * diasDelMes) : total

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
          <p className="text-[32px] font-bold text-on-surface tabular-nums leading-none">{displayTotal}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] text-on-surface-variant">este mes</span>
            {variacion !== null && (
              <span className="text-[11px] font-semibold flex items-center gap-0.5"
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

          {/* El día a día del mes + a dónde va: solo tiene sentido mirando el
              mes en curso — un mes cerrado no se proyecta. */}
          {esMesActual && puntosHastaHoy.length >= 2 && (
            <div className="mt-4 pt-3 border-t border-outline-variant">
              <Sparkline puntos={puntosHastaHoy} diasDelMes={diasDelMes} isDark={isDark} />
              <p className="text-[10.5px] text-on-surface-variant mt-1.5">
                Inscripciones por día · al ritmo actual el mes cierra en{' '}
                <span className="font-bold text-on-surface tabular-nums">~{proyeccion}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
