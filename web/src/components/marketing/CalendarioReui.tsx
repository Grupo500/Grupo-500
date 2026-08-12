'use client'

// Tablero de contenido del área de Marketing, sobre el Event Calendar de ReUI.
//
// Es el único calendario del módulo: trae las vistas de ReUI y todo el CRUD,
// reutilizando el `ContenidoModal` del componente anterior en vez de duplicar
// el formulario (crear, editar, eliminar y entregables viven ahí).
//
// La ficha de cada contenido se dibuja aquí (`renderEvent`) en vez de usar la
// de ReUI: un calendario de contenido se lee por QUIÉN lo tiene, así que la
// ficha lleva el avatar del responsable y la etiqueta del tipo, no solo el
// título.
//
// Los datos salen de /marketing/contenidos; no hay eventos de muestra.

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { es } from 'date-fns/locale'
import { format } from 'date-fns'
import { Plus, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import {
  ContenidoModal,
  colorAvatar,
  type Contenido,
  type Miembro,
} from '@/components/marketing/CalendarioMarketing'
import { CALENDARIO_I18N } from '@/components/marketing/calendarioI18n'
import {
  EventCalendar,
  useEventCalendarView,
} from '@/components/reui/event-calendar/event-calendar'
import {
  EventCalendarNav,
  EventCalendarNavNext,
  EventCalendarNavPrev,
  EventCalendarNavToday,
  EventCalendarTitle,
} from '@/components/reui/event-calendar/event-calendar-nav'
import { EventCalendarContent } from '@/components/reui/event-calendar/event-calendar-content'
import type { CalendarView } from '@/components/reui/event-calendar/event-calendar-types'
import type {
  CalendarEvent,
  EventCalendarOccurrence,
  EventCalendarResource,
  EventCalendarSlotInfo,
} from '@/components/reui/event-calendar/event-calendar-types'

const ZONA = 'America/Bogota'

type Estado = Contenido['estado']

// Mismos colores de estado que ya usaba el módulo: el equipo los tiene
// aprendidos, no hay razón para cambiarlos.
const ESTADO_COLOR: Record<Estado, string> = {
  PLANIFICADO: '#64748b',
  EN_PROCESO: '#d97706',
  PUBLICADO: '#16a34a',
}
const ESTADO_LABEL: Record<Estado, string> = {
  PLANIFICADO: 'planificados',
  EN_PROCESO: 'en proceso',
  PUBLICADO: 'publicados',
}
const ORDEN_ESTADOS: Estado[] = ['PLANIFICADO', 'EN_PROCESO', 'PUBLICADO']

// Etiqueta corta: dentro de una celda de mes no caben "Publicación" ni
// "Carrusel" completos junto al título y el avatar.
const TIPO_CORTO: Record<Contenido['tipo'], string> = {
  VIDEO: 'Reel', VSL: 'VSL', CARRUSEL: 'Carrus', CARRUMEME: 'Meme',
  TIKTOKERO: 'TikTok', GUION: 'Guion', PUBLICACION: 'Publi', OTRO: 'Otro',
}

function iniciales(nombre: string): string {
  return nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

/** `fecha` llega como YYYY-MM-DD; se ancla a medianoche local del día. */
function diaDe(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(a, m - 1, d)
}

type Modal =
  | { modo: 'crear'; fecha: Date }
  | { modo: 'editar'; contenido: Contenido }
  | null

export function CalendarioReui() {
  const queryClient = useQueryClient()
  const [modal, setModal] = useState<Modal>(null)
  const [ocultos, setOcultos] = useState<Estado[]>([])

  const { data: miembrosData } = useQuery({
    queryKey: ['marketing-miembros'],
    queryFn: () => apiFetch<{ data: Miembro[] }>('/marketing/miembros'),
    staleTime: 5 * 60_000,
  })
  const miembros = useMemo(() => miembrosData?.data ?? [], [miembrosData])

  // Ventana amplia y fija: el calendario navega entre meses en cliente, así no
  // se dispara una consulta por cada cambio de mes.
  const { desde, hasta } = useMemo(() => {
    const hoy = new Date()
    return {
      desde: format(new Date(hoy.getFullYear(), hoy.getMonth() - 6, 1), 'yyyy-MM-dd'),
      hasta: format(new Date(hoy.getFullYear(), hoy.getMonth() + 7, 0), 'yyyy-MM-dd'),
    }
  }, [])

  const { data: contenidosData, isLoading } = useQuery({
    queryKey: ['marketing-contenidos', desde, hasta],
    queryFn: () =>
      apiFetch<{ data: Contenido[] }>(`/marketing/contenidos?desde=${desde}&hasta=${hasta}`),
    staleTime: 30_000,
  })
  const contenidos = useMemo(() => contenidosData?.data ?? [], [contenidosData])

  const conteos = useMemo(() => {
    const c: Record<Estado, number> = { PLANIFICADO: 0, EN_PROCESO: 0, PUBLICADO: 0 }
    for (const x of contenidos) c[x.estado]++
    return c
  }, [contenidos])
  const sinResponsable = useMemo(
    () => contenidos.filter(c => !c.asignadoA).length,
    [contenidos],
  )

  const eventos = useMemo<CalendarEvent<Contenido>[]>(
    () =>
      contenidos
        .filter(c => !ocultos.includes(c.estado))
        .map(c => {
          // Ojo: NO se marcan como `allDay`. ReUI dibuja los de día completo
          // como barras en una capa flotante sobre las celdas (absolute,
          // top-0), así que salían pisando el número del día en vez de
          // apilarse debajo. Un evento con horario que ocupa el día entero se
          // renderiza DENTRO de la celda, que es lo que necesitamos, y se sigue
          // leyendo como "todo el día" en las vistas de semana y día.
          const inicio = diaDe(c.fecha)
          const fin = new Date(inicio)
          fin.setHours(23, 59, 59, 999)
          return {
            id: c.id,
            title: c.titulo,
            start: inicio,
            end: fin,
            allDay: false,
            color: ESTADO_COLOR[c.estado],
            resourceId: c.asignadoA?.id,
            data: c,
          }
        }),
    [contenidos, ocultos],
  )

  const recursos = useMemo<EventCalendarResource[]>(
    () => miembros.filter(m => m.activo).map(m => ({ id: m.id, title: m.nombre })),
    [miembros],
  )

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['marketing-contenidos'] })
    setModal(null)
  }

  const alternar = (e: Estado) =>
    setOcultos(prev => (prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]))

  if (isLoading) {
    return (
      <div className="card flex items-center justify-center py-24 text-on-surface-variant">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.022em] text-on-surface">
            Tablero de contenido
          </h2>
          <p className="mt-0.5 text-[12px] text-on-surface-variant">
            Planificación y asignación del equipo
          </p>
        </div>
        <Button onClick={() => setModal({ modo: 'crear', fecha: new Date() })}>
          <Plus className="h-4 w-4" /> Nuevo contenido
        </Button>
      </div>

      <div className="card overflow-hidden p-0">
        {/* Pulso del mes: cuántos hay en cada estado, y sirven de filtro. */}
        <div className="flex flex-wrap gap-1.5 border-b border-outline-variant bg-surface-low px-3.5 py-2.5">
          {ORDEN_ESTADOS.map(e => {
            const activo = !ocultos.includes(e)
            return (
              // `leading-none` para que el punto quede centrado con las letras:
              // con la altura de línea heredada, `items-center` lo alinea contra
              // la caja de texto —que incluye el hueco del ascendente— y el
              // punto se ve alto.
              <button
                key={e}
                onClick={() => alternar(e)}
                aria-pressed={activo}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-full border py-1.5 pl-2 pr-2.5 text-[11.5px] leading-none transition-colors',
                  activo ? 'bg-surface-lowest' : 'border-transparent opacity-40 hover:opacity-70',
                )}
                style={activo ? { borderColor: ESTADO_COLOR[e] } : undefined}
              >
                <span
                  className="h-[7px] w-[7px] shrink-0 rounded-full"
                  style={{ background: ESTADO_COLOR[e] }}
                />
                <b className="font-bold tabular-nums leading-none text-on-surface">{conteos[e]}</b>
                <span className="leading-none text-on-surface-variant">{ESTADO_LABEL[e]}</span>
              </button>
            )
          })}
          {sinResponsable > 0 && (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-lowest py-1.5 pl-2 pr-2.5 text-[11.5px] leading-none">
              <span className="h-[7px] w-[7px] shrink-0 rounded-full border border-dashed border-outline" />
              <b className="font-bold tabular-nums leading-none text-on-surface">{sinResponsable}</b>
              <span className="leading-none text-on-surface-variant">sin responsable</span>
            </span>
          )}
        </div>

        <EventCalendar<Contenido>
          events={eventos}
          resources={recursos}
          defaultView="month"
          views={
            recursos.length
              ? ['month', 'week', 'day', 'agenda', 'resource']
              : ['month', 'week', 'day', 'agenda']
          }
          timeZone={ZONA}
          locale={es}
          weekStartsOn={1}
          i18n={CALENDARIO_I18N}
          nowIndicator
          // Sin `offDays`: en Grupo 500 se trabaja sábado y domingo, así que
          // marcarlos como no laborables sería falso.
          // Arrastrar cambiaría la fecha del contenido en la base y eso todavía
          // no está conectado: se apaga en vez de dejarlo fallar en silencio.
          interactions={{ drag: false, resize: false, selectSlot: false }}
          classNames={{
            // `first-letter:uppercase` porque date-fns devuelve el mes en
            // minúscula en español ("agosto de 2026"); capitalizarlo por CSS
            // evita tener que reimplementar formatTitle entero.
            title: 'text-[16px] font-semibold tracking-[-0.022em] first-letter:uppercase',
            monthDayHeader: 'text-[10px] font-bold uppercase tracking-[0.05em]',
            // ReUI enmarca la ficha con un aro completo del color del estado;
            // la maqueta usa una franja solo a la izquierda, que deja el color
            // igual de legible sin encerrar el texto. `ring-0` desactiva el aro
            // (va después, así que gana en tailwind-merge).
            event:
              'ring-0 border-l-[2.5px] border-l-[var(--ec-event-color)] rounded-l-[3px] pl-1.5',
          }}
          renderEvent={({ occurrence }) => <Ficha contenido={occurrence.event.data} />}
          // La celda del mes se dibuja completa aquí. La de ReUI pone el número
          // abajo a la derecha y fija el alto y la separación de las fichas;
          // tomando el control se consigue el diseño acordado sin pelear con
          // sus clases. ReUI sigue resolviendo lo que no se ve: fechas, zona
          // horaria, qué días caen en cada fila y la navegación.
          renderMonthCell={({ day, segments, isToday, isOutside }) => (
            <CeldaMes
              day={day}
              contenidos={segments.timed
                .map(s => s.occurrence.event.data)
                .filter((c): c is Contenido => !!c)}
              isToday={isToday}
              isOutside={isOutside}
              onAgregar={() => setModal({ modo: 'crear', fecha: day })}
              onAbrir={c => setModal({ modo: 'editar', contenido: c })}
            />
          )}
          onEventClick={(occ: EventCalendarOccurrence<Contenido>) => {
            if (occ.event.data) setModal({ modo: 'editar', contenido: occ.event.data })
          }}
          onSlotClick={(slot: EventCalendarSlotInfo) => {
            setModal({ modo: 'crear', fecha: slot.date })
          }}
          className="min-h-[640px]"
        >
          {/* Barra compuesta a mano: el nav de ReUI mete las vistas en un
              desplegable y con cinco opciones se ve mejor en pastillas. */}
          <EventCalendarNav showViewSwitcher={false}>
            <EventCalendarNavPrev />
            <EventCalendarNavNext />
            <EventCalendarTitle />
            <EventCalendarNavToday />
            <SelectorVistas />
          </EventCalendarNav>
          <EventCalendarContent />
        </EventCalendar>

        <div className="flex flex-wrap gap-3.5 border-t border-outline-variant bg-surface-low px-3.5 py-2.5">
          {/* `leading-none` por lo mismo que en la barra de arriba: sin él el
              punto se alinea con la caja de línea y queda por encima del texto. */}
          {ORDEN_ESTADOS.map(e => (
            <span key={e} className="inline-flex items-center gap-1.5 text-[11px] leading-none text-on-surface-variant">
              <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: ESTADO_COLOR[e] }} />
              {e === 'PLANIFICADO' ? 'Planificado' : e === 'EN_PROCESO' ? 'En proceso' : 'Publicado'}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-[11px] leading-none text-on-surface-variant">
            <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-on-surface-variant" />
            Pauta
          </span>
          <span className="ml-auto text-[11px]" style={{ color: 'var(--outline)' }}>
            Toca un día para agregar
          </span>
        </div>
      </div>

      {modal && (
        <ContenidoModal
          fecha={modal.modo === 'crear' ? modal.fecha : undefined}
          contenido={modal.modo === 'editar' ? modal.contenido : undefined}
          miembros={miembros}
          onClose={() => setModal(null)}
          onSaved={invalidar}
        />
      )}
    </div>
  )
}

