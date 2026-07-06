'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { apiFetch } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { CalendarDays, TrendingUp, TrendingDown, Trophy } from 'lucide-react'

interface Punto { label: string; ingresos: number | null; pagos: number }
interface Resp { puntos: Punto[] }

function toISO(d: Date) { return format(d, 'yyyy-MM-dd') }

// ── Count-up (mismo patrón que AsesorDashboard/EstudiantesMes) ──
function useCountUp(target: number, duration = 900) {
  const [v, setV] = useState(0)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    if (target === 0) { setV(0); return }
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setV(Math.round(target * e))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target, duration])
  return v
}

function BarraDia({ pct, esHoy, esFuturo, delay }: { pct: number; esHoy: boolean; esFuturo: boolean; delay: number }) {
  const [h, setH] = useState(0)
  useEffect(() => {
    if (esFuturo) return
    const t = setTimeout(() => setH(Math.max(pct, 4)), delay)
    return () => clearTimeout(t)
  }, [pct, delay, esFuturo])

  if (esFuturo) {
    return <div className="w-full rounded-t-md border border-dashed" style={{ height: '12%', borderColor: 'var(--outline-variant)' }} />
  }

  return (
    <div
      className={`w-full rounded-t-md ${esHoy ? 'animate-bar-pulse' : ''}`}
      style={{
        height: `${h}%`,
        background: esHoy ? 'linear-gradient(180deg, var(--accent), var(--primary))' : 'var(--primary-container)',
        transition: 'height 700ms cubic-bezier(0.23,1,0.32,1)',
      }}
    />
  )
}

// Ventas de la semana (Lun-Dom) del asesor logueado — reusa /reportes/ventas-grafica,
// que ya filtra por asesorId cuando el rol es VENDEDOR. Se pide un día extra al
// inicio (domingo anterior) solo para poder calcular "vs ayer" incluso un lunes.
export function VentasSemana() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const verde = isDark ? '#6ee7b7' : '#16a34a'
  const rojo  = isDark ? '#f87171' : '#dc2626'

  const now      = new Date()
  const lunes    = startOfWeek(now, { weekStartsOn: 1 })
  const domingo  = endOfWeek(now, { weekStartsOn: 1 })
  const desde    = toISO(subDays(lunes, 1))
  const hasta    = toISO(domingo)

  const { data, isLoading } = useQuery<{ data: Resp }>({
    queryKey: ['ventas-semana', desde, hasta],
    queryFn: () => apiFetch(`/reportes/ventas-grafica?desde=${desde}&hasta=${hasta}`),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })

  const puntos = data?.data?.puntos ?? []
  const dias   = puntos.slice(1, 8) // Lun..Dom de esta semana

  const hoyIndex = (now.getDay() + 6) % 7 // 0=Lunes ... 6=Domingo

  const montoHoy    = dias[hoyIndex]?.ingresos ?? 0
  const montoAyer   = puntos[hoyIndex]?.ingresos ?? 0
  const variacion   = montoAyer > 0 ? Math.round(((montoHoy - montoAyer) / montoAyer) * 100) : null
  const totalSemana = dias.reduce((s, p) => s + (p.ingresos ?? 0), 0)

  const maxDia      = Math.max(1, ...dias.map(d => d.ingresos ?? 0))
  const mejorDiaHoy = montoHoy > 0 && montoHoy === maxDia

  const animHoy = useCountUp(isLoading ? 0 : montoHoy)

  const etiquetas = Array.from({ length: 7 }, (_, i) => {
    const label = format(addDays(lunes, i), 'EEE', { locale: es }).replace('.', '')
    return label.charAt(0).toUpperCase() + label.slice(1)
  })

  const rangoLabel = `${format(lunes, 'd MMM', { locale: es })} – ${format(domingo, 'd MMM', { locale: es })}`

  return (
    <div className="card p-5 animate-card-enter">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-semibold text-on-surface flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" /> Ventas de la semana
        </p>
        <span className="text-[11px] text-on-surface-variant capitalize">{rangoLabel}</span>
      </div>

      {isLoading ? (
        <div className="h-40 rounded-xl bg-surface-high animate-pulse" />
      ) : (
        <>
          <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Hoy</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-[28px] font-bold text-on-surface tabular-nums leading-none">{formatCOP(animHoy)}</span>
                {variacion !== null && (
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5"
                    style={{ color: variacion >= 0 ? verde : rojo, background: variacion >= 0 ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)' }}
                  >
                    {variacion >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {variacion >= 0 ? '+' : ''}{variacion}%
                  </span>
                )}
              </div>
              <p className="text-[10px] text-on-surface-variant mt-0.5">vs ayer</p>
              {mejorDiaHoy && (
                <p className="text-[11px] font-semibold mt-1.5 flex items-center gap-1" style={{ color: '#ef9f27' }}>
                  <Trophy className="w-3.5 h-3.5" /> Tu mejor día de la semana
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Total semana</p>
              <p className="text-[17px] font-bold text-on-surface tabular-nums mt-0.5">{formatCOP(totalSemana)}</p>
            </div>
          </div>

          <div className="flex items-end gap-2 h-28">
            {dias.map((d, i) => (
              <div key={i} className="flex-1 flex items-end h-full">
                <BarraDia
                  pct={d.ingresos != null ? Math.round((d.ingresos / maxDia) * 100) : 0}
                  esHoy={i === hoyIndex}
                  esFuturo={d.ingresos == null}
                  delay={100 + i * 60}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-1.5">
            {etiquetas.map((label, i) => (
              <span
                key={i}
                className="flex-1 text-center text-[10px]"
                style={{ color: i === hoyIndex ? 'var(--primary)' : 'var(--on-surface-variant)', fontWeight: i === hoyIndex ? 700 : 400 }}
              >
                {label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
