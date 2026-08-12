'use client'

// Calendario de contenido del área de Marketing, sobre el Event Calendar de
// ReUI (src/components/reui/event-calendar).
//
// Los datos salen del mismo endpoint que ya usaba el calendario anterior
// (/marketing/contenidos); no hay eventos de muestra en ninguna parte. Cada
// contenido se mapea a un evento de día completo: el módulo agenda por día,
// no por hora, así que forzar una hora sería inventar información.
//
// La vista por recursos usa a los miembros del equipo como columnas, que es
// la forma de ver de un vistazo cómo está repartida la carga del día.

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { es } from 'date-fns/locale'
import { format } from 'date-fns'
import { CalendarDays, User, BookOpen, Tag, X, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { EventCalendar } from '@/components/reui/event-calendar/event-calendar'
import type {
  CalendarEvent,
  EventCalendarOccurrence,
  EventCalendarResource,
} from '@/components/reui/event-calendar/event-calendar-types'

const ZONA = 'America/Bogota'

interface Miembro { id: string; nombre: string; activo: boolean }
interface Contenido {
  id: string
  titulo: string
  tipo: 'VIDEO' | 'VSL' | 'CARRUSEL' | 'CARRUMEME' | 'TIKTOKERO' | 'GUION' | 'PUBLICACION' | 'OTRO'
  destino: 'SEBASTIAN_PERSONAL' | 'ANDRES_PERSONAL' | 'PREICFES' | 'PREMEDICO' | null
  clasificacion: 'ORGANICO' | 'PAUTA'
  fecha: string
  estado: 'PLANIFICADO' | 'EN_PROCESO' | 'PUBLICADO'
  notas: string | null
  asignadoA: Miembro | null
  guion: { id: string; titulo: string } | null
  entregables: { id: string; plataforma: string }[]
}

const TIPO_LABEL: Record<Contenido['tipo'], string> = {
  VIDEO: 'Reel', VSL: 'VSL', CARRUSEL: 'Carrusel', CARRUMEME: 'Carrumeme',
  TIKTOKERO: 'TikTokero', GUION: 'Guion', PUBLICACION: 'Publicación', OTRO: 'Otro',
}
const ESTADO_LABEL: Record<Contenido['estado'], string> = {
  PLANIFICADO: 'Planificado', EN_PROCESO: 'En proceso', PUBLICADO: 'Publicado',
}
// Mismos colores que ya usaba el módulo, para no cambiar el código visual que
// el equipo tiene aprendido.
const ESTADO_COLOR: Record<Contenido['estado'], string> = {
  PLANIFICADO: 'var(--outline)', EN_PROCESO: '#f59e0b', PUBLICADO: '#16a34a',
}
const DESTINO_LABEL: Record<NonNullable<Contenido['destino']>, string> = {
  SEBASTIAN_PERSONAL: 'Sebastián personal', ANDRES_PERSONAL: 'Andrés personal',
  PREICFES: 'Preicfes', PREMEDICO: 'Premédico',
}
const CLASIFICACION_LABEL: Record<Contenido['clasificacion'], string> = {
  ORGANICO: 'Orgánico', PAUTA: 'Pauta',
}

/** `fecha` llega como YYYY-MM-DD; se ancla a medianoche local del día. */
function diaDe(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(a, m - 1, d)
}

export function CalendarioReui() {
  const [detalle, setDetalle] = useState<Contenido | null>(null)

  const { data: miembrosData } = useQuery({
    queryKey: ['marketing-miembros'],
    queryFn: () => apiFetch<{ data: Miembro[] }>('/marketing/miembros'),
  })

  // Ventana amplia y fija: el calendario navega por meses en cliente y así no
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
    queryFn: () => apiFetch<{ data: Contenido[] }>(`/marketing/contenidos?desde=${desde}&hasta=${hasta}`),
  })

  const contenidos = useMemo(() => contenidosData?.data ?? [], [contenidosData])

  const eventos = useMemo<CalendarEvent<Contenido>[]>(
    () => contenidos.map(c => {
      const inicio = diaDe(c.fecha)
      const fin = new Date(inicio); fin.setDate(fin.getDate() + 1)
      return {
        id: c.id,
        title: c.titulo,
        start: inicio,
        end: fin,
        allDay: true,
        color: ESTADO_COLOR[c.estado],
        resourceId: c.asignadoA?.id,
        data: c,
      }
    }),
    [contenidos],
  )

  const recursos = useMemo<EventCalendarResource[]>(
    () => (miembrosData?.data ?? [])
      .filter(m => m.activo)
      .map(m => ({ id: m.id, title: m.nombre })),
    [miembrosData],
  )

  if (isLoading) {
    return (
      <div className="card flex items-center justify-center py-24 text-on-surface-variant">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <EventCalendar<Contenido>
        events={eventos}
        resources={recursos}
        defaultView="month"
        // La vista por recursos solo tiene sentido con miembros cargados.
        views={recursos.length ? ['month', 'week', 'day', 'agenda', 'resource'] : ['month', 'week', 'day', 'agenda']}
        timeZone={ZONA}
        locale={es}
        weekStartsOn={1}
        nowIndicator
        offDays
        // Es un tablero de lectura y consulta: mover un contenido cambia su
        // fecha en la base y eso todavía no está conectado, así que se apagan
        // arrastrar y redimensionar en vez de dejarlos fallar en silencio.
        interactions={{ drag: false, resize: false, selectSlot: false }}
        onEventClick={(occ: EventCalendarOccurrence<Contenido>) => {
          if (occ.event.data) setDetalle(occ.event.data)
        }}
        className="min-h-[620px] [--ec-sticky-offset:0px]"
      />

      {detalle && <PanelDetalle contenido={detalle} onCerrar={() => setDetalle(null)} />}
    </div>
  )
}

