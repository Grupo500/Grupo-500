'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCOP, cn } from '@/lib/utils'
import { useCountUp } from '@/hooks/useCountUp'
import { Select } from '@/components/ui/Select'
import {
  ChevronLeft, ChevronRight, Search, Repeat2, Loader2, Receipt, AlertTriangle,
  TrendingUp, Wallet, Target, X, UserPlus, type LucideIcon,
} from 'lucide-react'

// Los montos se comparan en columna: cifras tabulares para que cada dígito
// ocupe el mismo ancho. La familia es la global (Poppins).
const mono = { className: 'tabular-nums' }

/**
 * Geometría de la tabla "Por asesor". La usan el encabezado y cada fila, así
 * que un rótulo y su cifra caen siempre en la misma columna.
 *
 * Pistas: puesto · avatar · nombre (elástica) · barra · vendido · comisión ·
 * ventas. En móvil se ocultan barra y comisión, y como un elemento con
 * `display:none` sale de la rejilla, la plantilla angosta tiene cinco pistas
 * en vez de siete.
 */
const GRID_ASESOR =
  'grid items-center gap-3 ' +
  'grid-cols-[20px_32px_minmax(0,1fr)_104px_44px] ' +
  'sm:grid-cols-[20px_32px_minmax(0,1fr)_96px_104px_92px_44px]'

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
  enPartes?: boolean
  cuotaNumero?: number | null
  cuotasTotal?: number | null
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
  image: string | null
  vendido: number
  comision: number
  cantidad: number
}

function iniciales(nombre: string) {
  return nombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}
