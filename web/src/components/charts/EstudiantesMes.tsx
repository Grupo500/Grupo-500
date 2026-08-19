'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { useEffect, useRef, useState } from 'react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { apiFetch } from '@/lib/api'
import { Users, TrendingUp, TrendingDown } from 'lucide-react'
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

interface Resp { total: number; puntos: { label: string; cantidad: number; fecha?: string }[] }

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

  // Serie diaria del mes en curso. Se dibuja como barras y no como línea: es
  // un conteo por día (cada barra es un día que se puede comparar con el de
  // al lado), no una magnitud que fluye. El día de hoy va resaltado y los
  // días que aún no llegan no se pintan.
  const esMesActual = desde === toISO(startOfMonth(hoy))
  const diasDelMes  = endOfMonth(hoy).getDate()
  const diaHoy      = hoy.getDate()
  const proyeccion  = diaHoy > 0 ? Math.round((total / diaHoy) * diasDelMes) : total
  const promedioDia = diaHoy > 0 ? Math.round(total / diaHoy) : 0
  const serie = (data?.data?.puntos ?? [])
    // El día sale de la fecha del punto, no de su posición en la lista.
    .map(p => ({ dia: p.fecha ? new Date(p.fecha).getDate() : 0, cantidad: p.cantidad }))
    .filter(p => p.dia > 0 && p.dia <= diaHoy)
  const mejorDia = serie.reduce((m, p) => Math.max(m, p.cantidad), 0)

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

          {/* El día a día del mes: solo tiene sentido mirando el mes en curso
              — un mes cerrado no se proyecta. */}
          {esMesActual && serie.length >= 2 && (
            <div className="mt-4 pt-3.5 border-t border-outline-variant">
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <span className="text-[10.5px] font-medium text-on-surface-variant">Inscripciones por día</span>
                <span className="text-[10.5px] text-on-surface-variant">
                  promedio <span className="font-bold text-on-surface tabular-nums">{promedioDia}</span>/día
                </span>
              </div>

              <ResponsiveContainer width="100%" height={92}>
                <BarChart data={serie} margin={{ top: 2, right: 0, left: 0, bottom: 0 }} barCategoryGap="18%">
                  <XAxis
                    dataKey="dia" tick={{ fontSize: 9, fill: isDark ? '#8ea0b8' : '#5b6b85' }}
                    axisLine={false} tickLine={false}
                    // Primer día, cada 5, y el de hoy: suficientes anclas para
                    // ubicarse sin llenar el eje de números.
                    ticks={serie.map(p => p.dia).filter(d => d === 1 || d % 5 === 0 || d === diaHoy)}
                  />
                  <YAxis hide domain={[0, Math.max(mejorDia, 1)]} />
                  {/* El promedio como referencia: una barra por encima fue un
                      buen día, por debajo uno flojo. */}
                  <ReferenceLine y={promedioDia} stroke={isDark ? '#8ea0b8' : '#9bb3d4'}
                    strokeDasharray="3 3" strokeWidth={1} />
                  <Tooltip
                    cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,48,96,0.05)' }}
                    contentStyle={{ background: isDark ? '#0f1e35' : '#fff', border: `1px solid ${isDark ? 'rgba(149,218,255,0.12)' : 'rgba(0,48,96,0.10)'}`, borderRadius: 10, fontSize: 11 }}
                    labelFormatter={(d) => `Día ${d}`}
                    formatter={(v: number) => [`${v} estudiante${v === 1 ? '' : 's'}`, 'Nuevos']}
                  />
                  <Bar dataKey="cantidad" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                    {serie.map(p => (
                      // Hoy resaltado; el mejor día del mes en verde.
                      <Cell key={p.dia}
                        fill={p.dia === diaHoy ? primary : p.cantidad === mejorDia ? verde : (isDark ? '#2f4d78' : '#bcd4ee')} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <p className="text-[10.5px] text-on-surface-variant mt-1.5">
                Al ritmo actual el mes cierra en{' '}
                <span className="font-bold text-on-surface tabular-nums">~{proyeccion}</span> estudiantes
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
