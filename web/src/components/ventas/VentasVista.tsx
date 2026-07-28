'use client'

import { useState, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'

import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCOP } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight, Search, Repeat2, Loader2, Receipt, AlertTriangle,
  TrendingUp, Wallet, Target, type LucideIcon,
} from 'lucide-react'

// Los montos se comparan en columna: cifras tabulares para que cada dígito
// ocupe el mismo ancho. La familia es la global (Poppins).
const mono = { className: 'tabular-nums' }

interface CursoRef { curso: { id: string; nombre: string }; fechaCompra: string | null }
interface Venta {
  id: string
  monto: number
  estado: string
  metodo: string
  fechaPago: string | null
  referenciaPago: string | null
  comisionAsesor: number | null
  asesorId: string | null
  asesor: { id: string; nombre: string } | null
  estudiante: {
    id: string
    nombre: string
    asesorId: string | null
    asesor: { id: string; nombre: string } | null
    cursos: CursoRef[]
  }
}
interface FilaAsesor {
  id: string
  nombre: string
  vendido: number
  comision: number
  cantidad: number
}
interface Resumen {
  vendido: number
  comision: number
  cantidad: number
  ticketPromedio: number
  dias: { fecha: string; monto: number }[]
  porAsesor: FilaAsesor[]
}
interface AsesorRef { id: string; nombre: string }

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function rangoDelMes(offset: number) {
  const hoy = new Date()
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - offset, 1)
  const fin = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0, 23, 59, 59)
  return { inicio, fin }
}

function iso(d: Date) {
  return d.toISOString()
}

// Un pago no guarda a qué curso corresponde. Cuando el estudiante compró varias
// veces, se elige el curso cuya fecha de compra queda más cerca del pago — que
// es el que efectivamente lo originó.
function cursoDelPago(cursos: CursoRef[], fechaPago: string | null): string | null {
  if (cursos.length === 0) return null
  if (cursos.length === 1 || !fechaPago) return cursos[0].curso.nombre
  const t = new Date(fechaPago).getTime()
  const cercano = cursos.reduce((mejor, c) => {
    if (!c.fechaCompra) return mejor
    if (!mejor.fechaCompra) return c
    return Math.abs(new Date(c.fechaCompra).getTime() - t) < Math.abs(new Date(mejor.fechaCompra).getTime() - t)
      ? c
      : mejor
  })
  return cercano.curso.nombre
}

