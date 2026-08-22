'use client'

// Cobros freelance del área de Marketing.
//
// Pantalla propia y no una columna dentro de Entregables: un freelance puede
// estar esperando aprobación desde que se le encarga el trabajo, mucho antes
// de publicar nada, y en Entregables —que lista lo publicado— no tendría dónde
// aparecer. Además lo ya pagado se quedaría mezclado con los enlaces del mes.
//
// Se entra por la tabla de liquidación —una fila por persona— porque a un
// freelance no se le hacen cinco transferencias, se le hace una. Al elegir a
// alguien en el filtro, la pantalla se abre en el detalle de sus trabajos, con
// la misma forma de Entregables.
//
// Quién ve qué lo decide el backend: los líderes reciben los de todo el equipo
// y `puedeAprobar` en true; el resto recibe solo los suyos.

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Loader2, Wallet, BadgeCheck, AlertTriangle, ChevronDown, Search, X, Check,
  Video, LayoutGrid, Image as ImageIcon, FileText, type LucideIcon,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { cn, formatCOP } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { MonthPicker, DateRange, semanaActual } from '@/components/ui/MonthPicker'
import { FiltroResponsable, type OpcionResponsable } from '@/components/marketing/FiltroResponsable'
import { AvatarMiembro } from '@/components/marketing/AvatarMiembro'
import { ROL_LABEL } from '@/lib/roles'

type EstadoCobro = 'POR_APROBAR' | 'APROBADO' | 'PAGADO'

interface Persona {
  id: string; nombre: string
  user?: { image: string | null; role?: string | null }
  /** Qué le falta para poder cobrar; lo calcula el backend. */
  falta: string[]
  completos: boolean
}
interface Cobro {
  id: string
  titulo: string
  tipo: string
  fecha: string
  valor: number | null
  estadoCobro: EstadoCobro
  aprobadoEn: string | null
  pagadoEn: string | null
  cuentaCobroUrl: string | null
  cuentaCobroEn: string | null
  asignadoA: Persona | null
  aprobadoPor: { id: string; nombre: string } | null
  entregables: { id: string; publicadoEn: string; plataforma?: string }[]
}

interface Respuesta {
  cobros: Cobro[]
  puedeAprobar: boolean
  totales: { porAprobar: number; aprobado: number; pagado: number }
}

const TIPO_LABEL: Record<string, string> = {
  VIDEO: 'Reel', HISTORIA: 'Historia', VSL: 'VSL', CARRUSEL: 'Carrusel', CARRUMEME: 'Carrumeme',
  TIKTOKERO: 'TikTokero', GUION: 'Guion', PUBLICACION: 'Publicación', OTRO: 'Otro',
}
const PLATAFORMA_LABEL: Record<string, string> = {
  YOUTUBE: 'YouTube', INSTAGRAM: 'Instagram', TIKTOK: 'TikTok', FACEBOOK: 'Facebook', DRIVE: 'Drive', OTRO: 'Otro',
}
const ICONO_TIPO: Record<string, LucideIcon> = {
  VIDEO: Video, HISTORIA: Video, VSL: Video, TIKTOKERO: Video,
  CARRUSEL: LayoutGrid, CARRUMEME: LayoutGrid, PUBLICACION: ImageIcon, GUION: FileText,
}

const SIN_ASIGNAR = '__sin__'

function toISO(d: Date) { return format(d, 'yyyy-MM-dd') }
function rangoDelMes(month: string | null) {
  const base = month ? new Date(month + '-15') : new Date()
  return { desde: toISO(startOfMonth(base)), hasta: toISO(endOfMonth(base)) }
}

/** "jue 20 ago", para las columnas de fecha. */
const fechaCorta = (iso: string) => format(new Date(iso), 'EEE d MMM', { locale: es })