/** Cuántas fichas se muestran antes de resumir en "+N más". */
const FICHAS_VISIBLES = 3

/**
 * Celda de un día del mes, dibujada de punta a punta.
 *
 * Arriba, en la misma fila: el botón de agregar a la izquierda —aparece al
 * pasar el mouse— y el número del día a la derecha. Debajo, las fichas.
 */
function CeldaMes({
  day, contenidos, isToday, isOutside, onAgregar, onAbrir,
}: {
  day: Date
  contenidos: Contenido[]
  isToday: boolean
  isOutside: boolean
  onAgregar: () => void
  onAbrir: (c: Contenido) => void
}) {
  const visibles = contenidos.slice(0, FICHAS_VISIBLES)
  const sobran = contenidos.length - visibles.length

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-1 px-2 pt-1.5">
        {/* `group/ec-cell` lo pone ReUI en la raíz de la celda; el botón se
            revela al pasar el mouse por ella, no solo por el propio botón. */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onAgregar() }}
          aria-label={`Agregar contenido el ${format(day, "d 'de' MMMM", { locale: es })}`}
          className="grid size-5 cursor-pointer place-items-center rounded-[5px] bg-primary text-on-primary opacity-0 transition-opacity focus-visible:opacity-100 group-hover/ec-cell:opacity-100"
        >
          <Plus className="size-3.5" />
        </button>
        <span
          className={cn(
            'grid size-5 place-items-center rounded-full text-[12px] tabular-nums',
            isToday ? 'bg-primary font-light text-on-primary' : 'text-on-surface-variant',
            isOutside && !isToday && 'opacity-45',
          )}
        >
          {format(day, 'd')}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[3px] overflow-hidden px-1.5 pb-1 pt-1">
        {visibles.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={e => { e.stopPropagation(); onAbrir(c) }}
            style={{ ['--marca' as string]: ESTADO_COLOR[c.estado] }}
            className="flex cursor-pointer items-center gap-1.5 overflow-hidden rounded-[3px] border-l-[2.5px] border-l-[var(--marca)] bg-[color-mix(in_srgb,var(--marca)_15%,transparent)] px-1.5 py-1 text-left leading-none transition-colors hover:bg-[color-mix(in_srgb,var(--marca)_25%,transparent)]"
          >
            <Ficha contenido={c} />
          </button>
        ))}
        {sobran > 0 && (
          <span className="pl-1.5 text-[9.5px] leading-none text-on-surface-variant">
            +{sobran} más
          </span>
        )}
      </div>
    </div>
  )
}