function fmtFechaHora(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  const dia = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
  const hora = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${dia} · ${hora}`
}

/**
 * Vista de ventas. En modo `asesor` muestra solo las del vendedor logueado
 * (el backend fuerza el alcance); en modo `admin` agrega el selector de asesor
 * y el desglose por asesor cuando se miran todos.
 */
export function VentasVista({ modo }: { modo: 'asesor' | 'admin' }) {
  const esAdmin = modo === 'admin'
  const [offset, setOffset] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const [cursoId, setCursoId] = useState('')
  const [asesorId, setAsesorId] = useState('')
  const [pagina, setPagina] = useState(1)
  const [diaActivo, setDiaActivo] = useState<number | null>(null)
  const rielRef = useRef<HTMLDivElement>(null)

  const { inicio, fin } = useMemo(() => rangoDelMes(offset), [offset])
  const esMesActual = offset === 0

  const { data: token } = useQuery({ queryKey: ['token'], queryFn: getClientToken })
  const fetcher = useMemo(() => createClientFetcher(token ?? null), [token])

  const rangoQS = `desde=${encodeURIComponent(iso(inicio))}&hasta=${encodeURIComponent(iso(fin))}`

  const qsAsesor = esAdmin && asesorId ? `&asesorId=${asesorId}` : ''

  const { data: resumen, isLoading: cargandoResumen } = useQuery<{ data: Resumen }>({
    queryKey: ['ventas-resumen', modo, offset, asesorId],
    queryFn: () => fetcher(`/reportes/mis-ventas?${rangoQS}${qsAsesor}`),
    enabled: !!token,
  })

  const { data: lista, isLoading: cargandoLista } = useQuery<{ data: Venta[]; meta?: { total: number; totalPages: number } }>({
    queryKey: ['ventas-lista', modo, offset, busqueda, cursoId, asesorId, pagina],
    queryFn: () =>
      fetcher(
        `/pagos?porFechaPago=true&estado=PAGADO&${rangoQS}&page=${pagina}&limit=20${qsAsesor}` +
          (busqueda ? `&nombre=${encodeURIComponent(busqueda)}` : '') +
          (cursoId ? `&cursoId=${cursoId}` : '')
      ),
    enabled: !!token,
  })

  const { data: cursos } = useQuery<{ data: { id: string; nombre: string }[] }>({
    queryKey: ['cursos-filtro'],
    queryFn: () => fetcher('/cursos?limit=100'),
    enabled: !!token,
  })

  const { data: asesores } = useQuery<{ data: AsesorRef[] }>({
    queryKey: ['asesores-filtro'],
    queryFn: () => fetcher('/asesores'),
    enabled: !!token && esAdmin,
  })

  const r = resumen?.data
  const ventas = lista?.data ?? []
  const totalPaginas = lista?.meta?.totalPages ?? 1

  const maxDia = Math.max(1, ...(r?.dias ?? []).map(d => d.monto))
  const hoyISO = new Date().toISOString().slice(0, 10)
  const diaSeleccionado = diaActivo != null ? r?.dias?.[diaActivo] ?? null : null

  // Recorrer la gráfica con el dedo (o el mouse): la posición horizontal dentro
  // del riel determina qué día se está mirando.
  function scrub(e: React.TouchEvent | React.MouseEvent) {
    const riel = rielRef.current
    const dias = r?.dias?.length ?? 0
    if (!riel || dias === 0) return
    const x = 'touches' in e ? e.touches[0]?.clientX : e.clientX
    if (x == null) return
    const { left, width } = riel.getBoundingClientRect()
    const i = Math.floor(((x - left) / width) * dias)
    setDiaActivo(Math.min(dias - 1, Math.max(0, i)))
  }

  function cambiarMes(delta: number) {
    setOffset(o => Math.max(0, o + delta))
    setPagina(1)
    setDiaActivo(null)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={esAdmin ? 'Ventas' : 'Mis ventas'}
        subtitle={esAdmin ? 'Todas las ventas del equipo, con su atribución' : 'Cada venta que cerraste, con su comisión'}
      />

      {/* Tarjetas de resumen — mismo formato que el dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={TrendingUp} label="Vendido" valor={formatCOP(r?.vendido ?? 0)} cargando={cargandoResumen} />
        <Kpi icon={Wallet} label="Comisión" valor={formatCOP(r?.comision ?? 0)} valColor="#16a34a" cargando={cargandoResumen} />
        <Kpi icon={Receipt} label="Ventas" valor={String(r?.cantidad ?? 0)} cargando={cargandoResumen} />
        <Kpi icon={Target} label="Ticket promedio" valor={formatCOP(r?.ticketPromedio ?? 0)} cargando={cargandoResumen} />
      </div>

      {/* Ritmo del mes */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-[11px] tracking-[0.16em] text-on-surface-variant font-semibold uppercase">
            Ritmo de {MESES[inicio.getMonth()]}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => cambiarMes(1)}
              aria-label="Mes anterior"
              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-high transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className={`${mono.className} text-[12px] text-on-surface min-w-[92px] text-center`}>
              {MESES[inicio.getMonth()]} {inicio.getFullYear()}
            </span>
            <button
              onClick={() => cambiarMes(-1)}
              disabled={esMesActual}
              aria-label="Mes siguiente"
              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-high transition-colors disabled:opacity-30 disabled:cursor-default cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {cargandoResumen ? (
          <div className="h-16 rounded-xl bg-surface-high animate-pulse" />
        ) : (
          <>
            <div
              ref={rielRef}
              onTouchStart={scrub}
              onTouchMove={scrub}
              onMouseLeave={() => setDiaActivo(null)}
              onMouseMove={scrub}
              // pan-y deja el scroll vertical de la página intacto y nos reserva
              // el gesto horizontal para recorrer los días.
              style={{ touchAction: 'pan-y' }}
              className="flex items-end gap-[3px] h-16 cursor-crosshair"
              role="img"
              aria-label={`Ventas por día de ${MESES[inicio.getMonth()]}`}
            >
              {(r?.dias ?? []).map((d, i) => {
                const esHoy = d.fecha === hoyISO
                const futuro = d.fecha > hoyISO
                const activo = i === diaActivo
                const alto = d.monto > 0 ? Math.max(6, (d.monto / maxDia) * 100) : 4
                return (
                  <div
                    key={d.fecha}
                    title={`${d.fecha} · ${formatCOP(d.monto)}`}
                    className="flex-1 rounded-t-[2px] transition-all"
                    style={{
                      height: `${alto}%`,
                      background: activo || esHoy ? 'var(--on-surface)' : 'var(--primary)',
                      opacity: activo ? 1 : futuro ? 0.15 : d.monto > 0 ? 1 : 0.25,
                    }}
                  />
                )
              })}
            </div>
            <div className={`${mono.className} flex justify-between mt-1.5 text-[10.5px] text-on-surface-variant`}>
              {diaSeleccionado ? (
                <>
                  <span className="text-on-surface font-semibold">
                    {Number(diaSeleccionado.fecha.slice(8, 10))} de {MESES[inicio.getMonth()]}
                  </span>
                  <span className="text-on-surface font-semibold">{formatCOP(diaSeleccionado.monto)}</span>
                </>
              ) : (
                <>
                  <span>1</span>
                  {esMesActual && <span className="text-on-surface">hoy · {new Date().getDate()}</span>}
                  <span>{fin.getDate()}</span>
                </>
              )}
            </div>
          </>
        )}

      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
          <input
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
            placeholder="Estudiante o referencia de Hotmart"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-surface-lowest border border-surface-high text-[13px] text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        {esAdmin && (
          <select
            value={asesorId}
            onChange={e => { setAsesorId(e.target.value); setPagina(1) }}
            aria-label="Filtrar por asesor"
            className="px-3 py-2.5 rounded-xl bg-surface-lowest border border-surface-high text-[13px] text-on-surface focus:outline-none focus:border-primary transition-colors cursor-pointer sm:max-w-[220px]"
          >
            <option value="">Todos los asesores</option>
            <option value="sin-asesor">⚠ Sin asesor</option>
            {(asesores?.data ?? []).map(a => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
        )}
        <select
          value={cursoId}
          onChange={e => { setCursoId(e.target.value); setPagina(1) }}
          aria-label="Filtrar por curso"
          className="px-3 py-2.5 rounded-xl bg-surface-lowest border border-surface-high text-[13px] text-on-surface focus:outline-none focus:border-primary transition-colors cursor-pointer sm:max-w-[240px]"
        >
          <option value="">Todos los cursos</option>
          {(cursos?.data ?? []).map(c => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      {/* Desglose por asesor — solo cuando el admin mira a todos */}
      {esAdmin && !asesorId && (resumen?.data.porAsesor?.length ?? 0) > 0 && (
        <div className="card p-5">
          <p className="text-[11px] tracking-[0.16em] text-on-surface-variant font-semibold uppercase mb-3.5">
            Por asesor
          </p>
          <div className="space-y-1">
            {(resumen?.data.porAsesor ?? []).map((a, i) => {
              const maxVendido = resumen?.data.porAsesor[0]?.vendido || 1
              return (
                <button
                  key={a.id}
                  onClick={() => { setAsesorId(a.id); setPagina(1) }}
                  className="w-full flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-surface-high transition-colors cursor-pointer text-left"
                >
                  <span className={`${mono.className} text-[11.5px] text-on-surface-variant w-5 shrink-0`}>{i + 1}</span>
                  <span className="text-[13.5px] font-semibold text-on-surface truncate flex-1 min-w-0">{a.nombre}</span>
                  <span className="hidden sm:block w-24 h-1.5 rounded-full bg-surface-high overflow-hidden shrink-0">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${Math.round((a.vendido / maxVendido) * 100)}%` }}
                    />
                  </span>
                  <span className={`${mono.className} text-[13px] text-on-surface w-[104px] text-right shrink-0`}>
                    {formatCOP(a.vendido)}
                  </span>
                  <span className={`${mono.className} hidden sm:block text-[12px] w-[92px] text-right shrink-0`} style={{ color: '#16a34a' }}>
                    {formatCOP(a.comision)}
                  </span>
                  <span className={`${mono.className} text-[11.5px] text-on-surface-variant w-8 text-right shrink-0`}>{a.cantidad}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Movimientos */}
      <div className="card p-5">
        {cargandoLista ? (
          <div className="flex items-center justify-center py-14 text-on-surface-variant">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : ventas.length === 0 ? (
          <div className="flex flex-col items-center text-center py-14 px-6">
            <Receipt className="w-8 h-8 text-on-surface-variant/50 mb-3" />
            <p className="text-[14px] font-semibold text-on-surface">Sin ventas en {MESES[inicio.getMonth()]}</p>
            <p className="text-[12.5px] text-on-surface-variant mt-1 max-w-[280px]">
              Cuando cierres una venta aparece aquí con su comisión, en cuanto Hotmart confirme el pago.
            </p>
          </div>
        ) : (
          <>
            {ventas.map((v, i) => {
              const curso = cursoDelPago(v.estudiante.cursos, v.fechaPago)
              const ajeno = !!v.estudiante.asesorId && v.estudiante.asesorId !== v.asesorId
              return (
                <div
                  key={v.id}
                  className={`flex gap-4 items-start py-4 ${i > 0 ? 'border-t border-dashed border-surface-high' : 'pt-0'}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[14.5px] font-semibold text-on-surface leading-snug">{v.estudiante.nombre}</p>
                    {curso && <p className="text-[12.5px] text-on-surface-variant mt-0.5">{curso}</p>}
                    <p className={`${mono.className} text-[11px] text-on-surface-variant/70 mt-1.5`}>
                      {fmtFechaHora(v.fechaPago)} · {v.referenciaPago ?? 'sin referencia'}
                    </p>
                    {esAdmin && (
                      v.asesor ? (
                        <p className="text-[11.5px] mt-2 text-on-surface-variant">
                          Vendió <span className="font-semibold text-on-surface">{v.asesor.nombre}</span>
                        </p>
                      ) : (
                        <p className="text-[11.5px] mt-2 flex items-center gap-1.5" style={{ color: '#b45309' }}>
                          <AlertTriangle className="w-[15px] h-[15px] shrink-0" />
                          Sin asesor asignado
                        </p>
                      )
                    )}
                    {ajeno && (
                      <p className="text-[11.5px] mt-2 flex items-center gap-1.5" style={{ color: '#8a6d1f' }}>
                        <Repeat2 className="w-[15px] h-[15px] shrink-0" />
                        Estudiante de {v.estudiante.asesor?.nombre ?? 'otro asesor'}
                      </p>
                    )}
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <p className={`${mono.className} text-[16px] text-on-surface`}>{formatCOP(v.monto)}</p>
                    {v.comisionAsesor != null && (
                      <p className={`${mono.className} text-[12px] mt-1`} style={{ color: '#16a34a' }}>
                        +{formatCOP(v.comisionAsesor)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}

            {totalPaginas > 1 && (
              <div className="flex items-center justify-between pt-4 mt-2 border-t border-surface-high">
                <button
                  onClick={() => setPagina(p => Math.max(1, p - 1))}
                  disabled={pagina === 1}
                  className="px-3 py-1.5 rounded-lg text-[12.5px] font-semibold text-on-surface-variant hover:bg-surface-high transition-colors disabled:opacity-30 disabled:cursor-default cursor-pointer"
                >
                  Anterior
                </button>
                <span className={`${mono.className} text-[12px] text-on-surface-variant`}>
                  {pagina} / {totalPaginas}
                </span>
                <button
                  onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                  disabled={pagina >= totalPaginas}
                  className="px-3 py-1.5 rounded-lg text-[12.5px] font-semibold text-on-surface-variant hover:bg-surface-high transition-colors disabled:opacity-30 disabled:cursor-default cursor-pointer"
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Mismo formato que las tarjetas del dashboard del asesor (AsesorDashboard.tsx),
// para que las dos pantallas se lean igual.
function Kpi({
  icon: Icon, label, valor, valColor, cargando,
}: {
  icon: LucideIcon
  label: string
  valor: string
  valColor?: string
  cargando?: boolean
}) {
  return (
    <div className="card p-4">
      <p className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 shrink-0" /> {label}
      </p>
      {cargando ? (
        <div className="h-[22px] w-24 rounded bg-surface-high animate-pulse mt-1.5" />
      ) : (
        <p
          className="text-[22px] font-bold tabular-nums mt-1.5 leading-none truncate"
          style={valColor ? { color: valColor } : undefined}
        >
          {valor}
        </p>
      )}
    </div>
  )
}