export default function CobrosPage() {
  const queryClient = useQueryClient()
  // La misma barra de Entregables (Hotman, 22-ago): por defecto la semana en
  // curso —la del ciclo de cobros—; otra semana, el mes o un rango se piden
  // desde el selector de fecha. El estado y la búsqueda filtran en el
  // navegador sobre lo ya cargado, así las pastillas cuentan sobre lo mismo
  // que se ve.
  const now = new Date()
  const currentMonth = format(now, 'yyyy-MM')
  const [month, setMonth] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | null>(() => semanaActual())
  const [estado, setEstado] = useState<'' | 'POR_APROBAR' | 'APROBADO'>('')
  const [persona, setPersona] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const { desde, hasta } = dateRange
    ? { desde: toISO(dateRange.start), hasta: toISO(dateRange.end) }
    : rangoDelMes(month)

  const { data, isLoading } = useQuery({
    queryKey: ['marketing-cobros', desde, hasta],
    queryFn: () => apiFetch<{ data: Respuesta }>(`/marketing/cobros?desde=${desde}&hasta=${hasta}`),
  })
  const r = data?.data
  const todos = r?.cobros ?? []
  // Por título del trabajo o por nombre de quien lo tiene.
  const q = busqueda.trim().toLowerCase()
  const delPeriodo = q
    ? todos.filter(c => c.titulo.toLowerCase().includes(q) || (c.asignadoA?.nombre ?? '').toLowerCase().includes(q))
    : todos
  const conteos = {
    todos: delPeriodo.length,
    porAprobar: delPeriodo.filter(c => c.estadoCobro === 'POR_APROBAR').length,
    aprobados: delPeriodo.filter(c => c.estadoCobro !== 'POR_APROBAR').length,
  }
  const cobros = estado === ''
    ? delPeriodo
    : delPeriodo.filter(c => (estado === 'POR_APROBAR') === (c.estadoCobro === 'POR_APROBAR'))
  const puedeAprobar = r?.puedeAprobar ?? false

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['marketing-cobros'] })

  // Desde aquí solo se aprueba. El pago no lo marca nadie del equipo: lo
  // registra contabilidad desde su módulo cuando de verdad gira, así que no
  // hay botón de "pagado" en esta pantalla (Hotman, 22-ago).
  const mover = useMutation({
    mutationFn: (id: string) => apiFetch(`/marketing/cobros/${id}/aprobar`, { method: 'PATCH' }),
    onSuccess: invalidar,
  })

  const ocupado = mover.isPending

  // Qué bloques abrió la persona a mano. Por defecto TODOS plegados: se
  // entra, se ve la liquidación por persona, y se abre el que se quiera —
  // llegar con todo desplegado era ruido (Hotman, 22-ago).
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const alternar = (id: string) => setAbiertos(prev => {
    const s = new Set(prev)
    s.has(id) ? s.delete(id) : s.add(id)
    return s
  })

  /** Un empujón a quien no ha llenado sus datos, en vez de esperar al giro. */
  const recordar = useMutation({
    mutationFn: (miembroId: string) =>
      apiFetch(`/marketing/miembros/${miembroId}/recordar-datos`, { method: 'POST' }),
    onSuccess: () => alert('Le llegó el recordatorio.'),
    onError: (e: Error) => alert(e.message || 'No se pudo enviar'),
  })


  // Una entrada por persona con sus tres montos. Se arma sobre lo mismo que se
  // lista, así que la tabla y el detalle nunca pueden discrepar.
  const porPersona = useMemo(() => {
    const mapa = new Map<string, {
      id: string; nombre: string; foto: string | null; rol: string | null
      falta: string[]; completos: boolean
      cobros: Cobro[]; porAprobar: number; aprobado: number; pagado: number
    }>()
    for (const c of cobros) {
      const id = c.asignadoA?.id ?? SIN_ASIGNAR
      // La firma dejó de pedirse, pero el servidor puede seguir enviándola en
      // la lista de faltantes hasta que suba la versión nueva; mientras tanto
      // marcaría a todo el equipo con un dato imposible de llenar y les
      // frenaría el cobro (Hotman, 20-ago).
      const faltaReal = (c.asignadoA?.falta ?? []).filter(f => !/firma/i.test(f))
      if (!mapa.has(id)) mapa.set(id, {
        id,
        nombre: c.asignadoA?.nombre ?? 'Sin asignar',
        foto:   c.asignadoA?.user?.image ?? null,
        // El oficio (editor, community…) sale del rol de la cuenta.
        rol:    ROL_LABEL[(c.asignadoA?.user?.role ?? '') as keyof typeof ROL_LABEL] ?? null,
        falta:  faltaReal,
        completos: (c.asignadoA?.completos ?? false) || faltaReal.length === 0,
        cobros: [], porAprobar: 0, aprobado: 0, pagado: 0,
      })
      const g = mapa.get(id)!
      g.cobros.push(c)
      const v = c.valor ?? 0
      if (c.estadoCobro === 'POR_APROBAR') g.porAprobar += v
      else if (c.estadoCobro === 'APROBADO') g.aprobado += v
      else g.pagado += v
    }
    return [...mapa.values()].sort((a, b) =>
      // Primero a quien hay que pagarle: lo pendiente manda sobre el alfabeto.
      (b.porAprobar + b.aprobado) - (a.porAprobar + a.aprobado) || a.nombre.localeCompare(b.nombre),
    )
  }, [cobros])

  /**
   * La tabla de trabajos: cabecera de columnas y una fila por trabajo (tipo,
   * cuándo se entregó, valor y en qué va). Antes cada trabajo era una fila
   * suelta con el detalle en prosa; en columnas, Cristal compara de un
   * vistazo y el botón de aprobar queda siempre en el mismo sitio (Hotman,
   * 22-ago). En celular se quedan título, valor y estado; tipo y fecha pasan
   * al subtítulo.
   *
   * Viven dentro de la página porque necesitan la mutación y los permisos, y
   * pasárselos sueltos serían ocho props para nada.
   */
  const COLUMNAS = 'md:grid-cols-[minmax(0,1fr)_110px_120px_110px_150px]'

  function CabeceraTrabajos() {
    return (
      <div className={cn('hidden gap-x-3 border-b border-outline-variant/60 bg-surface-low/40 py-1.5 pl-[60px] pr-4 text-[10.5px] text-on-surface-variant md:grid', COLUMNAS)}>
        <span>Trabajo</span><span>Tipo</span><span>Entregado</span>
        <span className="text-right">Valor</span><span className="text-right">Estado</span>
      </div>
    )
  }

  function FilaTrabajo({ c }: { c: Cobro }) {
    const Icono = ICONO_TIPO[c.tipo] ?? Wallet
    const tipo = TIPO_LABEL[c.tipo] ?? c.tipo
    const entregado = c.entregables[0]?.publicadoEn ? fechaCorta(c.entregables[0].publicadoEn) : null
    const plataformas = [...new Set(c.entregables.map(e => e.plataforma).filter(Boolean))]
      .map(pl => PLATAFORMA_LABEL[pl!] ?? pl).join(' · ')
    // "Cristal · 21 ago": quién aprobó y cuándo, debajo del sello.
    const quienAprobo = c.aprobadoPor?.nombre.split(' ')[0]

    const estado = c.estadoCobro === 'POR_APROBAR'
      ? puedeAprobar
        ? (
          <button
            onClick={() => mover.mutate(c.id)}
            disabled={ocupado}
            className="shrink-0 cursor-pointer rounded-lg bg-[#0f7a35] px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <BadgeCheck className="mr-1 inline size-3.5" />Aprobar
          </button>
        )
        : <span className="rounded-full bg-[#d97706]/15 px-2.5 py-1 text-[10px] font-bold text-[#9a5b06]">Por aprobar</span>
      : (
        <span className="text-right text-[11px] font-semibold leading-[1.35] text-[#0f7a35]">
          {c.estadoCobro === 'PAGADO' ? 'Pagado' : 'Aprobado'}
          <small className="block text-[10.5px] font-normal text-on-surface-variant">
            {c.estadoCobro === 'PAGADO'
              ? (c.pagadoEn ? fechaCorta(c.pagadoEn) : '')
              : [quienAprobo, c.aprobadoEn ? fechaCorta(c.aprobadoEn) : null].filter(Boolean).join(' · ')}
          </small>
        </span>
      )

    return (
      <div className={cn('grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-2.5', COLUMNAS)}>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-[#7c3aed]/12">
            <Icono className="size-3.5 text-[#7c3aed]" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-semibold text-on-surface">{c.titulo}</p>
            <p className="truncate text-[10.5px] text-on-surface-variant">
              <span className="md:hidden">{tipo}{entregado ? ` · ${entregado}` : ''}</span>
              <span className="hidden md:inline">{plataformas || 'Sin enlace'}</span>
            </p>
          </div>
        </div>
        <span className="hidden md:block">
          <span className="inline-block rounded-md border border-outline-variant bg-surface-lowest px-1.5 py-px text-[10.5px] font-semibold text-on-surface-variant">{tipo}</span>
        </span>
        <span className="hidden text-[12px] text-on-surface-variant md:block">{entregado ?? '—'}</span>
        <span className="text-right text-[12.5px] font-semibold tabular-nums text-on-surface">
          {c.valor != null ? formatCOP(c.valor) : 'Sin valor'}
        </span>
        <div className="flex justify-end">{estado}</div>
      </div>
    )
  }

  const elegida = persona ? porPersona.find(p => p.id === persona) ?? null : null

  // El tablero de la semana (Hotman, 22-ago): cuánto va aprobado, cuánto
  // falta y cuándo sale, con su avance. Se cuenta sobre lo cargado del
  // período (o de la persona elegida), no sobre lo filtrado por búsqueda.
  const montoAprobado   = elegida ? elegida.aprobado   : (r?.totales.aprobado ?? 0)
  const montoPorAprobar = elegida ? elegida.porAprobar : (r?.totales.porAprobar ?? 0)
  const baseTablero = elegida ? elegida.cobros : todos
  const trabajosAprobados = baseTablero.filter(c => c.estadoCobro !== 'POR_APROBAR')
  const trabajosPorAprobar = baseTablero.length - trabajosAprobados.length
  const personasAprobadas = new Set(trabajosAprobados.map(c => c.asignadoA?.id ?? SIN_ASIGNAR)).size
  const sumaTablero = montoAprobado + montoPorAprobar
  const pctAprobado = sumaTablero > 0 ? Math.round((montoAprobado / sumaTablero) * 100) : 0
  // El sábado que viene (o hoy, si es sábado): a las 11:59 pm sale una cuenta
  // de cobro por persona al Drive.
  const proximoCorte = (() => {
    const hoy = new Date()
    const d = new Date(hoy)
    d.setDate(hoy.getDate() + ((6 - hoy.getDay() + 7) % 7))
    const esHoy = d.toDateString() === hoy.toDateString()
    const texto = format(d, "EEEE d 'de' MMMM", { locale: es })
    return `${esHoy ? 'Hoy, ' + texto : texto.charAt(0).toUpperCase() + texto.slice(1)} · 11:59 pm`
  })()

  const idsEn = (lista: Cobro[], e: EstadoCobro) =>
    lista.filter(c => c.estadoCobro === e).map(c => c.id)

  const responsables: OpcionResponsable[] = porPersona.map(p => ({
    id: p.id, nombre: p.nombre, foto: p.foto, total: p.cobros.length,
    pendientes: idsEn(p.cobros, 'POR_APROBAR').length,
  }))
  const desgloseCobros = (o: OpcionResponsable) => {
    const aprobados = o.total - o.pendientes
    return [
      o.pendientes > 0 ? `${o.pendientes} por aprobar` : null,
      aprobados > 0 ? `${aprobados} aprobado${aprobados !== 1 ? 's' : ''}` : null,
    ].filter(Boolean).join(' · ')
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title={puedeAprobar ? 'Cobros freelance' : 'Mis cobros'} />

      {/* Los totales salen de lo mismo que se lista, así que siempre cuadran
          con las filas de abajo. */}
      {/* El tablero de la semana (Hotman, 22-ago): aprobado, por aprobar y el
          próximo corte en una sola tarjeta, con su avance. Reemplazó a las dos
          tarjetas sueltas, que se quedaban cortas. */}
      <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-outline-variant">
          <div className="sm:pr-5">
            <p className="text-[11px] text-on-surface-variant">Aprobado</p>
            <p className="mt-1 text-[22px] font-bold tracking-[-0.02em] tabular-nums text-[#0f7a35]">{isLoading ? '—' : formatCOP(montoAprobado)}</p>
            <p className="mt-1.5 text-[11px] text-on-surface-variant">
              {trabajosAprobados.length} trabajo{trabajosAprobados.length !== 1 ? 's' : ''} · {personasAprobadas} persona{personasAprobadas !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="sm:px-5">
            <p className="text-[11px] text-on-surface-variant">Por aprobar</p>
            <p className="mt-1 text-[22px] font-bold tracking-[-0.02em] tabular-nums text-[#9a5b06]">{isLoading ? '—' : formatCOP(montoPorAprobar)}</p>
            <p className="mt-1.5 text-[11px]">
              {trabajosPorAprobar > 0
                ? <span className="text-on-surface-variant">{trabajosPorAprobar} trabajo{trabajosPorAprobar !== 1 ? 's' : ''} esperando aprobación</span>
                : <span className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10.5px] font-bold text-[#166534]"><Check className="size-3" />Nada pendiente</span>}
            </p>
          </div>
          <div className="sm:pl-5">
            <p className="text-[11px] text-on-surface-variant">Próximo corte</p>
            <p className="mt-1 text-[16px] font-bold tracking-[-0.01em] text-on-surface">{proximoCorte}</p>
            <p className="mt-1.5 text-[11px] text-on-surface-variant">Sale una cuenta de cobro por persona al Drive</p>
          </div>
        </div>
        {sumaTablero > 0 && (
          <>
            <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-[#fde68a]" aria-hidden>
              <span className="h-full rounded-full bg-[#16a34a]" style={{ width: `${pctAprobado}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-on-surface-variant">
              <span><span className="mr-1.5 inline-block size-2 rounded-full bg-[#16a34a] align-middle" /><b className="font-semibold text-on-surface">{pctAprobado} %</b> aprobado</span>
              <span><span className="mr-1.5 inline-block size-2 rounded-full bg-[#f59e0b] align-middle" /><b className="font-semibold text-on-surface">{100 - pctAprobado} %</b> por aprobar</span>
            </div>
          </>
        )}
      </div>

      {/* La barra de Entregables, debajo de las tarjetas (Hotman, 22-ago):
          buscar · responsable · período · estado. El buscador es el único
          elástico; los demás nunca se parten de línea. */}
      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 max-[900px]:flex-wrap max-[900px]:overflow-visible">
        <label className="flex h-[38px] min-w-[130px] flex-1 items-center gap-2 rounded-lg border border-outline-variant bg-surface-lowest px-3 transition-colors focus-within:border-primary">
          <Search className="size-3.5 shrink-0 text-on-surface-variant" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar un trabajo o una persona…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-on-surface outline-none placeholder:text-on-surface-variant/60"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              aria-label="Limpiar búsqueda"
              className="grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-full bg-surface-high text-on-surface-variant transition-colors hover:bg-surface-highest hover:text-on-surface"
            >
              <X className="size-2.5" strokeWidth={3} />
            </button>
          )}
        </label>

        {/* Elegir a alguien abre su detalle; "Todo el equipo" vuelve a la
            liquidación. */}
        {puedeAprobar && (
          <FiltroResponsable
            valor={persona}
            onCambio={setPersona}
            opciones={responsables}
            total={conteos.todos}
            desglose={desgloseCobros}
          />
        )}

        <div className="shrink-0">
          <MonthPicker
            value={month}
            currentMonth={currentMonth}
            dateRange={dateRange}
            onChange={(m, rg) => { setMonth(m); setDateRange(rg) }}
            comoPeriodo
          />
        </div>

        <div className="flex h-[38px] shrink-0 items-center gap-0.5 rounded-xl border border-outline-variant bg-surface-low p-[3px]" role="group" aria-label="Filtrar por estado">
          {([
            { v: ''            as const, texto: 'Todos',       n: conteos.todos,      color: null },
            { v: 'POR_APROBAR' as const, texto: 'Por aprobar', n: conteos.porAprobar, color: '#d97706' },
            { v: 'APROBADO'    as const, texto: 'Aprobados',   n: conteos.aprobados,  color: '#16a34a' },
          ]).map(o => (
            <button
              key={o.v}
              type="button"
              onClick={() => setEstado(o.v)}
              aria-pressed={estado === o.v}
              className={cn(
                'inline-flex h-[30px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[12.5px] transition-colors',
                estado === o.v
                  ? 'bg-surface-lowest font-semibold text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              {o.color && <span className="size-[7px] shrink-0 rounded-full" style={{ background: o.color }} />}
              {o.texto}
              <span className={cn(
                'font-semibold tabular-nums',
                estado === o.v ? 'text-on-surface' : 'text-on-surface-variant opacity-75',
              )}>
                {o.n}
              </span>
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="card-panel flex items-center justify-center py-16 text-on-surface-variant">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : cobros.length === 0 ? (
        <div className="card-panel py-16 text-center text-[13px] text-on-surface-variant">
          No hay cobros freelance en este período.
        </div>

      /* ── Liquidación: cada persona con los trabajos que componen su cifra ─
         Se aprueba trabajo, no gente: para firmar que hay que pagar $250.000
         hay que ver que son cinco carruseles de $50.000, y poder dejar fuera
         el que quedó a medias. Antes era una fila por persona con tres
         columnas de plata —dos de ellas siempre en guion, porque un cobro
         está en una sola etapa— y un "Aprobar todo" sin ver qué (Hotman,
         20-ago). */
      ) : puedeAprobar && !elegida ? (
        <div className="space-y-2.5">
          {porPersona.map(p => {
            const n = p.cobros.length
            const pendientes = idsEn(p.cobros, 'POR_APROBAR').length
            const total = p.porAprobar + p.aprobado + p.pagado
            const listo = p.aprobado + p.pagado
            const abierto = abiertos.has(p.id)
            const faltante = p.id !== SIN_ASIGNAR && !p.completos
              ? (p.falta.length === 1 ? `Falta ${p.falta[0]}` : `Le faltan ${p.falta.length} datos`)
              : null
            return (
              <div key={p.id} className="card-panel overflow-hidden p-0">
                {/* La ficha: quién, el total con su sello y el botón de abrir.
                    El centro va vacío salvo que haya algo que decir. */}
                <div className="grid grid-cols-[minmax(0,1fr)_auto_32px] items-center gap-x-3 gap-y-3 px-4 py-3.5 md:grid-cols-[270px_minmax(0,1fr)_150px_32px] md:gap-x-4">
                  <button
                    type="button"
                    onClick={() => alternar(p.id)}
                    className="flex min-w-0 cursor-pointer items-center gap-3 text-left"
                  >
                    <span className="relative shrink-0">
                      {p.id === SIN_ASIGNAR
                        ? <span className="grid size-10 place-items-center rounded-full bg-surface-high">
                            <Wallet className="size-4 text-on-surface-variant" />
                          </span>
                        : <AvatarMiembro id={p.id} nombre={p.nombre} image={p.foto} size={40} />}
                      {/* El punto de estado: verde con su chulo si ya está todo
                          aprobado, ámbar si falta algo. */}
                      <span
                        aria-hidden
                        className={cn(
                          'absolute -bottom-px -right-px grid size-[15px] place-items-center rounded-full border-2 border-surface-lowest',
                          pendientes > 0 ? 'bg-[#f59e0b]' : 'bg-[#16a34a]',
                        )}
                      >
                        {pendientes === 0 && <Check className="size-2 text-white" strokeWidth={4} />}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-on-surface">{p.nombre}</span>
                      <span className="block truncate text-[11px] text-on-surface-variant">
                        {[p.rol, `${n} trabajo${n !== 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>

                  {/* El centro solo habla cuando hace falta: la plata repartida
                      si hay algo pendiente, y en rojo lo que falte. Ni barra
                      de avance —la da el tablero de arriba— ni los títulos:
                      para eso se abre la ficha (Hotman, 22-ago). */}
                  <div className="order-last col-span-3 min-w-0 empty:hidden md:order-none md:col-span-1 md:empty:block">
                    {(pendientes > 0 || faltante) && (
                      <p className="flex flex-wrap gap-x-3.5 text-[11px] text-on-surface-variant">
                        {pendientes > 0 && listo > 0 && (
                          <span><b className="font-semibold text-[#0f7a35]">{formatCOP(listo)}</b> aprobado</span>
                        )}
                        {pendientes > 0 && (
                          <span><b className="font-semibold text-[#9a5b06]">{formatCOP(p.porAprobar)}</b> por aprobar</span>
                        )}
                        {faltante && <span className="font-semibold text-[#b91c1c]">{faltante}</span>}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-[18px] font-semibold leading-none tracking-[-0.015em] tabular-nums text-on-surface">
                      {formatCOP(total)}
                    </p>
                    <p className="mt-1.5">
                      {pendientes > 0
                        ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fef3c7] px-2 py-0.5 text-[10.5px] font-bold text-[#92400e]"><span className="size-[7px] rounded-full bg-[#d97706]" />{pendientes} por aprobar</span>
                        : <span className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10.5px] font-bold text-[#166534]"><Check className="size-3" strokeWidth={3} />Todo aprobado</span>}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => alternar(p.id)}
                    aria-expanded={abierto}
                    aria-label={abierto ? 'Ocultar los trabajos' : 'Ver los trabajos'}
                    className="grid size-8 cursor-pointer place-items-center rounded-full border border-outline-variant bg-surface-lowest text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
                  >
                    <ChevronDown className={cn('size-3.5 transition-transform', abierto && 'rotate-180')} />
                  </button>
                </div>

                {abierto && (
                  <div className="border-t border-outline-variant/60">
                    {/* La consecuencia, no la cuenta: "le faltan 9 datos" no
                        dice qué pasa si se aprueba igual. */}
                    {faltante && (
                      <div className="flex flex-wrap items-center gap-2.5 border-b border-outline-variant bg-[#dc2626]/[0.06] px-4 py-2.5 text-[11.5px] text-on-surface">
                        <AlertTriangle className="size-3.5 shrink-0 text-[#dc2626]" />
                        <span className="min-w-0 flex-1">
                          Sin {p.falta.join(', ')} no se le puede girar aunque se apruebe.
                        </span>
                        <button
                          type="button"
                          onClick={() => recordar.mutate(p.id)}
                          disabled={recordar.isPending}
                          className="shrink-0 cursor-pointer text-[11.5px] font-semibold text-[#dc2626] hover:underline disabled:opacity-50"
                        >
                          {recordar.isPending && recordar.variables === p.id ? 'Enviando…' : 'Recordárselo'}
                        </button>
                      </div>
                    )}
                    <CabeceraTrabajos />
                    <div className="divide-y divide-outline-variant/50">
                      {p.cobros.map(c => <FilaTrabajo key={c.id} c={c} />)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

      /* ── Detalle: los trabajos de una persona (o los propios) ──────────── */
      ) : (
        <div className="card-panel overflow-hidden p-0">
          {elegida && (
            <div className="flex items-center gap-2.5 border-b border-outline-variant px-4 py-3">
              {elegida.id === SIN_ASIGNAR
                ? <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-high">
                    <Wallet className="size-3.5 text-on-surface-variant" />
                  </span>
                : <AvatarMiembro id={elegida.id} nombre={elegida.nombre} image={elegida.foto} size={32} />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-on-surface">{elegida.nombre}</span>
                {elegida.id !== SIN_ASIGNAR && !elegida.completos && (
                  <span className="flex items-center gap-1 text-[10.5px] font-semibold text-[#9a5b06]">
                    <AlertTriangle className="size-2.5" /> Falta {elegida.falta.join(', ')}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setPersona('')}
                className="shrink-0 cursor-pointer text-[11px] font-semibold text-primary hover:underline"
              >
                Ver todo el equipo
              </button>
            </div>
          )}

          <CabeceraTrabajos />
          <div className="divide-y divide-outline-variant/50">
            {(elegida ? elegida.cobros : cobros).map(c => <FilaTrabajo key={c.id} c={c} />)}
          </div>
        </div>
      )}
    </div>
  )
}
