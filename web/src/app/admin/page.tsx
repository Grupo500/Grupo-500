'use client'

// Resumen general del área de Administración.
//
// Reutiliza las piezas del Inicio —la gráfica de facturación, el desglose del
// mes y el podio de asesores— en vez de tener versiones propias más pobres:
// son los mismos datos y el equipo ya sabe leerlas (Hotman, 20-ago). Alrededor,
// los módulos que solo existen aquí: cartera, marketing, equipo y cobros.
//
// Las cifras de cartera salen de calcularPendientes, el mismo cálculo que usa
// la tarjeta de Ventas, para que las dos pantallas no puedan discrepar.

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Loader2, ChevronRight, Users, Megaphone, Receipt, CircleDollarSign, PieChart } from 'lucide-react'
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { AvatarMiembro } from '@/components/marketing/AvatarMiembro'
import { apiFetch } from '@/lib/api'
import { formatCOP, cn } from '@/lib/utils'
import { FacturadoMensual } from '@/components/charts/FacturadoMensual'
import { DesgloseMes } from '@/components/charts/DesgloseMes'
import { TopAsesores } from '@/components/charts/TopAsesores'

interface Resumen {
  periodo: { desde: string; hasta: string }
  ventas: {
    facturado: number; neto: number; comisiones: number; cantidad: number
    asesores: number; sinAsesor: number
    pendiente?: { cantidad: number; monto: number }
  }
  cartera: {
    vencido: number; cuotas: number
    abierto: number; estudiantes: number; gestion: number; gestionEst: number; recuperado: number
  }
  marketing: {
    planificado: number; enProceso: number; publicado: number; equipo: number
    porPersona: { nombre: string; image: string | null; cantidad: number }[]
    porTipo: { tipo: string; cantidad: number }[]
    cobros: { porAprobar: number; aprobado: number; pagado: number }
  }
}

const COLOR = { ventas: '#1a7de0', mkt: '#db2777', fin: '#16a34a', cartera: '#d97706', morado: '#7c3aed' }

// Los mismos nombres cortos que usa el tablero de Marketing.
const TIPO_LABEL: Record<string, string> = {
  VIDEO: 'Reel', VSL: 'VSL', CARRUSEL: 'Carrusel', CARRUMEME: 'Carrumeme',
  TIKTOKERO: 'TikTokero', GUION: 'Guion', PUBLICACION: 'Publicación', OTRO: 'Otro',
}
// Orden fijo de colores para la dona: el tipo conserva su color aunque cambie
// su posición de un mes a otro.
const TIPO_COLORES = ['#1a7de0', '#2e9e6b', '#d97706', '#7c3aed', '#dc2626', '#0891b2']

function Semaforo({ tono, children }: { tono: 'ok' | 'atencion' | 'info'; children: React.ReactNode }) {
  const c = tono === 'ok' ? COLOR.fin : tono === 'atencion' ? COLOR.cartera : COLOR.mkt
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

/**
 * Módulo del tablero. Cuando lleva `href` se comporta como tarjeta clicable:
 * se levanta al pasar el cursor y muestra a dónde va. Sin ese estado no había
 * forma de saber que llevaba a alguna parte (Hotman, 20-ago).
 */
function Modulo({ titulo, icono: Icono, color, href, irA, estado, ancho, children }: {
  titulo: string
  icono: typeof Users
  color: string
  href?: string
  irA?: string
  estado?: React.ReactNode
  /** Ocupa dos columnas de la rejilla. */
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
        <span className="ir mt-auto flex items-center gap-0.5 pt-3 text-[11px] font-semibold text-primary opacity-45 transition-all duration-200">
          {irA ?? 'Ir'} <ChevronRight className="size-3" />
        </span>
      )}
    </>
  )
  const clase = cn(
    'card flex flex-col p-4',
    ancho && 'md:col-span-2',
    href && [
      'cursor-pointer transition-all duration-200',
      'hover:-translate-y-[3px] hover:border-primary/45 hover:shadow-float',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
      '[&:hover_.ir]:opacity-100',
    ],
  )
  return href ? <Link href={href} className={clase}>{cuerpo}</Link> : <div className={clase}>{cuerpo}</div>
}

