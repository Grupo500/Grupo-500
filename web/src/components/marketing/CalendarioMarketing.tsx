'use client'

import { useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  add, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isEqual, isSameDay, isSameMonth, isToday, startOfMonth, startOfToday, startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Link2, Upload, Loader2, CalendarDays,
  ArrowUpRight, Video, LayoutGrid, FileText, Megaphone, type LucideIcon,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { AvatarMiembro } from './AvatarMiembro'
import { PUEDE_ASIGNAR } from '@/lib/visibilidadMarketing'

export interface Miembro { id: string; nombre: string; activo: boolean; userId?: string; rol?: string; user?: { image: string | null } }
export interface EntregableDto { id: string; plataforma: string; url: string | null; videoUrl: string | null; publicadoEn: string }
/** Una ronda de correcciones. `resueltaEn` en null = todavía pendiente. */
export interface CorreccionDto {
  id: string
  mensaje: string
  createdAt: string
  resueltaEn: string | null
  /** Quién la escribió. Solo esa persona (y un admin) puede corregirla o retirarla. */
  pedidaPorId?: string | null
  pedidaPor?: { nombre: string | null; email: string; image: string | null } | null
}
export interface Contenido {
  id: string
  titulo: string
  tipo: 'VIDEO' | 'VSL' | 'CARRUSEL' | 'CARRUMEME' | 'TIKTOKERO' | 'GUION' | 'PUBLICACION' | 'OTRO'
  destino: 'SEBASTIAN_PERSONAL' | 'ANDRES_PERSONAL' | 'PREICFES' | 'PREMEDICO' | null
  clasificacion: 'ORGANICO' | 'PAUTA'
  tipoTrabajo: 'EMPRESA' | 'FREELANCE'
  /** Solo en los freelance; en los de empresa siempre null. */
  valor: number | null
  fecha: string
  estado: 'PLANIFICADO' | 'EN_PROCESO' | 'PUBLICADO'
  notas: string | null
  asignadoA: Miembro | null
  /** Quién repartió el trabajo (userId); null si se lo puso uno mismo. */
  asignadoPorId?: string | null
  entregables: EntregableDto[]
  correcciones?: CorreccionDto[]
}

const TIPO_LABEL: Record<Contenido['tipo'], string> = {
  VIDEO: 'Reel', VSL: 'VSL', CARRUSEL: 'Carrusel', CARRUMEME: 'Carrumeme', TIKTOKERO: 'TikTokero',
  GUION: 'Guion', PUBLICACION: 'Publicación', OTRO: 'Otro',
}
const ESTADO_LABEL: Record<Contenido['estado'], string> = { PLANIFICADO: 'Planificado', EN_PROCESO: 'En proceso', PUBLICADO: 'Publicado' }
const ESTADO_COLOR: Record<Contenido['estado'], string> = {
  PLANIFICADO: 'var(--outline)',
  EN_PROCESO:  '#f59e0b',
  PUBLICADO:   '#16a34a',
}
const DESTINO_LABEL: Record<NonNullable<Contenido['destino']>, string> = {
  SEBASTIAN_PERSONAL: 'Sebastián personal',
  ANDRES_PERSONAL: 'Andrés personal',
  PREICFES: 'Preicfes',
  PREMEDICO: 'Premédico',
}
const CLASIFICACION_LABEL: Record<Contenido['clasificacion'], string> = { ORGANICO: 'Orgánico', PAUTA: 'Pauta' }
const TRABAJO_LABEL: Record<Contenido['tipoTrabajo'], string> = { EMPRESA: 'Empresa', FREELANCE: 'Freelance' }

/** Miles con punto mientras se escribe; el input guarda solo los dígitos. */
const milesCO = (n: number) => n.toLocaleString('es-CO')
const PLATAFORMAS = ['YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'DRIVE', 'OTRO']
const PLATAFORMA_LABEL: Record<string, string> = {
  YOUTUBE: 'YouTube', INSTAGRAM: 'Instagram', TIKTOK: 'TikTok', FACEBOOK: 'Facebook', DRIVE: 'Drive', OTRO: 'Otro',
}

// El avatar y su color viven en AvatarMiembro: los usan también el tablero y
// la pantalla de entregables, y tenerlos aquí obligaba a importar el calendario
// entero para dibujar un círculo.
export { colorAvatar } from './AvatarMiembro'

function toISO(d: Date) { return format(d, 'yyyy-MM-dd') }

/** `fecha` viene como YYYY-MM-DD; se ancla a medianoche local. */
function deISO(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(a, m - 1, d)
}

/** El icono que encabeza la ficha, según lo que sea la pieza. */
const ICONO_TIPO: Record<Contenido['tipo'], LucideIcon> = {
  VIDEO: Video, VSL: Video, TIKTOKERO: Video,
  CARRUSEL: LayoutGrid, CARRUMEME: LayoutGrid,
  GUION: FileText, PUBLICACION: Megaphone, OTRO: Megaphone,
}

/** Una dirección legible: sin protocolo ni www, que en un enlace son ruido. */
function direccionCorta(u: string) {
  return u.replace(/^https?:\/\//, '').replace(/^www\./, '')
}

/**
 * Un campo del formulario: etiqueta arriba, control debajo.
 *
 * `obligatorio` lo dice con la palabra y no con un asterisco: el asterisco solo
 * significa algo para quien ya sabe qué significa (Hotman, 20-ago).
 */
function Campo({ label, obligatorio, ayuda, children }: {
  label: string
  obligatorio?: boolean
  ayuda?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11.5px] font-medium text-on-surface-variant">
        {label}
        {obligatorio && (
          <span className="ml-1.5 text-[9.5px] font-semibold uppercase tracking-wider text-[#d97706]">
            obligatorio
          </span>
        )}
        {ayuda && <span className="font-normal text-outline"> · {ayuda}</span>}
      </label>
      {children}
    </div>
  )
}

/** Dos o tres opciones que se eligen de un clic, sin desplegar una lista. */
function Segmentado<T extends string>({ valor, onCambio, opciones }: {
  valor: T
  onCambio: (v: T) => void
  opciones: { valor: T; texto: string; color?: string }[]
}) {
  return (
    <div className="flex gap-1.5">
      {opciones.map(o => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onCambio(o.valor)}
          aria-pressed={valor === o.valor}
          className={cn(
            'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border py-2 text-[12.5px] transition-colors',
            valor === o.valor
              ? 'border-primary bg-primary-container font-semibold text-on-surface'
              : 'border-outline-variant bg-surface-lowest text-on-surface-variant hover:border-outline',
          )}
        >
          {o.color && <span className="size-[7px] shrink-0 rounded-full" style={{ background: o.color }} />}
          {o.texto}
        </button>
      ))}
    </div>
  )
}

