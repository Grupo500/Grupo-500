'use client'

// Resumen general del área de Administración — "sala de control".
//
// Seis módulos del mismo peso, cada uno con su forma propia y una etiqueta de
// estado: la portada del área no es un informe que se lee de arriba abajo, es
// un tablero que se barre con la vista para saber dónde hay que mirar hoy.
// Diseño elegido por Hotman el 20-ago sobre tres propuestas.
//
// Las cifras vienen de un solo endpoint y no de varias llamadas, para que
// salgan de la misma foto — consultadas por aparte, dos peticiones a distinto
// segundo pueden mostrar totales que no cuadran entre sí. La cartera sale del
// mismo cálculo que usa la tarjeta de Ventas (calcularPendientes), no de una
// consulta paralela que un día dejaría de coincidir.

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Loader2, ChevronRight, TrendingUp, Users, Megaphone, Wallet, Receipt, CircleDollarSign } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { formatCOP, cn } from '@/lib/utils'

interface Resumen {
  periodo: { desde: string; hasta: string }
  ventas: {
    facturado: number; neto: number; comisiones: number; cantidad: number
    asesores: number; sinAsesor: number
    porDia: { dia: number; monto: number; cantidad: number }[]
    mejorDia: { dia: number; monto: number; cantidad: number }
    top: { nombre: string; monto: number }[]
  }
  cartera: {
    vencido: number; cuotas: number
    abierto: number; estudiantes: number; gestion: number; gestionEst: number; recuperado: number
  }
  marketing: {
    planificado: number; enProceso: number; publicado: number; equipo: number
    cobros: { porAprobar: number; aprobado: number; pagado: number }
  }
}

const COLOR = { ventas: '#1a7de0', mkt: '#db2777', fin: '#16a34a', cartera: '#d97706' }

/** Cuenta desde cero al aparecer. Respeta "reducir movimiento". */
function useCuenta(objetivo: number, activo = true) {
  const [v, setV] = useState(0)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    if (!activo) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(objetivo); return }
    const t0 = performance.now(), dur = 1000
    const tick = (t: number) => {
      const p = Math.min((t - t0) / dur, 1)
      setV(objetivo * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [objetivo, activo])
  return v
}

/** Etiqueta de estado: el módulo dice solo si está bien o pide atención. */
function Semaforo({ tono, children }: { tono: 'ok' | 'atencion' | 'info'; children: React.ReactNode }) {
  const c = tono === 'ok' ? '#16a34a' : tono === 'atencion' ? '#d97706' : '#1a7de0'
  return (
    <span
      className="inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-[3px] text-[9.5px] font-bold tracking-wide"
      style={{ background: `color-mix(in srgb, ${c} 15%, transparent)`, color: c }}
    >
      <span className="size-1.5 rounded-full" style={{ background: c }} />
      {children}
    </span>
  )
}

function Modulo({ titulo, icono: Icono, color, href, estado, ancho, children }: {
  titulo: string
  icono: typeof TrendingUp
  color: string
  href?: string
  estado?: React.ReactNode
  ancho?: boolean
  children: React.ReactNode
}) {
  const cuerpo = (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-on-surface-variant">
          <Icono className="size-3 flex-shrink-0" style={{ color }} />
          <span className="truncate">{titulo}</span>
        </p>
        {estado}
      </div>
      {children}
      {href && (
        <span className="mt-3 flex items-center gap-0.5 text-[11px] font-medium text-primary">
          Ir <ChevronRight className="size-3" />
        </span>
      )}
    </>
  )
  const clase = cn(
    'card p-4 animate-card-enter flex flex-col',
    ancho && 'md:col-span-2',
    href && 'transition-colors hover:border-primary/30',
  )
  return href ? <Link href={href} className={clase}>{cuerpo}</Link> : <div className={clase}>{cuerpo}</div>
}

/** Mapa de calor: un cuadrito por día, más oscuro cuanto más se vendió. */
function MapaCalor({ dias, hoy }: { dias: { dia: number; monto: number; cantidad: number }[]; hoy: number }) {
  const max = Math.max(...dias.map(d => d.monto), 1)
  return (
    <div className="mt-3 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${Math.min(dias.length, 16)}, minmax(0, 1fr))` }}>
      {dias.map(d => {
        const futuro = d.dia > hoy
        const int = futuro ? 0 : Math.round(18 + (d.monto / max) * 82)
        return (
          <span
            key={d.dia}
            title={futuro ? `Día ${d.dia}` : `Día ${d.dia}: ${formatCOP(d.monto)} · ${d.cantidad} venta${d.cantidad !== 1 ? 's' : ''}`}
            className="aspect-square rounded-[3px] transition-colors duration-500"
            style={{
              background: futuro
                ? 'var(--surface-high)'
                : `color-mix(in srgb, ${COLOR.ventas} ${int}%, var(--surface-high))`,
              transitionDelay: `${d.dia * 18}ms`,
            }}
          />
        )
      })}
    </div>
  )
}