function PanelDetalle({ contenido, onCerrar }: { contenido: Contenido; onCerrar: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-outline-variant bg-surface-lowest p-5 shadow-float"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-on-surface">{contenido.titulo}</h3>
            <span
              className="mt-1 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10.5px] font-medium"
              style={{
                background: `color-mix(in srgb, ${ESTADO_COLOR[contenido.estado]} 15%, transparent)`,
                color: 'var(--on-surface-variant)',
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: ESTADO_COLOR[contenido.estado] }} />
              {ESTADO_LABEL[contenido.estado]}
            </span>
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-high text-on-surface-variant transition-colors hover:bg-surface-highest"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-[12.5px]">
          <Campo icono={<Tag className="h-3.5 w-3.5" />} rotulo="Tipo">{TIPO_LABEL[contenido.tipo]}</Campo>
          <Campo icono={<Tag className="h-3.5 w-3.5" />} rotulo="Clasificación">{CLASIFICACION_LABEL[contenido.clasificacion]}</Campo>
          <Campo icono={<CalendarDays className="h-3.5 w-3.5" />} rotulo="Fecha">
            {format(diaDe(contenido.fecha), "d 'de' MMMM yyyy", { locale: es })}
          </Campo>
          <Campo icono={<Tag className="h-3.5 w-3.5" />} rotulo="Destino">
            {contenido.destino ? DESTINO_LABEL[contenido.destino] : '—'}
          </Campo>
          <Campo icono={<User className="h-3.5 w-3.5" />} rotulo="Asignado a">
            {contenido.asignadoA?.nombre ?? 'Sin asignar'}
          </Campo>
          <Campo icono={<BookOpen className="h-3.5 w-3.5" />} rotulo="Guion">
            {contenido.guion?.titulo ?? '—'}
          </Campo>
        </dl>

        {contenido.notas && (
          <p className="mt-4 border-t border-outline-variant/50 pt-3 text-[12.5px] text-on-surface-variant">
            {contenido.notas}
          </p>
        )}

        <div className="mt-4 border-t border-outline-variant/50 pt-3 text-[12px] text-on-surface-variant">
          {contenido.entregables.length
            ? `${contenido.entregables.length} entregable${contenido.entregables.length !== 1 ? 's' : ''}`
            : 'Sin entregables todavía'}
        </div>
      </div>
    </div>
  )
}

function Campo({ icono, rotulo, children }: { icono: React.ReactNode; rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-on-surface-variant">
        {icono}{rotulo}
      </dt>
      <dd className="text-on-surface">{children}</dd>
    </div>
  )
}
