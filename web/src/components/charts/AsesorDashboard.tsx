'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { apiFetch } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { NotificacionesButton } from '@/components/ui/NotificacionesButton'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { VentasSemana } from './VentasSemana'
import {
  TrendingUp, TrendingDown, Wallet, Users, Receipt,
  Trophy, Award, Crown,
  type LucideIcon,
} from 'lucide-react'

interface RankItem {
  id: string
  nombre: string
  image: string | null
  totalVentas: number
  cantidad: number
  esYo: boolean
}
interface MiResumen {
  ventas:      { monto: number; cantidad: number; variacion: number }
  comision:    number
  estudiantes: { total: number; nuevos: number }
  posicion:    { rank: number; total: number; falta: number; siguienteNombre: string | null }
  serie:       { label: string; monto: number }[]
  ranking:     RankItem[]
}

function iniciales(n: string) {
  return n.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

// ── Count-up ──
function useCountUp(target: number, duration = 900) {
  const [v, setV] = useState(0)
  const raf = useRef<number | null>(null)
  const prev = useRef(0)
  useEffect(() => {
    if (target === 0) { setV(0); prev.current = 0; return }
    const start = prev.current, t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setV(Math.round(start + (target - start) * e))
      if (p < 1) raf.current = requestAnimationFrame(tick)
      else prev.current = target
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target, duration])
  return v
}

function Kpi({ icon: Icon, label, value, sub, subColor, valColor }: {
  icon: LucideIcon; label: string; value: string; sub?: string; subColor?: string; valColor?: string
}) {
  return (
    <div className="card p-4">
      <p className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </p>
      <p className="text-[22px] font-bold tabular-nums mt-1.5 leading-none" style={valColor ? { color: valColor } : undefined}>{value}</p>
      {sub && <p className="text-[11px] mt-1.5" style={subColor ? { color: subColor } : { color: 'var(--on-surface-variant)' }}>{sub}</p>}
    </div>
  )
}

export function AsesorDashboard() {
  const { data: session } = useSession()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const firstName = (session?.user?.name ?? session?.user?.email?.split('@')[0] ?? '').split(' ')[0]
  const horaColombia = Number(
    new Intl.DateTimeFormat('es-CO', { hour: 'numeric', hour12: false, timeZone: 'America/Bogota' }).format(new Date())
  )
  const saludo = horaColombia < 12 ? 'Buenos días' : horaColombia < 18 ? 'Buenas tardes' : 'Buenas noches'

  // El SSE se monta globalmente en el layout (SSEProvider); no duplicar aquí.

  const { data, isLoading } = useQuery<{ data: MiResumen }>({
    queryKey: ['mi-resumen'],
    queryFn: () => apiFetch('/reportes/mi-resumen'),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })

  const r = data?.data
  const ventas      = r?.ventas      ?? { monto: 0, cantidad: 0, variacion: 0 }
  const comision    = r?.comision    ?? 0
  const estudiantes = r?.estudiantes ?? { total: 0, nuevos: 0 }
  const posicion    = r?.posicion    ?? { rank: 0, total: 0, falta: 0, siguienteNombre: null }
  const serie       = r?.serie       ?? []
  const ranking     = r?.ranking     ?? []

  const animMonto    = useCountUp(isLoading ? 0 : ventas.monto)
  const animComision = useCountUp(isLoading ? 0 : comision)
  const animCant     = useCountUp(isLoading ? 0 : ventas.cantidad)
  const animEst      = useCountUp(isLoading ? 0 : estudiantes.total)

  const verde = isDark ? '#6ee7b7' : '#16a34a'
  const rojo  = isDark ? '#f87171' : '#dc2626'

  const maxSerie = Math.max(1, ...serie.map(s => s.monto))
  const pctComision = ventas.monto > 0 ? Math.round((comision / ventas.monto) * 100) : 0

  // Progreso hacia el siguiente puesto
  const siguienteVentas = ventas.monto + posicion.falta
  const pctProgreso = siguienteVentas > 0 ? Math.min(100, Math.round((ventas.monto / siguienteVentas) * 100)) : 100

  const podium = ranking.slice(0, 3)
  const podiumOrden = [podium[1], podium[0], podium[2]].filter(Boolean)
  const resto = ranking.slice(3, 8)

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Saludo */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {session?.user?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.user.image} alt={firstName} width={46} height={46}
              className="rounded-full flex-shrink-0 ring-2 ring-[#21b9f7]/25 w-[46px] h-[46px] object-cover" referrerPolicy="no-referrer" />
          )}
          <div>
            <h1 className="text-[22px] font-bold text-on-surface tracking-tight leading-tight">{saludo}, {firstName} 👋</h1>
            <p className="text-[13px] text-on-surface-variant mt-0.5 font-medium">Tu desempeño y comisiones</p>
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          <NotificacionesButton />
          <RefreshButton />
        </div>
      </div>

      {/* Ventas de la semana — pulso diario, exclusivo del dashboard de asesor */}
      <VentasSemana />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={TrendingUp} label="Mis ventas del mes" value={formatCOP(animMonto)}
          sub={ventas.variacion !== 0 ? `${ventas.variacion > 0 ? '▲ +' : '▼ '}${ventas.variacion}% vs mes anterior` : 'Sin cambio'}
          subColor={ventas.variacion > 0 ? verde : ventas.variacion < 0 ? rojo : undefined} />
        <Kpi icon={Wallet} label="Mi comisión" value={formatCOP(animComision)} valColor="#16a34a"
          sub={`${pctComision}% sobre ventas`} />
        <Kpi icon={Receipt} label="Ventas cerradas" value={String(animCant)} sub="pagos este mes" />
        <Kpi icon={Users} label="Estudiantes" value={String(animEst)}
          sub={estudiantes.nuevos > 0 ? `+${estudiantes.nuevos} nuevos` : 'Sin nuevos este mes'}
          subColor={estudiantes.nuevos > 0 ? verde : undefined} />
      </div>

      {/* Posición + tendencia */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Mi posición */}
        <div className="card p-5">
          <p className="text-[13px] font-semibold text-on-surface flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4" style={{ color: '#ef9f27' }} /> Mi posición
          </p>
          {isLoading ? (
            <div className="h-16 rounded-xl bg-surface-high animate-pulse" />
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-[40px] font-bold leading-none" style={{ color: '#21b9f7' }}>#{posicion.rank}</span>
                <span className="text-[13px] text-on-surface-variant">de {posicion.total} asesor{posicion.total !== 1 ? 'es' : ''}</span>
              </div>
              <div className="mt-4">
                <div className="h-2 rounded-full bg-surface-high overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pctProgreso}%`, background: '#378ADD', transition: 'width 800ms cubic-bezier(0.23,1,0.32,1)' }} />
                </div>
                <p className="text-[11px] text-on-surface-variant mt-2">
                  {posicion.rank <= 1
                    ? '¡Vas de primero! 🎉'
                    : <>Te faltan <strong className="text-on-surface tabular-nums">{formatCOP(posicion.falta)}</strong> para alcanzar el puesto #{posicion.rank - 1}{posicion.siguienteNombre ? ` (${posicion.siguienteNombre})` : ''}</>}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Tendencia de mis ventas */}
        <div className="card p-5">
          <p className="text-[13px] font-semibold text-on-surface flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" /> Mis ventas (6 meses)
          </p>
          {isLoading ? (
            <div className="h-24 rounded-xl bg-surface-high animate-pulse" />
          ) : (
            <>
              <div className="flex items-end gap-1.5 h-24">
                {serie.map((s, i) => (
                  <div key={i} className="flex-1 flex items-end h-full">
                    <BarSerie pct={Math.round((s.monto / maxSerie) * 100)} last={i === serie.length - 1} delay={100 + i * 70} />
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 mt-1.5">
                {serie.map((s, i) => (
                  <span key={i} className="flex-1 text-center text-[9px] text-on-surface-variant capitalize">{s.label}</span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ranking */}
      <div className="card p-5">
        <p className="text-[13px] font-semibold text-on-surface flex items-center gap-2 mb-4">
          <Award className="w-4 h-4" style={{ color: '#185fa5' }} /> Ranking de asesores
        </p>

        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-surface-high animate-pulse" />)}</div>
        ) : ranking.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant text-center py-6">Sin ventas registradas este mes</p>
        ) : (
          <>
            {/* Podium 2-1-3 */}
            <div className="grid grid-cols-3 gap-3 items-end mb-3">
              {podiumOrden.map((a) => {
                const pos = podium.indexOf(a) + 1
                const isFirst = pos === 1, isSecond = pos === 2
                const altura = isFirst ? 88 : isSecond ? 64 : 48
                const colorBg = isFirst ? 'linear-gradient(180deg,#fac775,#ef9f27)'
                  : isSecond ? 'linear-gradient(180deg,var(--surface-high),var(--outline-variant))'
                  : 'linear-gradient(180deg,#f5c4b3,#d85a30)'
                const ring = a.esYo ? '#21b9f7' : isFirst ? '#ef9f27' : isSecond ? 'var(--outline-variant)' : '#d85a30'
                return (
                  <div key={a.id} className="flex flex-col items-center text-center">
                    {isFirst && <Crown className="w-5 h-5 mb-1" style={{ color: '#ef9f27' }} />}
                    <div className="rounded-full overflow-hidden flex items-center justify-center font-semibold"
                      style={{ width: isFirst ? 52 : 40, height: isFirst ? 52 : 40, background: 'var(--primary-container)', color: 'var(--primary)', fontSize: isFirst ? 15 : 12, border: `2px solid ${ring}` }}>
                      {a.image ? <img src={a.image} alt={a.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : iniciales(a.nombre)}
                    </div>
                    <p className="text-[11px] font-semibold text-on-surface mt-1.5 leading-tight truncate w-full px-1">
                      {a.esYo ? 'Tú' : a.nombre.split(' ')[0]}
                    </p>
                    <p className="text-[10px] text-on-surface-variant tabular-nums">{formatCOP(a.totalVentas)}</p>
                    <div className="w-full mt-1.5 rounded-t-lg flex items-center justify-center font-bold text-white"
                      style={{ height: altura, background: colorBg, fontSize: isFirst ? 18 : 14 }}>{pos}°</div>
                  </div>
                )
              })}
            </div>

            {/* Lista 4+ */}
            <div className="space-y-1.5">
              {resto.map((a, i) => (
                <div key={a.id}
                  className={`grid grid-cols-[28px_32px_1fr_auto] gap-2 items-center px-3 py-2 rounded-xl ${a.esYo ? 'bg-[var(--primary-container)]/50 ring-1 ring-primary/30' : 'bg-surface-high/40'}`}>
                  <span className="text-[12px] font-semibold text-on-surface-variant">{i + 4}°</span>
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/15 flex items-center justify-center ring-1 ring-primary/10">
                    {a.image ? <img src={a.image} alt={a.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <span className="text-[10px] font-bold text-primary">{iniciales(a.nombre)}</span>}
                  </div>
                  <span className="text-[12px] font-semibold text-on-surface truncate">
                    {a.nombre}{a.esYo && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded ml-1.5 bg-primary text-white align-middle">TÚ</span>}
                  </span>
                  <span className="text-[12px] font-bold text-on-surface tabular-nums">{formatCOP(a.totalVentas)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function BarSerie({ pct, last, delay }: { pct: number; last: boolean; delay: number }) {
  const [h, setH] = useState(0)
  useEffect(() => { const t = setTimeout(() => setH(pct), delay); return () => clearTimeout(t) }, [pct, delay])
  return (
    <div className="w-full rounded-t-md" style={{
      height: `${Math.max(4, h)}%`,
      background: last ? '#1D9E75' : '#9FE1CB',
      transition: 'height 700ms cubic-bezier(0.23,1,0.32,1)',
    }} />
  )
}