interface Resumen {
  vendido: number
  comision: number
  cantidad: number
  ticketPromedio: number
  dias: { fecha: string; monto: number }[]
  porAsesor: FilaAsesor[]
  // null = el mes anterior no tuvo movimiento, no hay con qué comparar.
  variacion?: {
    vendido: number | null
    comision: number | null
    cantidad: number | null
    ticketPromedio: number | null
  }
}
interface AsesorRef { id: string; nombre: string }
interface AfiliadoNoReconocido { afiliadoHotmart: string; cantidad: number; montoTotal: number }
interface DiagnosticoAtribucion { totalPagosSinAsesor: number; porAfiliadoNoReconocido: AfiliadoNoReconocido[] }

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

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
  // `diaActivo` es el que estás recorriendo con el dedo (solo la lupa).
  // `diaFijado` es el que quedó elegido al soltar, y ese sí filtra la lista.
  const [diaActivo, setDiaActivo] = useState<number | null>(null)
  const [diaFijado, setDiaFijado] = useState<string | null>(null)
  const rielRef = useRef<HTMLDivElement>(null)
  const tactoReciente = useRef(false)

  const { inicio, fin } = useMemo(() => rangoDelMes(offset), [offset])
  const esMesActual = offset === 0

  const { data: token } = useQuery({ queryKey: ['token'], queryFn: getClientToken })
  const fetcher = useMemo(() => createClientFetcher(token ?? null), [token])

  const rangoQS = `desde=${encodeURIComponent(iso(inicio))}&hasta=${encodeURIComponent(iso(fin))}`

  // La gráfica y las tarjetas siempre son del mes; solo el listado se acota
  // al día fijado, para poder ver a quién le vendiste ese día.
  //
  // Sin la `Z` la fecha se interpreta en la zona del navegador (Colombia), que
  // es la misma en la que el backend agrupa los días. Con `Z` el rango se
  // corría cinco horas y arrastraba ventas de la noche anterior.
  const rangoLista = diaFijado
    ? `desde=${encodeURIComponent(new Date(`${diaFijado}T00:00:00`).toISOString())}` +
      `&hasta=${encodeURIComponent(new Date(`${diaFijado}T23:59:59.999`).toISOString())}`
    : rangoQS

  const qsAsesor = esAdmin && asesorId ? `&asesorId=${asesorId}` : ''

  const { data: resumen, isLoading: cargandoResumen } = useQuery<{ data: Resumen }>({
    queryKey: ['ventas-resumen', modo, offset, asesorId],
    queryFn: () => fetcher(`/reportes/mis-ventas?${rangoQS}${qsAsesor}`),
    enabled: !!token,
  })

  const { data: lista, isLoading: cargandoLista } = useQuery<{ data: Venta[]; pagination?: { total: number; totalPages: number } }>({
    queryKey: ['ventas-lista', modo, offset, busqueda, cursoId, asesorId, pagina, diaFijado],
    queryFn: () =>
      fetcher(
        `/pagos?porFechaPago=true&estado=PAGADO&${rangoLista}&page=${pagina}&limit=20${qsAsesor}` +
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

  const queryClient = useQueryClient()

  // Ventas de Hotmart que llegaron con un afiliado que no se pudo reconocer
  // (ni por email, ni por código de rastreo, ni por alias) — quedaron sin
  // asesor. Solo el admin puede verlas y vincularlas.
  const { data: diagnostico } = useQuery<{ data: DiagnosticoAtribucion }>({
    queryKey: ['diagnostico-atribucion'],
    queryFn: () => fetcher('/reportes/diagnostico-atribucion'),
    enabled: !!token && esAdmin,
  })

  const [asesorPorAfiliado, setAsesorPorAfiliado] = useState<Record<string, string>>({})

  const resolverAtribucion = useMutation({
    mutationFn: (payload: { afiliadoHotmart: string; asesorId: string }) =>
      fetcher('/reportes/resolver-atribucion', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnostico-atribucion'] })
      queryClient.invalidateQueries({ queryKey: ['ventas-resumen'] })
      queryClient.invalidateQueries({ queryKey: ['ventas-lista'] })
    },
  })

  const r = resumen?.data
  const ventas = lista?.data ?? []
  const totalPaginas = lista?.pagination?.totalPages ?? 1

  // Los totales cuentan hacia arriba al cargar, igual que en el dashboard.
  const animVendido = useCountUp(cargandoResumen ? 0 : r?.vendido ?? 0)
  const animComision = useCountUp(cargandoResumen ? 0 : r?.comision ?? 0)
  const animCantidad = useCountUp(cargandoResumen ? 0 : r?.cantidad ?? 0)
  const animTicket = useCountUp(cargandoResumen ? 0 : r?.ticketPromedio ?? 0)

  const maxDia = Math.max(1, ...(r?.dias ?? []).map(d => d.monto))
  // 'en-CA' da el formato YYYY-MM-DD en la zona del navegador, igual que la
  // clave de día que arma el backend. `toISOString()` daría el día en UTC, que
  // a partir de las 7 p.m. en Colombia ya es el día siguiente.
  const hoyISO = new Date().toLocaleDateString('en-CA')
  const totalDias = r?.dias?.length ?? 0
  const diaSeleccionado = diaActivo != null ? r?.dias?.[diaActivo] ?? null : null

  // Recorrer la gráfica con el dedo (o el mouse): la posición horizontal dentro
  // del riel determina qué día se está mirando.
  function scrub(e: React.TouchEvent | React.MouseEvent) {
    const riel = rielRef.current
    const dias = r?.dias?.length ?? 0
    if (!riel || dias === 0) return
    const esTacto = 'touches' in e
    // El mousemove sintético que sigue al touchend movería la selección justo
    // después de haberla fijado.
    if (!esTacto && tactoReciente.current) return
    const x = esTacto ? e.touches[0]?.clientX : e.clientX
    if (x == null) return
    const { left, width } = riel.getBoundingClientRect()
    const i = Math.floor(((x - left) / width) * dias)
    setDiaActivo(Math.min(dias - 1, Math.max(0, i)))
  }

  // Al soltar el dedo (o hacer clic) el día queda fijado y la lista se filtra
  // a él. Para quitar el filtro está el botón "Ver todo el mes": deseleccionar
  // con un segundo toque se disparaba solo por el click fantasma.
  function fijarDia() {
    const d = diaActivo != null ? r?.dias?.[diaActivo] : null
    if (!d) return
    setDiaFijado(d.fecha)
    setPagina(1)
  }

  // Tras un `touchend`, el navegador móvil emite además un `click` sintético
  // en el mismo punto. Sin esta guarda, el gesto se procesaba dos veces y la
  // selección se deshacía sola.
  function fijarPorTacto() {
    tactoReciente.current = true
    fijarDia()
    setTimeout(() => { tactoReciente.current = false }, 600)
  }

  function fijarPorClic() {
    if (tactoReciente.current) return
    fijarDia()
  }

  function cambiarMes(delta: number) {
    setOffset(o => Math.max(0, o + delta))
    setPagina(1)
    setDiaActivo(null)
    setDiaFijado(null)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={esAdmin ? 'Ventas' : 'Mis ventas'}
        subtitle={esAdmin ? 'Todas las ventas del equipo, con su atribución' : 'Cada venta que cerraste, con su comisión'}
      />

      {/* Ritmo del mes */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-[11px] text-on-surface-variant font-semibold">
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
          <div className="h-28 rounded-xl bg-surface-high animate-pulse" />
        ) : (
          <>
            <div className="relative pb-px" style={{ borderBottom: '1px solid var(--surface-high)' }}>
              {/* Lupa flotante: el dedo tapa la barra, así que el día
                  seleccionado se amplía en una burbuja sobre el riel. */}
              {diaSeleccionado && totalDias > 0 && (
                <div
                  className="absolute z-10 pointer-events-none animate-fade-in"
                  style={{
                    bottom: 'calc(100% + 10px)',
                    left: `${((diaActivo! + 0.5) / totalDias) * 100}%`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  <div
                    className="rounded-xl px-3.5 py-2 text-center whitespace-nowrap"
                    style={{
                      background: 'var(--on-surface)',
                      color: 'var(--surface-lowest)',
                      boxShadow: '0 8px 22px -6px rgba(0,29,61,0.45)',
                    }}
                  >
                    <p className="text-[19px] font-bold tabular-nums leading-none">
                      {Number(diaSeleccionado.fecha.slice(8, 10))}
                      <span className="text-[11px] font-semibold opacity-70"> {MESES[inicio.getMonth()].slice(0, 3)}</span>
                    </p>
                    <p className="text-[12.5px] font-semibold tabular-nums mt-1">{formatCOP(diaSeleccionado.monto)}</p>
                  </div>
                  <div
                    className="w-2 h-2 rotate-45 mx-auto -mt-1"
                    style={{ background: 'var(--on-surface)' }}
                  />
                </div>
              )}

              <div
                ref={rielRef}
                onTouchStart={scrub}
                onTouchMove={scrub}
                onTouchEnd={fijarPorTacto}
                onMouseMove={scrub}
                onMouseLeave={() => { if (!tactoReciente.current) setDiaActivo(null) }}
                onClick={fijarPorClic}
                // pan-y deja el scroll vertical de la página intacto y nos reserva
                // el gesto horizontal para recorrer los días.
                style={{ touchAction: 'pan-y' }}
                className="flex items-end gap-[3px] h-28 cursor-crosshair select-none"
                role="img"
                aria-label={`Ventas por día de ${MESES[inicio.getMonth()]}`}
              >
                {(r?.dias ?? []).map((d, i) => (
                  <BarraDia
                    key={d.fecha}
                    dia={d}
                    alto={d.monto > 0 ? Math.max(6, (d.monto / maxDia) * 100) : 4}
                    activo={i === diaActivo || d.fecha === diaFijado}
                    esHoy={d.fecha === hoyISO}
                    futuro={d.fecha > hoyISO}
                    // Escalonado corto: 31 barras a 70 ms se harían eternas.
                    delay={i * 14}
                  />
                ))}
              </div>
            </div>
            <div className={`${mono.className} flex justify-between mt-1.5 text-[10.5px] text-on-surface-variant`}>
              <span>1</span>
              {esMesActual && <span className="text-on-surface">hoy · {new Date().getDate()}</span>}
              <span>{fin.getDate()}</span>
            </div>
          </>
        )}
      </div>

      {/* Tarjetas de resumen — mismo formato que el dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={TrendingUp} label="Vendido" valor={formatCOP(animVendido)} variacion={r?.variacion?.vendido} cargando={cargandoResumen} />
        <Kpi icon={Wallet} label="Comisión" valor={formatCOP(animComision)} valColor="#16a34a" variacion={r?.variacion?.comision} cargando={cargandoResumen} />
        <Kpi icon={Receipt} label="Ventas" valor={String(animCantidad)} variacion={r?.variacion?.cantidad} cargando={cargandoResumen} />
        <Kpi icon={Target} label="Ticket promedio" valor={formatCOP(animTicket)} variacion={r?.variacion?.ticketPromedio} cargando={cargandoResumen} />
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
          <div className="sm:w-[220px] shrink-0">
            <Select
              value={asesorId}
              onValueChange={v => { setAsesorId(v); setPagina(1) }}
              className="py-2.5 rounded-xl border-surface-high text-[13px]"
              options={[
                { value: '', label: 'Todos los asesores' },
                { value: 'sin-asesor', label: 'Sin asesor asignado' },
                ...(asesores?.data ?? []).map(a => ({ value: a.id, label: a.nombre })),
              ]}
            />
          </div>
        )}
        <div className="sm:w-[240px] shrink-0">
          <Select
            value={cursoId}
            onValueChange={v => { setCursoId(v); setPagina(1) }}
            className="py-2.5 rounded-xl border-surface-high text-[13px]"
            // Los nombres de curso son largos: el panel crece y las opciones
            // se parten en varias líneas en vez de recortarse.
            anchoAuto
            multilinea
            options={[
              { value: '', label: 'Todos los cursos' },
              ...(cursos?.data ?? []).map(c => ({ value: c.id, label: c.nombre })),
            ]}
          />
        </div>
      </div>

      {/* Desglose por asesor — solo cuando el admin mira a todos */}
      {esAdmin && !asesorId && (resumen?.data.porAsesor?.length ?? 0) > 0 && (
        <div className="card p-5">
          {/* Encabezado y filas comparten UNA rejilla, no dos layouts flex que
              haya que hacer coincidir a mano. Antes la fila tenía siete
              elementos (puesto, avatar, nombre, barra y tres cifras) y el
              encabezado cinco, así que los anchos y los `gap` se replicaban
              a ojo y bastaba que uno no calzara para que las columnas se
              corrieran. Con la rejilla, el rótulo y su cifra son la misma
              columna y no se pueden separar.

              Las dos pistas que se ocultan en móvil desaparecen de la rejilla
              con el elemento, por eso hay una plantilla de 5 y otra de 7. */}
          <div className={cn(GRID_ASESOR, 'px-2 -mx-2 pb-2 mb-1 border-b border-surface-high text-[10px] font-semibold text-on-surface-variant')}>
            <span aria-hidden />
            <span aria-hidden />
            <span className="text-[11px]">Por asesor</span>
            <span className="hidden sm:block text-center">Participación</span>
            <span className="text-center">Vendido</span>
            <span className="hidden sm:block text-center">Comisión</span>
            <span className="text-center">Ventas</span>
          </div>

          <div className="space-y-1">
            {(resumen?.data.porAsesor ?? []).map((a, i) => {
              const maxVendido = resumen?.data.porAsesor[0]?.vendido || 1
              return (
                <button
                  key={a.id}
                  onClick={() => { setAsesorId(a.id); setPagina(1) }}
                  // Sin `w-full`: con `-mx-2` el ancho automático se estira
                  // hasta cubrir los márgenes negativos, igual que el
                  // encabezado. Con `w-full` medía exacto el contenedor y
                  // además se corría 8px, así que terminaba 16px antes y todas
                  // las cifras quedaban desalineadas de su rótulo.
                  className={cn(GRID_ASESOR, 'py-2 px-2 -mx-2 rounded-lg hover:bg-surface-high transition-colors cursor-pointer text-left')}
                >
                  <span className={`${mono.className} text-[11.5px] text-on-surface-variant`}>{i + 1}</span>
                  <span className="w-8 h-8 rounded-full overflow-hidden bg-primary/15 flex items-center justify-center ring-1 ring-primary/10">
                    {a.image
                      ? <img src={a.image} alt={a.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      : <span className="text-[10px] font-bold text-primary">{iniciales(a.nombre)}</span>}
                  </span>
                  <span className="text-[13.5px] font-semibold text-on-surface truncate">{a.nombre}</span>
                  <span className="hidden sm:block h-1.5 rounded-full bg-surface-high overflow-hidden">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${Math.round((a.vendido / maxVendido) * 100)}%` }}
                    />
                  </span>
                  <span className={`${mono.className} text-[13px] font-bold text-on-surface text-center`}>
                    {formatCOP(a.vendido)}
                  </span>
                  <span className={`${mono.className} hidden sm:block text-[12px] font-semibold text-center`} style={{ color: '#16a34a' }}>
                    {formatCOP(a.comision)}
                  </span>
                  <span className={`${mono.className} text-[11.5px] text-on-surface-variant text-center`}>{a.cantidad}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Ventas sin asesor — solo admin, solo si hay pendientes por vincular */}
      {esAdmin && (diagnostico?.data.porAfiliadoNoReconocido.length ?? 0) > 0 && (
        <div className="card p-5" style={{ borderColor: '#f59e0b40' }}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#b45309' }} />
            <p className="text-[13px] font-semibold text-on-surface">Ventas sin asesor</p>
          </div>
          <p className="text-[11.5px] text-on-surface-variant mb-3.5">
            Hotmart mandó estas ventas con un nombre de afiliado que no coincide con ningún asesor.
            Vincúlalas para atribuirlas ya — las próximas ventas con el mismo nombre entrarán solas.
          </p>
          <div className="space-y-2">
            {diagnostico!.data.porAfiliadoNoReconocido.map(f => (
              <div
                key={f.afiliadoHotmart}
                className="flex flex-col sm:flex-row sm:items-center gap-2.5 py-2.5 px-3 rounded-xl bg-surface-high/40"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-on-surface truncate">{f.afiliadoHotmart}</p>
                  <p className={`${mono.className} text-[11px] text-on-surface-variant mt-0.5`}>
                    {f.cantidad} venta{f.cantidad !== 1 ? 's' : ''} · {formatCOP(f.montoTotal)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-[200px]">
                    <Select
                      value={asesorPorAfiliado[f.afiliadoHotmart] ?? ''}
                      onValueChange={v => setAsesorPorAfiliado(prev => ({ ...prev, [f.afiliadoHotmart]: v }))}
                      className="py-2 rounded-lg border-surface-high text-[12.5px]"
                      options={[
                        { value: '', label: 'Elige un asesor' },
                        ...(asesores?.data ?? []).map(a => ({ value: a.id, label: a.nombre })),
                      ]}
                    />
                  </div>
                  <button
                    onClick={() => {
                      const asesorId = asesorPorAfiliado[f.afiliadoHotmart]
                      if (!asesorId) return
                      resolverAtribucion.mutate({ afiliadoHotmart: f.afiliadoHotmart, asesorId })
                    }}
                    disabled={!asesorPorAfiliado[f.afiliadoHotmart] || resolverAtribucion.isPending}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-default cursor-pointer shrink-0"
                    style={{ background: 'var(--primary)' }}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Vincular
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Movimientos */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 mb-4 pb-4 border-b border-surface-high">
          {diaFijado ? (
            <p className="text-[13px] font-semibold text-on-surface">
              Ventas del {Number(diaFijado.slice(8, 10))} de {MESES[inicio.getMonth()]}
            </p>
          ) : (
            <p className="text-[11px] text-on-surface-variant font-semibold">
              Movimientos de {MESES[inicio.getMonth()]}
            </p>
          )}
          {diaFijado && (
            <button
              onClick={() => { setDiaFijado(null); setPagina(1) }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-on-surface-variant hover:bg-surface-high transition-colors cursor-pointer shrink-0"
            >
              Ver todo el mes <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {cargandoLista ? (
          <div className="flex items-center justify-center py-14 text-on-surface-variant">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : ventas.length === 0 ? (
          <div className="flex flex-col items-center text-center py-14 px-6">
            <Receipt className="w-8 h-8 text-on-surface-variant/50 mb-3" />
            <p className="text-[14px] font-semibold text-on-surface">
              {diaFijado
                ? `Sin ventas el ${Number(diaFijado.slice(8, 10))} de ${MESES[inicio.getMonth()]}`
                : `Sin ventas en ${MESES[inicio.getMonth()]}`}
            </p>
            <p className="text-[12.5px] text-on-surface-variant mt-1 max-w-[280px]">
              {diaFijado
                ? 'Elige otro día en la gráfica o vuelve a ver todo el mes.'
                : 'Cuando cierres una venta aparece aquí con su comisión, en cuanto Hotmart confirme el pago.'}
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
                  // Entran escalonadas; solo las primeras, para que al paginar
                  // no haya que esperar a que caiga la fila 20.
                  className={`animate-card-enter flex gap-4 items-start py-4 ${i > 0 ? 'border-t border-dashed border-surface-high' : 'pt-0'}`}
                  style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14.5px] font-semibold text-on-surface leading-snug">{v.estudiante.nombre}</p>
                      {v.enPartes && (v.cuotasTotal ?? 0) > 1 && (
                        <span
                          className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: 'var(--primary-container)', color: 'var(--primary)' }}
                        >
                          Cuota {v.cuotaNumero ?? 1} de {v.cuotasTotal}
                        </span>
                      )}
                    </div>
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
                    <p className={`${mono.className} text-[16px] font-bold text-on-surface`}>{formatCOP(v.monto)}</p>
                    {v.comisionAsesor != null && (
                      <p className={`${mono.className} text-[12px] font-semibold mt-1`} style={{ color: '#16a34a' }}>
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

// Barra de un día del mes. Crece desde cero al montar, con un retardo según su
// posición, igual que la serie de 6 meses del dashboard.
function BarraDia({
  dia, alto, activo, esHoy, futuro, delay,
}: {
  dia: { fecha: string; monto: number }
  alto: number
  activo: boolean
  esHoy: boolean
  futuro: boolean
  delay: number
}) {
  const [montada, setMontada] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMontada(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  const altoFinal = activo ? 100 : alto

  return (
    <div
      title={`${dia.fecha} · ${formatCOP(dia.monto)}`}
      className="flex-1 rounded-t-[3px]"
      style={{
        height: montada ? `${altoFinal}%` : '0%',
        transition: 'height 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms, background 200ms',
        opacity: activo ? 1 : futuro ? 0.15 : dia.monto > 0 ? 1 : 0.25,
        background: activo
          // La barra activa se estira a todo el alto como guía, con su valor
          // real marcado en color sólido y el resto apenas insinuado.
          ? `linear-gradient(to top, var(--on-surface) ${alto}%, color-mix(in srgb, var(--on-surface) 14%, transparent) ${alto}%)`
          // Color sólido de marca. Mezclar hacia transparent aquí deja ver el
          // blanco de la tarjeta detrás y la barra se lee "lavada" — para una
          // sola serie el color de marca sin degradar es lo correcto.
          : esHoy ? 'var(--on-surface)' : 'var(--primary)',
      }}
    />
  )
}

// Mismo formato que las tarjetas del dashboard del asesor (AsesorDashboard.tsx),
// para que las dos pantallas se lean igual.
function Kpi({
  icon: Icon, label, valor, valColor, variacion, cargando,
}: {
  icon: LucideIcon
  label: string
  valor: string
  valColor?: string
  variacion?: number | null
  cargando?: boolean
}) {
  // Se compara contra el mismo tramo del mes anterior. `null` o `undefined`
  // significa que ese mes no tuvo movimiento: no hay base de comparación.
  const sub =
    variacion == null
      ? 'Sin mes anterior para comparar'
      : variacion === 0
        ? 'Igual que el mes pasado'
        : `${variacion > 0 ? '▲ +' : '▼ '}${variacion}% vs mes anterior`
  const subColor = variacion == null || variacion === 0 ? undefined : variacion > 0 ? '#16a34a' : '#dc2626'

  return (
    <div className="card p-4">
      <p className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 shrink-0" /> {label}
      </p>
      {cargando ? (
        <>
          <div className="h-[22px] w-24 rounded bg-surface-high animate-pulse mt-1.5" />
          <div className="h-3 w-20 rounded bg-surface-high animate-pulse mt-2" />
        </>
      ) : (
        <>
          <p
            className="text-[22px] font-bold tabular-nums mt-1.5 leading-none truncate"
            style={valColor ? { color: valColor } : undefined}
          >
            {valor}
          </p>
          <p
            className="text-[11px] mt-1.5 truncate"
            style={{ color: subColor ?? 'var(--on-surface-variant)' }}
          >
            {sub}
          </p>
        </>
      )}
    </div>
  )
}