export default function AdminResumenPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-resumen'],
    queryFn: () => apiFetch('/reportes/resumen-general') as Promise<{ data: Resumen }>,
    staleTime: 60_000,
  })
  const r = data?.data
  const mes = r ? format(new Date(r.periodo.desde), "MMMM 'de' yyyy", { locale: es }) : ''

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }
  if (!r) return null

  const desde = r.periodo.desde.slice(0, 10)
  const hasta = r.periodo.hasta.slice(0, 10)

  // Todo lo que viene del API se lee con respaldo: el frontend se despliega en
  // Vercel y el backend en Railway, y entre uno y otro hay minutos en los que
  // la pantalla nueva recibe la respuesta vieja. Sin esto, un campo que aún no
  // existe tumba la página entera con "cannot read properties of undefined".
  const cartera = r.cartera ?? { abierto: 0, gestion: 0, gestionEst: 0, estudiantes: 0 }
  const ventas = r.ventas ?? { asesores: 0, sinAsesor: 0 }
  const mkt = r.marketing ?? {}
  const porPersona = mkt.porPersona ?? []
  const porTipo = mkt.porTipo ?? []
  const cobros = mkt.cobros ?? { porAprobar: 0, aprobado: 0, pagado: 0 }

  const pctGestion = cartera.abierto > 0 ? Math.round((cartera.gestion / cartera.abierto) * 100) : 0
  const equipoTotal = (ventas.asesores ?? 0) + (mkt.equipo ?? 0)
  const maxPersona = Math.max(...porPersona.map(p => p.cantidad), 1)
  const totalPiezas = porTipo.reduce((s, t) => s + t.cantidad, 0)

  // Arcos de la dona: cada tipo ocupa su porción y arranca donde terminó el
  // anterior. El 25 inicial es lo que endereza el arranque a las 12 en punto.
  let acumulado = 0
  const arcos = porTipo.slice(0, 5).map((t, i) => {
    const pct = totalPiezas > 0 ? (t.cantidad / totalPiezas) * 100 : 0
    const offset = 25 - acumulado
    acumulado += pct
    return { ...t, pct, offset, color: TIPO_COLORES[i % TIPO_COLORES.length] }
  })

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-[22px] font-bold leading-tight tracking-tight text-on-surface">Resumen general</h1>
        <p className="mt-0.5 text-[13px] font-medium capitalize text-on-surface-variant">
          {mes} · las áreas en una sola pantalla
        </p>
      </div>

      {/* ── Facturación del mes + a dónde va el dinero ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
        <div className="min-w-0 flex-1">
          <FacturadoMensual />
        </div>
        <div className="md:w-72 md:flex-shrink-0">
          <DesgloseMes desde={desde} hasta={hasta} />
        </div>
      </div>

      {/* ── Quién está vendiendo ── */}
      <TopAsesores />

      {/* ── Los módulos propios del área ── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

        <Modulo
          titulo="Cartera" icono={CircleDollarSign} color={COLOR.cartera}
          estado={<Semaforo tono={pctGestion > 15 ? 'atencion' : 'ok'}>
            {pctGestion > 15 ? 'Atención' : 'Bajo control'}
          </Semaforo>}
        >
          <div className="grid place-items-center py-1">
            <svg width="120" height="70" viewBox="0 0 112 66" aria-hidden="true">
              <path d="M10,60 A46,46 0 0,1 102,60" fill="none" stroke="var(--surface-high)" strokeWidth="9" strokeLinecap="round" />
              <path
                d="M10,60 A46,46 0 0,1 102,60" fill="none" stroke={COLOR.cartera} strokeWidth="9" strokeLinecap="round"
                strokeDasharray="145" strokeDashoffset={145 - 145 * Math.min(pctGestion / 100, 1)}
                style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)' }}
              />
              <text x="56" y="52" textAnchor="middle" fontSize="16" fontWeight="800" fill="var(--on-surface)">{pctGestion}%</text>
            </svg>
          </div>
          <p className="text-center text-[10.5px] text-on-surface-variant">
            de {formatCOP(cartera.abierto)} requiere gestión
            <span className="mt-0.5 block">{cartera.gestionEst} de {cartera.estudiantes} estudiantes</span>
          </p>
        </Modulo>

        {/* Producción: la carga real de cada persona. Ocupa dos columnas —el
            espacio que dejó Equipo al bajar— y con ese ancho caben la foto y
            el nombre completo (Hotman, 20-ago). */}
        <Modulo
          titulo="Marketing · producción" icono={Megaphone} color={COLOR.mkt}
          href="/marketing" irA="Ir a Marketing" ancho
          estado={<Semaforo tono="info">{totalPiezas} pieza{totalPiezas !== 1 ? 's' : ''}</Semaforo>}
        >
          {porPersona.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-on-surface-variant">Sin contenido este mes</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {porPersona.slice(0, 5).map((p, i) => (
                <div key={p.nombre} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                  <span className="flex w-[168px] min-w-0 items-center gap-2.5">
                    <AvatarMiembro
                      id={p.nombre} nombre={p.nombre} image={p.image} size={30}
                      className="ring-2 ring-surface-lowest"
                    />
                    <span className="truncate text-[12px] text-on-surface">{p.nombre}</span>
                  </span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-surface-high">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${(p.cantidad / maxPersona) * 100}%`, background: COLOR.mkt,
                        transition: 'width 900ms cubic-bezier(0.22,1,0.36,1)', transitionDelay: `${i * 80}ms`,
                      }}
                    />
                  </span>
                  <b className="min-w-[20px] text-right text-[13px] font-bold tabular-nums text-on-surface">{p.cantidad}</b>
                </div>
              ))}
            </div>
          )}
        </Modulo>

        <Modulo titulo="Equipo" icono={Users} color={COLOR.ventas} href="/admin/usuarios" irA="Ir a Usuarios">
          <p className="text-[24px] font-bold leading-none tabular-nums text-on-surface">{equipoTotal}</p>
          <p className="mt-1 text-[10.5px] text-on-surface-variant">
            {(ventas.asesores ?? 0)} asesores · {(mkt.equipo ?? 0)} marketing
          </p>
          <div className="mt-3 flex h-2.5 gap-[2px] overflow-hidden rounded-full">
            <span style={{ width: `${((ventas.asesores ?? 0) / Math.max(equipoTotal, 1)) * 100}%`, background: COLOR.ventas }} />
            <span className="flex-1" style={{ background: COLOR.mkt }} />
          </div>
          {(ventas.sinAsesor ?? 0) > 0 && (
            <p className="mt-2 text-[10px] text-on-surface-variant">
              {(ventas.sinAsesor ?? 0)} pagos sin asesor acreditado
            </p>
          )}
        </Modulo>

        <Modulo
          titulo="Cobros freelance" icono={Receipt} color={COLOR.cartera}
          href="/marketing/cobros" irA="Ir a Cobros"
          estado={cobros.porAprobar > 0
            ? <Semaforo tono="atencion">Por aprobar</Semaforo>
            : <Semaforo tono="ok">Al día</Semaforo>}
        >
          <p className="text-[22px] font-bold leading-none tabular-nums"
             style={{ color: cobros.porAprobar > 0 ? COLOR.cartera : 'var(--on-surface)' }}>
            {formatCOP(cobros.porAprobar)}
          </p>
          <p className="mt-1 text-[10.5px] text-on-surface-variant">esperando tu aprobación</p>
          <div className="mt-3 flex gap-2 text-[10px] text-on-surface-variant">
            <span className="flex-1 rounded-lg bg-surface-high px-2.5 py-1.5">
              Aprobado
              <b className="block text-[12px] tabular-nums text-on-surface">{formatCOP(cobros.aprobado)}</b>
            </span>
            <span className="flex-1 rounded-lg bg-surface-high px-2.5 py-1.5">
              Pagado
              <b className="block text-[12px] tabular-nums" style={{ color: COLOR.fin }}>{formatCOP(cobros.pagado)}</b>
            </span>
          </div>
        </Modulo>

        {/* Mezcla: qué se está produciendo. Misma dona que "Cursos más
            vendidos" del dashboard —anillo delgado, rebanadas separadas con
            puntas redondeadas y el total al centro— para que las dos donas de
            la app se lean igual (Hotman, 20-ago). */}
        <Modulo
          titulo="Marketing · mezcla" icono={PieChart} color={COLOR.mkt}
          href="/marketing" irA="Ir a Marketing"
        >
          {totalPiezas === 0 ? (
            <p className="py-4 text-center text-[11px] text-on-surface-variant">Sin contenido este mes</p>
          ) : (
            <>
              <div className="relative mx-auto" style={{ width: 124, height: 124 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={arcos} dataKey="cantidad" nameKey="tipo"
                      innerRadius="82%" outerRadius="100%"
                      paddingAngle={3} cornerRadius={10} stroke="none"
                      startAngle={90} endAngle={-270}
                    >
                      {arcos.map(a => <Cell key={a.tipo} fill={a.color} />)}
                    </Pie>
                  </RePieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[20px] font-bold leading-none tabular-nums text-on-surface">{totalPiezas}</span>
                  <span className="mt-0.5 text-[11px] text-on-surface-variant">piezas</span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {arcos.map(a => (
                  <div key={a.tipo} className="flex items-start gap-2">
                    <span className="mt-[3px] size-2.5 flex-shrink-0 rounded-full" style={{ background: a.color }} />
                    <span className="flex-1 text-[12px] leading-snug text-on-surface">{TIPO_LABEL[a.tipo] ?? a.tipo}</span>
                    <span className="flex-shrink-0 text-[12px] font-bold tabular-nums text-on-surface">{a.cantidad}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Modulo>

      </div>
    </div>
  )
}
