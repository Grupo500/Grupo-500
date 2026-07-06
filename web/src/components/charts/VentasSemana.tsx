'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { apiFetch } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { CalendarDays, TrendingUp, TrendingDown, Trophy } from 'lucide-react'

interface Punto { label: string; ingresos: number | null; pagos: number }
interface Resp { puntos: Punto[] }

function toISO(d: Date) { return format(d, 'yyyy-MM-dd') }
function capitalizar(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

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

const AMBAR = '#ef9f27'

// ── Círculo de día — seleccionable, con estados: hoy / mejor día / seleccionado ──
function DiaCirculo({
  label, tieneValor, esHoy, esMejorDia, seleccionado, delay, onClick,
}: {
  label: string; tieneValor: boolean; esHoy: boolean; esMejorDia: boolean
  seleccionado: boolean; delay: number; onClick: () => void
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  const anillo = esHoy ? 'var(--primary)' : esMejorDia ? AMBAR : tieneValor ? 'var(--outline-variant)' : 'var(--outline-variant)'
  const punto  = esHoy ? 'var(--primary)' : esMejorDia ? AMBAR : 'var(--primary)'
  const tam    = esHoy ? 44 : 40

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative flex items-center justify-center" style={{ width: 44, height: 44 }}>
        {seleccionado && (
          <div className="absolute inset-[-4px] rounded-full" style={{ background: 'var(--primary-container)', opacity: 0.6 }} />
        )}
        <button
          type="button"
          onClick={onClick}
          disabled={!tieneValor}
          className={`relative rounded-full flex items-center justify-center transition-transform ${tieneValor ? 'cursor-pointer hover:scale-105' : 'cursor-default'} ${esHoy ? 'animate-day-pulse' : ''}`}
          style={{
            width: tam, height: tam,
            border: tieneValor ? `${esHoy ? 2.5 : 2}px solid ${anillo}` : '1.5px dashed var(--outline-variant)',
            transform: visible ? 'scale(1)' : 'scale(0)',
            opacity: visible ? 1 : 0,
            transition: 'transform 450ms cubic-bezier(0.34,1.56,0.64,1), opacity 300ms ease-out',
          }}
        >
          {tieneValor && (
            <span className="rounded-full" style={{ width: esHoy ? 12 : 10, height: esHoy ? 12 : 10, background: punto }} />
          )}
        </button>
      </div>
      <span
        className="text-[10px] flex items-center gap-0.5"
        style={{ color: esHoy || esMejorDia ? anillo : 'var(--on-surface-variant)', fontWeight: esHoy || esMejorDia ? 700 : 400 }}
      >
        {label}
        {esMejorDia && <Trophy className="w-2.5 h-2.5" />}
      </span>
    </div>
  )
}

// Ventas de la semana (Lun-Dom) del asesor logueado — reusa /reportes/ventas-grafica,
// que ya filtra por asesorId cuando el rol es VENDEDOR. Se pide un día extra al
// inicio (domingo anterior) solo para poder calcular "vs ayer" incluso un lunes.
export function VentasSemana() {
  const [diaSeleccionado, setDiaSeleccionado] = useState<number | null>(null)

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
  const activo   = diaSeleccionado ?? hoyIndex

  const totalSemana = dias.reduce((s, p) => s + (p.ingresos ?? 0), 0)
  const mejorDiaIndex = dias.reduce<number | null>((mejor, d, i) => {
    if (d.ingresos == null || d.ingresos <= 0) return mejor
    if (mejor === null || (d.ingresos as number) > (dias[mejor].ingresos as number)) return i
    return mejor
  }, null)

  const montoActivo    = dias[activo]?.ingresos ?? 0
  const montoAnterior  = puntos[activo]?.ingresos ?? 0
  const variacion      = montoAnterior > 0 ? Math.round(((montoActivo - montoAnterior) / montoAnterior) * 100) : null
  const esMejorDiaActivo = mejorDiaIndex === activo

  const animMonto = useCountUp(isLoading ? 0 : montoActivo)

  const etiquetas = Array.from({ length: 7 }, (_, i) => capitalizar(format(addDays(lunes, i), 'EEE', { locale: es }).replace('.', '')))
  const diasCompletos = Array.from({ length: 7 }, (_, i) => capitalizar(format(addDays(lunes, i), 'EEEE', { locale: es })))

  const labelActivo = activo === hoyIndex ? 'Hoy' : diasCompletos[activo]
  const vsLabel = activo === hoyIndex
    ? 'vs ayer'
    : activo === 0 ? 'vs domingo pasado' : `vs ${diasCompletos[activo - 1].toLowerCase()}`

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
              <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">{labelActivo}</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-[28px] font-bold text-on-surface tabular-nums leading-none">{formatCOP(animMonto)}</span>
                {variacion !== null && (
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5"
                    style={{ color: variacion >= 0 ? '#16a34a' : '#dc2626', background: variacion >= 0 ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)' }}
                  >
                    {variacion >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {variacion >= 0 ? '+' : ''}{variacion}%
                  </span>
                )}
              </div>
              <p className="text-[10px] text-on-surface-variant mt-0.5">{vsLabel}</p>
              {esMejorDiaActivo && (
                <p className="text-[11px] font-semibold mt-1.5 flex items-center gap-1" style={{ color: AMBAR }}>
                  <Trophy className="w-3.5 h-3.5" /> Tu mejor día de la semana
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Total semana</p>
              <p className="text-[17px] font-bold text-on-surface tabular-nums mt-0.5">{formatCOP(totalSemana)}</p>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {dias.map((d, i) => (
              <DiaCirculo
                key={i}
                label={etiquetas[i]}
                tieneValor={d.ingresos != null}
                esHoy={i === hoyIndex}
                esMejorDia={mejorDiaIndex === i}
                seleccionado={i === activo}
                delay={80 + i * 70}
                onClick={() => setDiaSeleccionado(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