const VISTA_LABEL: Partial<Record<CalendarView, string>> = {
  month: 'Mes',
  week: 'Semana',
  day: 'Día',
  agenda: 'Agenda',
  resource: 'Responsables',
}

/**
 * Selector de vistas en pastillas. El de ReUI las mete en un desplegable, que
 * con cinco opciones obliga a abrir para ver dónde estás parado.
 */
function SelectorVistas() {
  const { view, availableViews, setView } = useEventCalendarView()
  return (
    <div className="ml-auto flex gap-0.5 rounded-lg bg-surface-low p-0.5">
      {availableViews
        .filter(v => VISTA_LABEL[v])
        .map(v => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={cn(
              'cursor-pointer rounded-md px-2.5 py-1 text-[12px] leading-none transition-colors',
              view === v
                ? 'bg-surface-lowest font-semibold text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            {VISTA_LABEL[v]}
          </button>
        ))}
    </div>
  )
}

/**
 * La ficha que se ve dentro de una celda: tipo, título y de quién es. El color
 * lo pone ReUI en `--ec-event-color` a partir de `event.color`, así que aquí
 * solo se hereda.
 */
function Ficha({ contenido }: { contenido?: Contenido }) {
  if (!contenido) return null
  const persona = contenido.asignadoA
  return (
    // `w-full` es lo que empuja el avatar al borde derecho: sin él la ficha se
    // encoge a su contenido y todo queda apelmazado a la izquierda del chip.
    // `leading-none` alinea la etiqueta del tipo (8.5px) con el título (11px):
    // con line-height heredado cada uno centra sobre su propia caja y el punto
    // y el texto quedan a distinta altura.
    <span className="flex w-full min-w-0 items-center gap-1.5 overflow-hidden leading-none">
      <span
        className="shrink-0 text-[8.5px] font-bold uppercase leading-none tracking-[0.03em]"
        style={{ color: ESTADO_COLOR[contenido.estado] }}
      >
        {TIPO_CORTO[contenido.tipo]}
      </span>
      <span className="min-w-0 flex-1 truncate leading-none text-on-surface">{contenido.titulo}</span>
      {contenido.clasificacion === 'PAUTA' && (
        <span
          title="Pauta"
          className="h-1 w-1 shrink-0 rounded-full bg-on-surface-variant"
        />
      )}
      {persona ? (
        <span
          title={persona.nombre}
          className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full text-[7.5px] font-bold text-white"
          style={{ background: colorAvatar(persona.id) }}
        >
          {iniciales(persona.nombre)}
        </span>
      ) : (
        <span
          title="Sin responsable"
          className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full border border-dashed text-[7.5px] font-bold"
          style={{ borderColor: 'var(--outline)', color: 'var(--outline)' }}
        >
          ?
        </span>
      )}
    </span>
  )
}
