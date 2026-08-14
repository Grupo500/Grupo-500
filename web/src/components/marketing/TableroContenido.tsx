'use client'

// Tablero de contenido del área de Marketing.
//
// La grilla del mes se dibuja aquí de punta a punta con date-fns. Se intentó
// montarlo sobre el Event Calendar de ReUI, pero su celda impone decisiones que
// chocan con este diseño —número del día abajo a la derecha, alto y separación
// de las fichas fijos, y los contenidos de día completo desviados a una capa
// flotante por encima de las celdas— y sus primitivas están tras un plan de
// pago. Escribir la grilla es menos código que pelear con ella, y deja el
// diseño exacto.
//
// El formulario de crear/editar/eliminar y entregables se reutiliza de
// CalendarioMarketing: es el mismo que el equipo ya conoce.

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, isToday, startOfMonth, startOfToday, startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import {
  ContenidoModal,
  colorAvatar,
  type Contenido,
  type Miembro,
} from '@/components/marketing/CalendarioMarketing'

type Estado = Contenido['estado']

const ESTADO_COLOR: Record<Estado, string> = {
  PLANIFICADO: '#64748b',
  EN_PROCESO: '#d97706',
  PUBLICADO: '#16a34a',
}
const ESTADO_PLURAL: Record<Estado, string> = {
  PLANIFICADO: 'planificados',
  EN_PROCESO: 'en proceso',
  PUBLICADO: 'publicados',
}
const ESTADO_SINGULAR: Record<Estado, string> = {
  PLANIFICADO: 'Planificado',
  EN_PROCESO: 'En proceso',
  PUBLICADO: 'Publicado',
}
const ORDEN_ESTADOS: Estado[] = ['PLANIFICADO', 'EN_PROCESO', 'PUBLICADO']