/**
 * Fecha del contenido: el día en grande, y al tocar "Cambiar" se abre un
 * selector de mes que además muestra qué hay ya agendado en el día elegido
 * — que es lo útil al programar, para no amontonar tres cosas el mismo día.
 */
function CampoFecha({ valor, onCambio, agenda, idActual }: {
  valor: string
  onCambio: (iso: string) => void
  agenda: Contenido[]
  idActual?: string
}) {
  const elegido = deISO(valor)
  const [abierto, setAbierto] = useState(false)
  const [mes, setMes] = useState(startOfMonth(elegido))

  const dias = useMemo(() => eachDayOfInterval({
    start: startOfWeek(mes, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(mes), { weekStartsOn: 1 }),
  }), [mes])

  // Lo que ya hay ese día, sin contar el contenido que se está editando.
  const delDia = agenda.filter(c => c.id !== idActual && isSameDay(deISO(c.fecha), elegido))
  const cuantosEn = (d: Date) =>
    agenda.filter(c => c.id !== idActual && isSameDay(deISO(c.fecha), d)).length

  return (
    <div className="rounded-xl border border-outline-variant">
      {/* Una línea, como los demás campos del formulario. Antes era una tarjeta
          con el día en 21px flotando encima del formulario, y se leía como
          parte del encabezado en vez de como un dato de la pieza. */}
      <button
        type="button"
        onClick={() => { setMes(startOfMonth(elegido)); setAbierto(a => !a) }}
        className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <CalendarDays className="size-[15px] shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-[13px] text-on-surface first-letter:uppercase">
          {format(elegido, "EEEE d 'de' MMMM", { locale: es })}
        </span>
        <span className="shrink-0 text-[11px] text-primary underline underline-offset-2">
          {abierto ? 'Listo' : 'Cambiar'}
        </span>
      </button>

      {abierto && (
        <div className="border-t border-outline-variant p-3">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMes(m => add(m, { months: -1 }))}
              aria-label="Mes anterior"
              className="grid size-6 cursor-pointer place-items-center rounded-md text-on-surface-variant hover:bg-surface-high"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="text-[12px] font-semibold first-letter:uppercase">
              {format(mes, "MMMM 'de' yyyy", { locale: es })}
            </span>
            <button
              type="button"
              onClick={() => setMes(m => add(m, { months: 1 }))}
              aria-label="Mes siguiente"
              className="grid size-6 cursor-pointer place-items-center rounded-md text-on-surface-variant hover:bg-surface-high"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
              <span key={i} className="grid h-6 place-items-center text-[9.5px] font-bold text-on-surface-variant">
                {d}
              </span>
            ))}
            {dias.map(d => {
              const sel = isSameDay(d, elegido)
              const n = cuantosEn(d)
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => onCambio(toISO(d))}
                  className={cn(
                    'relative grid h-7 cursor-pointer place-items-center rounded-md text-[11.5px] tabular-nums transition-colors',
                    sel
                      ? 'bg-primary font-semibold text-on-primary'
                      : isSameMonth(d, mes)
                        ? 'text-on-surface hover:bg-surface-high'
                        : 'text-on-surface-variant/45 hover:bg-surface-high',
                  )}
                >
                  {format(d, 'd')}
                  {/* Punto: ese día ya tiene algo programado. */}
                  {n > 0 && (
                    <span
                      className={cn(
                        'absolute bottom-[3px] size-1 rounded-full',
                        sel ? 'bg-on-primary' : 'bg-primary',
                      )}
                    />
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-3 border-t border-outline-variant pt-2.5">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-on-surface-variant">
              Ese día
            </p>
            {delDia.length === 0 ? (
              <p className="text-[11.5px] text-on-surface-variant">Nada programado todavía.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {delDia.map(c => (
                  <div
                    key={c.id}
                    className="relative rounded-md bg-surface-low py-1.5 pl-5 pr-2 text-[11.5px]"
                  >
                    <span
                      className="absolute inset-y-1.5 left-2 w-1 rounded-full"
                      style={{ background: ESTADO_COLOR[c.estado] }}
                    />
                    <span className="block truncate font-medium text-on-surface">{c.titulo}</span>
                    <span className="block text-[10px] text-on-surface-variant">
                      {TIPO_LABEL[c.tipo]} · {c.asignadoA?.nombre ?? 'sin responsable'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function CalendarioMarketing() {
  const queryClient = useQueryClient()
  const today = startOfToday()
  const isDesktop = useMediaQuery('(min-width: 768px)')

  const [mesActivo, setMesActivo] = useState(startOfMonth(today))
  const [diaSeleccionado, setDiaSeleccionado] = useState(today)
  const [modal, setModal] = useState<{ modo: 'crear'; fecha: Date } | { modo: 'editar'; contenido: Contenido } | null>(null)

  const dias = useMemo(() => eachDayOfInterval({
    start: startOfWeek(mesActivo, { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(mesActivo), { weekStartsOn: 0 }),
  }), [mesActivo])

  const desde = toISO(dias[0])
  const hasta = toISO(dias[dias.length - 1])

  const { data: miembrosData } = useQuery({
    queryKey: ['marketing-miembros'],
    queryFn: () => apiFetch<{ data: Miembro[] }>('/marketing/miembros'),
    staleTime: 5 * 60_000,
  })
  const miembros = miembrosData?.data ?? []

  const { data: contenidosData, isLoading } = useQuery({
    queryKey: ['marketing-contenidos', desde, hasta],
    queryFn: () => apiFetch<{ data: Contenido[] }>(`/marketing/contenidos?desde=${desde}&hasta=${hasta}`),
    staleTime: 30_000,
  })
  const contenidos = contenidosData?.data ?? []

  const porDia = (d: Date) => contenidos.filter(c => isSameDay(new Date(c.fecha), d))

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['marketing-contenidos'] })

  const abrirDia = (d: Date) => {
    setDiaSeleccionado(d)
    if (!isSameMonth(d, mesActivo)) setMesActivo(startOfMonth(d))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[17px] font-bold text-on-surface capitalize leading-tight">
            {format(mesActivo, 'MMMM yyyy', { locale: es })}
          </h2>
          <p className="text-[12px] text-on-surface-variant mt-0.5">Planificación y asignación de contenido</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-outline-variant overflow-hidden">
            <button onClick={() => setMesActivo(m => add(m, { months: -1 }))} className="p-2 hover:bg-surface-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer" aria-label="Mes anterior">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => { setMesActivo(startOfMonth(today)); setDiaSeleccionado(today) }} className="px-3 py-2 text-[12px] font-semibold text-on-surface hover:bg-surface-high transition-colors cursor-pointer border-x border-outline-variant">
              Hoy
            </button>
            <button onClick={() => setMesActivo(m => add(m, { months: 1 }))} className="p-2 hover:bg-surface-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer" aria-label="Mes siguiente">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <Button onClick={() => setModal({ modo: 'crear', fecha: diaSeleccionado })}>
            <Plus className="w-4 h-4" /> Nuevo contenido
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="card overflow-hidden p-0">
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-on-surface-variant border-b border-outline-variant">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => <div key={d} className="py-2.5">{d}</div>)}
        </div>

        {isLoading ? (
          <div className="h-[420px] flex items-center justify-center text-on-surface-variant">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : isDesktop ? (
          <div className="grid grid-cols-7" style={{ gridAutoRows: 'minmax(96px, auto)' }}>
            {dias.map((d, i) => {
              const eventos = porDia(d)
              const enMes = isSameMonth(d, mesActivo)
              return (
                <div
                  key={i}
                  onClick={() => abrirDia(d)}
                  className={cn(
                    'relative flex flex-col border-b border-r border-outline-variant p-2 cursor-pointer hover:bg-surface-high/60 transition-colors',
                    !enMes && 'bg-surface-low/50',
                  )}
                >
                  <span className={cn(
                    'flex items-center justify-center w-6 h-6 rounded-full text-[12px] font-semibold self-end',
                    isToday(d) ? 'bg-primary text-on-primary' : enMes ? 'text-on-surface' : 'text-on-surface-variant/50',
                  )}>
                    {format(d, 'd')}
                  </span>
                  <div className="mt-1 space-y-1">
                    {eventos.slice(0, 2).map(ev => (
                      <button
                        key={ev.id}
                        onClick={e => { e.stopPropagation(); setModal({ modo: 'editar', contenido: ev }) }}
                        className="w-full text-left rounded-md bg-surface-high px-1.5 py-1 hover:bg-surface-highest transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ESTADO_COLOR[ev.estado] }} />
                          <span className="text-[10.5px] font-medium text-on-surface truncate">{ev.titulo}</span>
                        </div>
                      </button>
                    ))}
                    {eventos.length > 2 && (
                      <p className="text-[10px] text-on-surface-variant pl-1">+{eventos.length - 2} más</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {dias.map((d, i) => {
              const eventos = porDia(d)
              const enMes = isSameMonth(d, mesActivo)
              return (
                <button
                  key={i}
                  onClick={() => abrirDia(d)}
                  className="flex flex-col items-center gap-1 border-b border-r border-outline-variant py-2.5 cursor-pointer hover:bg-surface-high/60 transition-colors"
                >
                  <span className={cn(
                    'flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold',
                    isToday(d) ? 'bg-primary text-on-primary' : enMes ? 'text-on-surface' : 'text-on-surface-variant/50',
                    isEqual(d, diaSeleccionado) && !isToday(d) && 'ring-2 ring-primary/40',
                  )}>
                    {format(d, 'd')}
                  </span>
                  {eventos.length > 0 && (
                    <div className="flex gap-0.5">
                      {eventos.slice(0, 3).map(ev => (
                        <span key={ev.id} className="w-1.5 h-1.5 rounded-full" style={{ background: ESTADO_COLOR[ev.estado] }} />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Panel del día seleccionado (móvil) */}
      {!isDesktop && (
        <div className="card p-4">
          <p className="text-[13px] font-semibold text-on-surface capitalize mb-3">
            {format(diaSeleccionado, "EEEE d 'de' MMMM", { locale: es })}
          </p>
          {porDia(diaSeleccionado).length === 0 ? (
            <p className="text-[12.5px] text-on-surface-variant">Sin contenido planificado este día.</p>
          ) : (
            <div className="space-y-2">
              {porDia(diaSeleccionado).map(ev => (
                <button
                  key={ev.id}
                  onClick={() => setModal({ modo: 'editar', contenido: ev })}
                  className="w-full text-left rounded-lg bg-surface-high px-3 py-2.5 hover:bg-surface-highest transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-on-surface truncate">{ev.titulo}</span>
                    <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: `${ESTADO_COLOR[ev.estado]}22`, color: ESTADO_COLOR[ev.estado] }}>
                      {ESTADO_LABEL[ev.estado]}
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    {TIPO_LABEL[ev.tipo]}{ev.asignadoA && ` · ${ev.asignadoA.nombre}`}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {modal?.modo === 'crear' && (
        <ContenidoModal
          fecha={modal.fecha}
          miembros={miembros}
          onClose={() => setModal(null)}
          onSaved={() => { invalidar(); setModal(null) }}
        />
      )}
      {modal?.modo === 'editar' && (
        <ContenidoModal
          contenido={modal.contenido}
          miembros={miembros}
          onClose={() => setModal(null)}
          onSaved={() => { invalidar(); setModal(null) }}
        />
      )}
    </div>
  )
}

// ── Modal de creación / edición ──────────────────────────────────────────────
// Exportado para que el tablero (TableroContenido) reutilice el mismo
// formulario de crear/editar/eliminar y entregables, en vez de duplicarlo.
export function ContenidoModal({ fecha, contenido, miembros, agenda = [], onClose, onSaved }: {
  fecha?: Date
  contenido?: Contenido
  miembros: Miembro[]
  /** Contenidos del periodo, para mostrar qué ya hay agendado al elegir un día. */
  agenda?: Contenido[]
  onClose: () => void
  onSaved: () => void
}) {
  const esEdicion = !!contenido
  const [titulo, setTitulo]         = useState(contenido?.titulo ?? '')
  const [tipo, setTipo]             = useState<Contenido['tipo']>(contenido?.tipo ?? 'VIDEO')
  const [destino, setDestino]       = useState(contenido?.destino ?? '')
  const [clasificacion, setClasificacion] = useState<Contenido['clasificacion']>(contenido?.clasificacion ?? 'ORGANICO')
  const [tipoTrabajo, setTipoTrabajo] = useState<Contenido['tipoTrabajo']>(contenido?.tipoTrabajo ?? 'EMPRESA')
  const [valor, setValor] = useState(contenido?.valor != null ? String(contenido.valor) : '')
  // La fecha guardada llega como medianoche UTC ("2026-08-19T00:00:00.000Z").
  // Pasarla por `new Date()` la corría al día anterior en Colombia (UTC-5), así
  // que el formulario abría con un día menos y al guardar —aunque solo se
  // hubiera tocado el estado— movía la tarea de día (Hotman, 20-ago). Se ancla
  // con deISO, igual que el resto del calendario.
  const [fechaStr, setFechaStr]     = useState(
    contenido ? contenido.fecha.slice(0, 10) : toISO(fecha ?? new Date()),
  )
  const [asignadoAId, setAsignadoAId] = useState(contenido?.asignadoA?.id ?? '')

  // Quien reparte trabajo ve el campo de asignar; el resto crea a su nombre.
  // La lista son solo los editores de video: es a ellos a quienes se encarga.
  const { data: sesion } = useSession()
  const rol = (sesion?.user as { role?: string } | undefined)?.role
  const puedeAsignar = PUEDE_ASIGNAR.includes(rol ?? '')
  const editores = miembros.filter(m => m.activo && m.rol === 'EDITOR')
  const [notas, setNotas]           = useState(contenido?.notas ?? '')
  const [error, setError]           = useState('')

  // Entregables
  const [plataforma, setPlataforma] = useState('YOUTUBE')
  const [url, setUrl]               = useState('')
  const [subiendo, setSubiendo]     = useState(false)

  const guardar = useMutation({
    mutationFn: () => {
      const body = {
        titulo, tipo, clasificacion, fecha: fechaStr,
        tipoTrabajo,
        // En un trabajo de empresa el valor no viaja: el backend lo pondría en
        // null de todos modos, y así el cuerpo dice lo mismo que la pantalla.
        valor: tipoTrabajo === 'FREELANCE' && valor ? Number(valor) : null,
        destino: destino || null, asignadoAId: asignadoAId || null, notas: notas || null,
        // El estado no viaja: no es un dato que se escriba, es lo que va
        // pasando. Se mueve desde Entregables y desde la ficha, con un solo
        // paso hacia adelante y "Reabrir" como unica vuelta (Hotman, 20-ago).
        // Mandarlo desde aqui deshacia lo que otro acababa de publicar.
      }
      return esEdicion
        ? apiFetch(`/marketing/contenidos/${contenido!.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : apiFetch('/marketing/contenidos', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message || 'Error al guardar'),
  })

  const eliminar = useMutation({
    mutationFn: () => apiFetch(`/marketing/contenidos/${contenido!.id}`, { method: 'DELETE' }),
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message || 'Error al eliminar'),
  })

  const agregarEntregable = useMutation({
    mutationFn: (videoUrl?: string) => apiFetch(`/marketing/contenidos/${contenido!.id}/entregables`, {
      method: 'POST',
      body: JSON.stringify({ plataforma, url: videoUrl ? null : url, videoUrl: videoUrl ?? null }),
    }),
    onSuccess: () => { setUrl(''); onSaved() },
    onError: (e: Error) => setError(e.message || 'Error al agregar entregable'),
  })

  /** Quitar un enlace mal pegado. Antes solo se podian agregar. */
  const quitarEntregable = useMutation({
    mutationFn: (id: string) => apiFetch(`/marketing/entregables/${id}`, { method: 'DELETE' }),
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message || 'No se pudo quitar el enlace'),
  })

  async function subirVideo(file: File) {
    setSubiendo(true)
    setError('')
    try {
      const token = await (await import('@/lib/api')).getClientToken()
      const form = new FormData()
      form.append('file', file)
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      const res = await fetch(`${API_URL}/upload/video`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al subir el video')
      agregarEntregable.mutate(json.data.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir el video')
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <Modal
      abierto
      onClose={onClose}
      // El nombre de la pieza manda en el encabezado; "Editar contenido" no
      // decía cuál se estaba editando. La franja azul marino salió de aquí
      // (Hotman, 20-ago): en un formulario de tres bloques ya hay bastante
      // estructura sin un tercer fondo apilado en los primeros 120px.
      titulo={esEdicion ? contenido!.titulo : 'Nuevo contenido'}
      icono={esEdicion ? ICONO_TIPO[contenido!.tipo] : Plus}
      subtitulo={
        esEdicion
          ? `${TIPO_LABEL[contenido!.tipo]} · ${format(deISO(contenido!.fecha), "d 'de' MMMM", { locale: es })}`
          : `Se agenda para el ${format(deISO(fechaStr), "EEEE d", { locale: es })}`
      }
      pie={
        <div className="-mx-5 -my-3.5 flex items-center justify-between gap-3 bg-surface-low px-5 py-3.5">
          {esEdicion ? (
            // Lejos de Guardar y sin color hasta que se le apunta: la papelera
            // roja pegada a "Cancelar" invitaba a un borrado por ir rápido.
            <button
              type="button"
              onClick={() => confirm('¿Eliminar esta tarea? No se puede deshacer.') && eliminar.mutate()}
              disabled={eliminar.isPending}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-1 py-1.5 text-[12px] font-medium text-on-surface-variant transition-colors hover:text-[#dc2626] disabled:opacity-40"
            >
              <Trash2 className="size-3.5" /> Eliminar tarea
            </button>
          ) : (
            <span className="min-w-0 truncate text-[11.5px] text-on-surface-variant">
              Nace como <b className="font-semibold text-on-surface">Planificado</b>
            </span>
          )}
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-full border border-outline-variant px-4 py-2 text-[12.5px] font-semibold text-on-surface-variant transition-colors hover:border-outline hover:text-on-surface"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => guardar.mutate()}
              disabled={!titulo.trim() || guardar.isPending}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-[12.5px] font-semibold text-primary-on transition-[filter,transform] hover:brightness-110 active:scale-[0.98] disabled:opacity-45"
            >
              {guardar.isPending && <Loader2 className="size-4 animate-spin" />}
              {esEdicion ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </div>
      }
    >
      {/* De borde a borde: cada bloque lleva su propia línea, y el Modal ya
          acolcha el cuerpo. */}
      <div className="-mx-5 -my-2">

        {/* ── La pieza ── */}
        <div className="border-b border-outline-variant px-5 py-4">
          <p className="mb-3.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant opacity-75">
            La pieza
          </p>

          <div className="space-y-3.5">
            <Campo label="Se publica el">
              <CampoFecha
                valor={fechaStr}
                onCambio={setFechaStr}
                agenda={agenda}
                idActual={contenido?.id}
              />
            </Campo>

            <Campo label="Título" obligatorio>
              <input
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Ej. Reel tips de comprensión lectora"
                className="input-base"
              />
            </Campo>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Campo label="Tipo">
                <Select
                  value={tipo}
                  onValueChange={v => setTipo(v as Contenido['tipo'])}
                  className="input-base"
                  options={Object.entries(TIPO_LABEL).map(([value, label]) => ({ value, label }))}
                />
              </Campo>
              {/* "Cuenta" y no "Destino": es el perfil donde sale la pieza, que
                  es como el equipo lo llama en su hoja de cálculo. */}
              <Campo label="Cuenta">
                <Select
                  value={destino}
                  onValueChange={setDestino}
                  className="input-base"
                  placeholder="Sin definir"
                  options={[{ value: '', label: 'Sin definir' }, ...Object.entries(DESTINO_LABEL).map(([value, label]) => ({ value, label }))]}
                />
              </Campo>
            </div>

            <Campo label="Clasificación">
              <Segmentado
                valor={clasificacion}
                onCambio={setClasificacion}
                opciones={(Object.keys(CLASIFICACION_LABEL) as Contenido['clasificacion'][])
                  .map(c => ({ valor: c, texto: CLASIFICACION_LABEL[c] }))}
              />
            </Campo>
          </div>
        </div>

        {/* ── El trabajo ── */}
        <div className="border-b border-outline-variant px-5 py-4">
          <p className="mb-3.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant opacity-75">
            El trabajo
          </p>

          <div className="space-y-3.5">
            {/* "Quién lo paga" dice lo que la persona decide; "Tipo de trabajo"
                nombraba el campo por dentro. */}
            <Campo label="Quién lo paga">
              <Segmentado
                valor={tipoTrabajo}
                onCambio={setTipoTrabajo}
                opciones={(Object.keys(TRABAJO_LABEL) as Contenido['tipoTrabajo'][])
                  .map(t => ({ valor: t, texto: TRABAJO_LABEL[t] }))}
              />
              {/* El valor solo existe en los freelance. La línea de la
                  izquierda marca que apareció por lo que se acaba de elegir. */}
              {tipoTrabajo === 'FREELANCE' && (
                <div className="mt-3 border-l-2 border-primary pl-3">
                  <label className="mb-1.5 block text-[11.5px] font-medium text-on-surface-variant">
                    Valor <span className="font-normal text-outline">· opcional</span>
                  </label>
                  <div className="flex items-stretch overflow-hidden rounded-lg border border-outline-variant focus-within:border-primary">
                    <span className="grid place-items-center border-r border-outline-variant bg-surface-low px-3 text-[13px] font-semibold text-on-surface-variant">
                      $
                    </span>
                    <input
                      inputMode="numeric"
                      value={valor ? milesCO(Number(valor)) : ''}
                      onChange={e => setValor(e.target.value.replace(/\D/g, ''))}
                      placeholder="0"
                      className="w-full bg-surface-lowest px-3 py-2 text-[14px] tabular-nums text-on-surface outline-none placeholder:text-on-surface-variant/60"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-outline">Lo que se cobra por este trabajo.</p>
                </div>
              )}
            </Campo>

            {/* Asignar solo lo ven quienes reparten trabajo (community, social
                media, líderes, admin) y la lista trae únicamente editores de
                video: es a ellos a quienes se les encarga (Hotman, 20-ago). */}
            {puedeAsignar && (
              <Campo label="Asignar a" ayuda="solo editores de video">
                <div className="flex flex-wrap gap-1.5">
                  {editores.map(m => {
                    const activo = asignadoAId === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setAsignadoAId(activo ? '' : m.id)}
                        aria-pressed={activo}
                        title={m.nombre}
                        className={cn(
                          'inline-flex cursor-pointer items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-[12px] transition-colors',
                          activo
                            ? 'border-primary bg-primary-container font-semibold text-on-surface'
                            : 'border-outline-variant bg-surface-lowest text-on-surface hover:border-outline',
                        )}
                      >
                        <AvatarMiembro id={m.id} nombre={m.nombre} image={m.user?.image} size={20} />
                        {m.nombre.split(' ')[0]}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => setAsignadoAId('')}
                    aria-pressed={!asignadoAId}
                    className={cn(
                      'inline-flex cursor-pointer items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-[12px] transition-colors',
                      !asignadoAId
                        ? 'border-primary bg-primary-container text-on-surface'
                        : 'border-outline-variant bg-surface-lowest text-on-surface-variant hover:border-outline',
                    )}
                  >
                    <span className="grid size-5 place-items-center rounded-full border border-dashed border-outline text-[9px] font-bold text-on-surface-variant">
                      ?
                    </span>
                    A mi nombre
                  </button>
                </div>
                {editores.length === 0 && (
                  <p className="mt-1.5 text-[11px] text-outline">No hay editores de video registrados.</p>
                )}
              </Campo>
            )}
          </div>
        </div>

        {/* ── Notas ── */}
        <div className={cn('px-5 py-4', esEdicion && 'border-b border-outline-variant')}>
          <p className="mb-3 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant opacity-75">
            Notas
          </p>
          <textarea
            value={notas ?? ''}
            onChange={e => setNotas(e.target.value)}
            rows={2}
            placeholder="Detalles, referencias, brief..."
            className="input-base resize-none"
          />
        </div>

        {/* ── Enlaces publicados ── */}
        {esEdicion && (
          <div className="px-5 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant opacity-75">
                Enlaces publicados
              </p>
              {contenido!.entregables.length > 0 && (
                <p className="shrink-0 text-[10px] tabular-nums text-on-surface-variant">
                  {contenido!.entregables.length} enlace{contenido!.entregables.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {contenido!.entregables.length === 0 ? (
              <p className="mb-3 rounded-xl border border-dashed border-outline-variant px-4 py-3 text-[12px] text-on-surface-variant">
                Todavía no hay nada publicado.
              </p>
            ) : (
              <div className="mb-3 flex flex-col gap-2">
                {contenido!.entregables.map(en => {
                  const enlace = en.url ?? en.videoUrl
                  return (
                    <div
                      key={en.id}
                      className="flex items-center gap-3 rounded-xl border border-outline-variant px-3 py-2.5 transition-colors hover:border-outline"
                    >
                      <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-primary-container text-primary">
                        <Link2 className="size-[15px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-semibold text-on-surface">
                          {PLATAFORMA_LABEL[en.plataforma] ?? en.plataforma}
                        </span>
                        <span className="block truncate text-[10.5px] text-on-surface-variant">
                          {enlace ? direccionCorta(enlace) : 'video subido'}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-0.5">
                        <a
                          href={enlace ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir en una pestaña"
                          className="grid size-7 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-high hover:text-on-surface"
                        >
                          <ArrowUpRight className="size-3.5" />
                        </a>
                        {/* Se podían agregar enlaces pero no quitarlos: uno mal
                            pegado se quedaba ahí para siempre (Hotman, 20-ago). */}
                        <button
                          type="button"
                          title="Quitar este enlace"
                          disabled={quitarEntregable.isPending}
                          onClick={() => confirm('¿Quitar este enlace?') && quitarEntregable.mutate(en.id)}
                          className="grid size-7 cursor-pointer place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-[#dc2626]/12 hover:text-[#dc2626] disabled:opacity-40"
                        >
                          {quitarEntregable.isPending && quitarEntregable.variables === en.id
                            ? <Loader2 className="size-3.5 animate-spin" />
                            : <Trash2 className="size-3.5" />}
                        </button>
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Select
                value={plataforma}
                onValueChange={setPlataforma}
                className="input-base w-[126px] shrink-0"
                options={PLATAFORMAS.map(p => ({ value: p, label: PLATAFORMA_LABEL[p] }))}
              />
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://..."
                className="input-base min-w-[140px] flex-1"
              />
              <button
                type="button"
                disabled={!url || agregarEntregable.isPending}
                onClick={() => agregarEntregable.mutate(undefined)}
                className="shrink-0 cursor-pointer rounded-lg border border-outline-variant px-4 text-[12.5px] font-semibold text-on-surface-variant transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
              >
                {agregarEntregable.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Agregar'}
              </button>
            </div>

            <label className={cn('mt-2 block', subiendo && 'pointer-events-none opacity-60')}>
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) subirVideo(f) }}
              />
              <span className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant text-[12.5px] font-medium text-on-surface-variant transition-colors hover:border-primary hover:bg-primary/[0.05] hover:text-primary">
                {subiendo ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                O sube el video desde tu computador
              </span>
            </label>
          </div>
        )}

        {error && <p className="px-5 pb-4 text-xs text-[var(--error)]">{error}</p>}
      </div>
    </Modal>
  )
}