export default function AdminResumenPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-resumen'],
    queryFn: () => apiFetch('/reportes/resumen-general') as Promise<{ data: Resumen }>,
    staleTime: 60_000,
  })
  const r = data?.data
  const facturado = useCuenta(r?.ventas.facturado ?? 0, !!r)

  const mes = r ? format(new Date(r.periodo.desde), "MMMM 'de' yyyy", { locale: es }) : ''
  const hoy = new Date().getDate()

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }
  if (!r) return null

  const pctNeto = r.ventas.facturado > 0 ? Math.round((r.ventas.neto / r.ventas.facturado) * 100) : 0
  const pctGestion = r.cartera.abierto > 0 ? Math.round((r.cartera.gestion / r.cartera.abierto) * 100) : 0
  const maxTop = Math.max(...r.ventas.top.map(t => t.monto), 1)
  const totalMkt = r.marketing.publicado + r.marketing.enProceso + r.marketing.planificado
  const maxMkt = Math.max(r.marketing.publicado, r.marketing.enProceso, r.marketing.planificado, 1)
  const equipoTotal = r.ventas.asesores + r.marketing.equipo

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-[22px] font-bold leading-tight tracking-tight text-on-surface">Resumen general</h1>
        <p className="mt-0.5 text-[13px] font-medium capitalize text-on-surface-variant">
          {mes} · las áreas en una sola pantalla
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

        {/* ── Ventas del mes, con el día a día ── */}
        <Modulo
          titulo={`Ventas · ${mes.split(' ')[0]}`} icono={TrendingUp} color={COLOR.ventas}
          href="/admin/ventas" ancho
          estado={<Semaforo tono="ok">{r.ventas.cantidad} ventas</Semaforo>}
        >
          <p className="text-[26px] font-bold leading-none tracking-[-0.025em] tabular-nums text-on-surface">
            {formatCOP(facturado)}
          </p>
          <p className="mt-1 text-[10.5px] text-on-surface-variant">
            Mejor día: {r.ventas.mejorDia.dia} de {mes.split(' ')[0]} ({formatCOP(r.ventas.mejorDia.monto)})
          </p>
          <MapaCalor dias={r.ventas.porDia} hoy={hoy} />
          <div className="mt-1.5 flex justify-between text-[9px] text-on-surface-variant">
            <span>1 {mes.split(' ')[0].slice(0, 3)}</span><span>hoy</span>
          </div>
        </Modulo>

        {/* ── Cartera: qué porcentaje del saldo hay que perseguir ── */}
        <Modulo
          titulo="Cartera" icono={CircleDollarSign} color={COLOR.cartera}
          estado={<Semaforo tono={pctGestion > 15 ? 'atencion' : 'ok'}>
            {pctGestion > 15 ? 'Atención' : 'Bajo control'}
          </Semaforo>}
        >
          <div className="grid place-items-center py-1">
            <svg width="118" height="70" viewBox="0 0 112 66" aria-hidden="true">
              <path d="M10,60 A46,46 0 0,1 102,60" fill="none" stroke="var(--surface-high)" strokeWidth="9" strokeLinecap="round" />
              <path
                d="M10,60 A46,46 0 0,1 102,60" fill="none" stroke={COLOR.cartera} strokeWidth="9" strokeLinecap="round"
                strokeDasharray="145"
                strokeDashoffset={145 - 145 * Math.min(pctGestion / 100, 1)}
                style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)' }}
              />
              <text x="56" y="52" textAnchor="middle" fontSize="16" fontWeight="800" fill="var(--on-surface)">{pctGestion}%</text>
            </svg>
          </div>
          <p className="text-center text-[10.5px] text-on-surface-variant">
            de {formatCOP(r.cartera.abierto)} requiere gestión
            <span className="mt-0.5 block text-[10px]">{r.cartera.gestionEst} de {r.cartera.estudiantes} estudiantes</span>
          </p>
        </Modulo>

        {/* ── Quién está vendiendo ── */}
        <Modulo titulo="Top asesores" icono={Users} color={COLOR.ventas} href="/admin/ventas">
          <div className="flex flex-col gap-2">
            {r.ventas.top.length === 0 && (
              <p className="py-3 text-center text-[11px] text-on-surface-variant">Sin ventas este mes</p>
            )}
            {r.ventas.top.map((t, i) => (
              <div key={t.nombre} className="grid grid-cols-[70px_1fr_auto] items-center gap-2 text-[10.5px]">
                <span className="truncate text-on-surface-variant">{t.nombre.split(' ').slice(0, 2).join(' ')}</span>
                <span className="h-2 overflow-hidden rounded-full bg-surface-high">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${(t.monto / maxTop) * 100}%`, background: COLOR.ventas,
                      transition: 'width 900ms cubic-bezier(0.22,1,0.36,1)', transitionDelay: `${i * 80}ms`,
                    }}
                  />
                </span>
                <b className="tabular-nums text-on-surface">{formatCOP(t.monto)}</b>
              </div>
            ))}
          </div>
        </Modulo>

        {/* ── Lo que de verdad queda ── */}
        <Modulo titulo="Neto recibido" icono={Wallet} color={COLOR.fin} href="/finanzas">
          <p className="text-[24px] font-bold leading-none tracking-[-0.02em] tabular-nums" style={{ color: COLOR.fin }}>
            {formatCOP(r.ventas.neto)}
          </p>
          <p className="mt-1 text-[10.5px] text-on-surface-variant">
            {pctNeto}% de lo facturado · {formatCOP(r.ventas.comisiones)} en comisiones
          </p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-high">
            <span
              className="block h-full rounded-full"
              style={{ width: `${pctNeto}%`, background: COLOR.fin, transition: 'width 1s cubic-bezier(0.22,1,0.36,1)' }}
            />
          </div>
        </Modulo>

        {/* ── Contenido de Marketing ── */}
        <Modulo
          titulo="Marketing" icono={Megaphone} color={COLOR.mkt} href="/marketing"
          estado={<Semaforo tono="info">{totalMkt} piezas</Semaforo>}
        >
          <div className="mt-1 flex h-[52px] items-end gap-1.5">
            {[
              { n: r.marketing.publicado, o: 1 },
              { n: r.marketing.enProceso, o: 0.55 },
              { n: r.marketing.planificado, o: 0.3 },
            ].map((b, i) => (
              <span
                key={i}
                className="flex-1 rounded-t"
                style={{
                  height: `${Math.max((b.n / maxMkt) * 100, 4)}%`, background: COLOR.mkt, opacity: b.o,
                  transition: 'height 900ms cubic-bezier(0.22,1,0.36,1)', transitionDelay: `${i * 90}ms`,
                }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex gap-1.5 text-[9px] text-on-surface-variant">
            <span className="flex-1">Publicado {r.marketing.publicado}</span>
            <span className="flex-1">Proceso {r.marketing.enProceso}</span>
            <span className="flex-1">Plan {r.marketing.planificado}</span>
          </div>
        </Modulo>

        {/* ── Equipo ── */}
        <Modulo titulo="Equipo" icono={Users} color={COLOR.ventas} href="/admin/usuarios">
          <p className="text-[24px] font-bold leading-none tabular-nums text-on-surface">{equipoTotal}</p>
          <p className="mt-1 text-[10.5px] text-on-surface-variant">
            {r.ventas.asesores} asesores · {r.marketing.equipo} marketing
          </p>
          <div className="mt-3 flex h-2.5 gap-[2px] overflow-hidden rounded-full">
            <span style={{ width: `${(r.ventas.asesores / Math.max(equipoTotal, 1)) * 100}%`, background: COLOR.ventas }} />
            <span className="flex-1" style={{ background: COLOR.mkt }} />
          </div>
          {r.ventas.sinAsesor > 0 && (
            <p className="mt-2 text-[10px] text-on-surface-variant">
              {r.ventas.sinAsesor} pagos sin asesor acreditado
            </p>
          )}
        </Modulo>

        {/* ── Cobros freelance ── */}
        <Modulo
          titulo="Cobros freelance" icono={Receipt} color={COLOR.cartera} href="/marketing/cobros"
          estado={r.marketing.cobros.porAprobar > 0
            ? <Semaforo tono="atencion">Por aprobar</Semaforo>
            : <Semaforo tono="ok">Al día</Semaforo>}
        >
          <p className="text-[22px] font-bold leading-none tabular-nums"
             style={{ color: r.marketing.cobros.porAprobar > 0 ? COLOR.cartera : 'var(--on-surface)' }}>
            {formatCOP(r.marketing.cobros.porAprobar)}
          </p>
          <p className="mt-1 text-[10.5px] text-on-surface-variant">esperando tu aprobación</p>
          <div className="mt-3 flex gap-2 text-[10px] text-on-surface-variant">
            <span className="flex-1 rounded-lg bg-surface-high px-2.5 py-1.5">
              Aprobado
              <b className="block text-[12px] tabular-nums text-on-surface">{formatCOP(r.marketing.cobros.aprobado)}</b>
            </span>
            <span className="flex-1 rounded-lg bg-surface-high px-2.5 py-1.5">
              Pagado
              <b className="block text-[12px] tabular-nums" style={{ color: COLOR.fin }}>{formatCOP(r.marketing.cobros.pagado)}</b>
            </span>
          </div>
        </Modulo>

      </div>
    </div>
  )
}