// Etiqueta corta: dentro de una celda no cabe "Publicación" ni "Carrusel"
// completos junto al título y el avatar.
const TIPO_CORTO: Record<Contenido['tipo'], string> = {
  VIDEO: 'Reel', VSL: 'VSL', CARRUSEL: 'Carrus', CARRUMEME: 'Meme',
  TIKTOKERO: 'TikTok', GUION: 'Guion', PUBLICACION: 'Publi', OTRO: 'Otro',
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
/** Cuántas fichas se ven antes de resumir en "+N más". */
const FICHAS_VISIBLES = 3

function iniciales(n: string) {
  return n.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()
}
function aISO(d: Date) { return format(d, 'yyyy-MM-dd') }
/** `fecha` llega como YYYY-MM-DD; se ancla a medianoche local. */
function diaDe(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(a, m - 1, d)
}

type Modal =
  | { modo: 'crear'; fecha: Date }
  | { modo: 'editar'; contenido: Contenido }
  | null

export function TableroContenido() {
  const queryClient = useQueryClient()
  const hoy = startOfToday()
  const [mes, setMes] = useState(startOfMonth(hoy))
  const [ocultos, setOcultos] = useState<Estado[]>([])
  const [modal, setModal] = useState<Modal>(null)

  // Semana de lunes a domingo, con los días de relleno del mes vecino.
  const dias = useMemo(
    () => eachDayOfInterval({
      start: startOfWeek(mes, { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(mes), { weekStartsOn: 1 }),
    }),
    [mes],
  )

  const { data: miembrosData } = useQuery({
    queryKey: ['marketing-miembros'],
    queryFn: () => apiFetch<{ data: Miembro[] }>('/marketing/miembros'),
    staleTime: 5 * 60_000,
  })
  const miembros = miembrosData?.data ?? []

  const desde = aISO(dias[0])
  const hasta = aISO(dias[dias.length - 1])

  const { data, isLoading } = useQuery({
    queryKey: ['marketing-contenidos', desde, hasta],
    queryFn: () => apiFetch<{ data: Contenido[] }>(`/marketing/contenidos?desde=${desde}&hasta=${hasta}`),
    staleTime: 30_000,
  })
  const contenidos = useMemo(() => data?.data ?? [], [data])

  const conteos = useMemo(() => {
    const c: Record<Estado, number> = { PLANIFICADO: 0, EN_PROCESO: 0, PUBLICADO: 0 }
    for (const x of contenidos) c[x.estado]++
    return c
  }, [contenidos])
  const sinResponsable = contenidos.filter(c => !c.asignadoA).length

  const visibles = useMemo(
    () => contenidos.filter(c => !ocultos.includes(c.estado)),
    [contenidos, ocultos],
  )
  const delDia = (d: Date) => visibles.filter(c => isSameDay(diaDe(c.fecha), d))

  const alternar = (e: Estado) =>
    setOcultos(p => (p.includes(e) ? p.filter(x => x !== e) : [...p, e]))

  const cerrarYRefrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['marketing-contenidos'] })
    setModal(null)
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
        <Button onClick={() => setModal({ modo: 'crear', fecha: hoy })}>
          <Plus className="h-4 w-4" /> Nuevo contenido
        </Button>
      </div>

      <div className="card-panel overflow-hidden p-0">
        {/* Navegación */}
        <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant px-3.5 py-2.5">
          <button
            onClick={() => setMes(m => addMonths(m, -1))}
            aria-label="Mes anterior"
            className="grid size-[30px] cursor-pointer place-items-center rounded-lg border border-outline-variant text-on-surface-variant transition-colors hover:bg-surface-low"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            onClick={() => setMes(m => addMonths(m, 1))}
            aria-label="Mes siguiente"
            className="grid size-[30px] cursor-pointer place-items-center rounded-lg border border-outline-variant text-on-surface-variant transition-colors hover:bg-surface-low"
          >
            <ChevronRight className="size-3.5" />
          </button>
          <span className="ml-1 text-[16px] font-semibold tracking-[-0.022em] first-letter:uppercase">
            {format(mes, "MMMM 'de' yyyy", { locale: es })}
          </span>
          <button
            onClick={() => setMes(startOfMonth(hoy))}
            className="h-[30px] cursor-pointer rounded-lg border border-outline-variant px-3 text-[12.5px] transition-colors hover:bg-surface-low"
          >
            Hoy
          </button>
        </div>

        {/* Pulso del mes: conteos por estado, y filtran al tocarlos */}
        <div className="flex flex-wrap gap-1.5 border-b border-outline-variant bg-surface-low px-3.5 py-2.5">
          {ORDEN_ESTADOS.map(e => {
            const activo = !ocultos.includes(e)
            return (
              <button
                key={e}
                onClick={() => alternar(e)}
                aria-pressed={activo}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-surface-lowest py-1.5 pl-2 pr-2.5 text-[11.5px] leading-none transition-opacity',
                  !activo && 'opacity-40',
                )}
                style={{ borderColor: activo ? ESTADO_COLOR[e] : 'transparent' }}
              >
                <span className="size-[7px] shrink-0 rounded-full" style={{ background: ESTADO_COLOR[e] }} />
                <b className="font-bold tabular-nums leading-none text-on-surface">{conteos[e]}</b>
                <span className="leading-none text-on-surface-variant">{ESTADO_PLURAL[e]}</span>
              </button>
            )
          })}
          {sinResponsable > 0 && (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-lowest py-1.5 pl-2 pr-2.5 text-[11.5px] leading-none">
              {/* El mismo "?" que llevan las fichas sin responsable en las
                  celdas: así el filtro y lo que hay que buscar en el mes se
                  reconocen por la misma marca. */}
              <span
                className="grid size-[15px] shrink-0 place-items-center rounded-full border border-dashed text-[7.5px] font-bold leading-none"
                style={{ borderColor: 'var(--outline)', color: 'var(--outline)' }}
              >
                ?
              </span>
              <b className="font-bold tabular-nums leading-none text-on-surface">{sinResponsable}</b>
              <span className="leading-none text-on-surface-variant">sin responsable</span>
            </span>
          )}
        </div>

        {/* Cabecera de días */}
        <div className="grid grid-cols-7 border-b border-outline-variant">
          {DIAS.map(d => (
            <span
              key={d}
              className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface-variant"
            >
              {d}
            </span>
          ))}
        </div>

        {isLoading ? (
          <div className="flex h-[420px] items-center justify-center text-on-surface-variant">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {dias.map(dia => {
              const delDiaTodos = delDia(dia)
              const muestra = delDiaTodos.slice(0, FICHAS_VISIBLES)
              const sobran = delDiaTodos.length - muestra.length
              const fuera = !isSameMonth(dia, mes)
              return (
                <div
                  key={dia.toISOString()}
                  onClick={() => setModal({ modo: 'crear', fecha: dia })}
                  className="group flex min-h-[96px] cursor-pointer flex-col overflow-hidden border-b border-r border-outline-variant transition-colors last-of-type:border-r-0 hover:bg-surface-low/60 [&:nth-child(7n)]:border-r-0"
                >
                  {/* Fila del número: "+" a la izquierda, día a la derecha */}
                  <div className="flex items-center justify-between gap-1 px-2 pt-1.5">
                    <span
                      aria-hidden
                      className="grid size-5 place-items-center rounded-[5px] bg-primary text-on-primary opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Plus className="size-3.5" />
                    </span>
                    <span
                      className={cn(
                        'grid size-5 place-items-center rounded-full text-[12px] tabular-nums',
                        isToday(dia)
                          ? 'bg-primary font-light text-on-primary'
                          : fuera
                            ? 'text-outline opacity-55'
                            : 'text-on-surface-variant',
                      )}
                    >
                      {format(dia, 'd')}
                    </span>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col gap-[3px] overflow-hidden px-1.5 pb-1.5 pt-1">
                    {muestra.map(c => (
                      <Ficha
                        key={c.id}
                        contenido={c}
                        onAbrir={() => setModal({ modo: 'editar', contenido: c })}
                      />
                    ))}
                    {sobran > 0 && (
                      <span className="pl-1.5 text-[9.5px] leading-none text-on-surface-variant">
                        +{sobran} más
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-3.5 border-t border-outline-variant bg-surface-low px-3.5 py-2.5">
          {ORDEN_ESTADOS.map(e => (
            <span key={e} className="inline-flex items-center gap-1.5 text-[11px] leading-none text-on-surface-variant">
              <span className="size-[7px] shrink-0 rounded-full" style={{ background: ESTADO_COLOR[e] }} />
              {ESTADO_SINGULAR[e]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-[11px] leading-none text-on-surface-variant">
            <span className="size-[5px] shrink-0 rounded-full bg-on-surface-variant" />
            Pauta
          </span>
          <span className="ml-auto text-[11px] leading-none" style={{ color: 'var(--outline)' }}>
            Toca un día para agregar
          </span>
        </div>
      </div>

      {modal && (
        <ContenidoModal
          fecha={modal.modo === 'crear' ? modal.fecha : undefined}
          contenido={modal.modo === 'editar' ? modal.contenido : undefined}
          miembros={miembros}
          agenda={contenidos}
          onClose={() => setModal(null)}
          onSaved={cerrarYRefrescar}
        />
      )}
    </div>
  )
}

/** Tipo, título, punto de pauta y avatar del responsable. */
function Ficha({ contenido, onAbrir }: { contenido: Contenido; onAbrir: () => void }) {
  const marca = ESTADO_COLOR[contenido.estado]
  const persona = contenido.asignadoA
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onAbrir() }}
      title={contenido.titulo}
      style={{ ['--marca' as string]: marca }}
      className="flex w-full min-w-0 cursor-pointer items-center gap-1.5 overflow-hidden rounded-[3px] border-l-[2.5px] border-l-[var(--marca)] bg-[color-mix(in_srgb,var(--marca)_15%,transparent)] px-1.5 py-1 text-left leading-none transition-colors hover:bg-[color-mix(in_srgb,var(--marca)_25%,transparent)]"
    >
      <span
        className="shrink-0 text-[8.5px] font-bold uppercase leading-none tracking-[0.03em]"
        style={{ color: marca }}
      >
        {TIPO_CORTO[contenido.tipo]}
      </span>
      <span className="min-w-0 flex-1 truncate text-[10.5px] leading-none text-on-surface">
        {contenido.titulo}
      </span>
      {contenido.clasificacion === 'PAUTA' && (
        <span title="Pauta" className="size-1 shrink-0 rounded-full bg-on-surface-variant" />
      )}
      {persona ? (
        <span
          title={persona.nombre}
          className="grid size-[15px] shrink-0 place-items-center rounded-full text-[7.5px] font-bold text-white"
          style={{ background: colorAvatar(persona.id) }}
        >
          {iniciales(persona.nombre)}
        </span>
      ) : (
        <span
          title="Sin responsable"
          className="grid size-[15px] shrink-0 place-items-center rounded-full border border-dashed text-[7.5px] font-bold"
          style={{ borderColor: 'var(--outline)', color: 'var(--outline)' }}
        >
          ?
        </span>
      )}
    </button>
  )
}
