'use client'

// Calendario de contenido del área de Marketing, sobre el Event Calendar de
// ReUI (src/components/reui/event-calendar).
//
// Es el único calendario del módulo: trae las vistas de ReUI y además todo el
// CRUD, reutilizando el `ContenidoModal` del componente anterior en vez de
// duplicar el formulario (crear, editar, eliminar y entregables viven ahí).
//
// Los datos salen de /marketing/contenidos; no hay eventos de muestra. Cada
// contenido se mapea a un evento de día completo porque el módulo agenda por
// día, no por hora — ponerle una hora sería inventar información.

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { es } from 'date-fns/locale'
import { format } from 'date-fns'
import { Plus, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import {
  ContenidoModal,
  type Contenido,
  type Miembro,
} from '@/components/marketing/CalendarioMarketing'
import { EventCalendar } from '@/components/reui/event-calendar/event-calendar'
import { EventCalendarNav } from '@/components/reui/event-calendar/event-calendar-nav'
import { EventCalendarContent } from '@/components/reui/event-calendar/event-calendar-content'
import type {
  CalendarEvent,
  EventCalendarOccurrence,
  EventCalendarResource,
  EventCalendarSlotInfo,
} from '@/components/reui/event-calendar/event-calendar-types'

const ZONA = 'America/Bogota'

// Mismos colores de estado que ya usaba el módulo: el equipo los tiene
// aprendidos, no hay razón para cambiarlos.
const ESTADO_COLOR: Record<Contenido['estado'], string> = {
  PLANIFICADO: 'var(--outline)',
  EN_PROCESO: '#f59e0b',
  PUBLICADO: '#16a34a',
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

  const eventos = useMemo<CalendarEvent<Contenido>[]>(
    () =>
      contenidos.map(c => {
        const inicio = diaDe(c.fecha)
        const fin = new Date(inicio)
        fin.setDate(fin.getDate() + 1)
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
    () => miembros.filter(m => m.activo).map(m => ({ id: m.id, title: m.nombre })),
    [miembros],
  )

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['marketing-contenidos'] })
    setModal(null)
  }

  if (isLoading) {
    return (
      <div className="card flex items-center justify-center py-24 text-on-surface-variant">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.022em] text-on-surface">
            Calendario de contenido
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
        <EventCalendar<Contenido>
          events={eventos}
          resources={recursos}
          defaultView="month"
          // La vista por responsable solo tiene sentido con miembros cargados.
          views={
            recursos.length
              ? ['month', 'week', 'day', 'agenda', 'resource']
              : ['month', 'week', 'day', 'agenda']
          }
          timeZone={ZONA}
          locale={es}
          weekStartsOn={1}
          nowIndicator
          offDays
          showDayAddButton
          // Arrastrar cambiaría la fecha del contenido en la base y eso todavía
          // no está conectado: se apaga en vez de dejarlo fallar en silencio.
          interactions={{ drag: false, resize: false, selectSlot: false }}
          onEventClick={(occ: EventCalendarOccurrence<Contenido>) => {
            if (occ.event.data) setModal({ modo: 'editar', contenido: occ.event.data })
          }}
          onSlotClick={(slot: EventCalendarSlotInfo) => {
            setModal({ modo: 'crear', fecha: slot.date })
          }}
          className="min-h-[640px]"
        >
          <EventCalendarNav />
          <EventCalendarContent />
        </EventCalendar>
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
