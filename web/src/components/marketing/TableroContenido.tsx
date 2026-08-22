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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, isToday, startOfMonth, startOfToday, startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Loader2, Search, X } from 'lucide-react'
import { FiltroResponsable, type OpcionResponsable } from '@/components/marketing/FiltroResponsable'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  ContenidoModal,
  type Contenido,
  type Miembro,
} from '@/components/marketing/CalendarioMarketing'
import { AvatarMiembro } from '@/components/marketing/AvatarMiembro'
import { useSession } from 'next-auth/react'
import { visiblesPara } from '@/lib/visibilidadMarketing'
import { AccionesPortada } from '@/components/layout/AccionesPortada'
import { PageHeader } from '@/components/ui/PageHeader'

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
  VIDEO: 'Reel', HISTORIA: 'Historia', VSL: 'VSL', CARRUSEL: 'Carrus', CARRUMEME: 'Meme',
  TIKTOKERO: 'TikTok', GUION: 'Guion', PUBLICACION: 'Publi', OTRO: 'Otro',
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
/** Cuántas fichas se ven antes de resumir en "+N más". */
const FICHAS_VISIBLES = 3

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
  const [busqueda, setBusqueda] = useState('')
  const [responsable, setResponsable] = useState('')
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
  // El filtro de verdad vive en el backend; esta pasada repite la misma regla
  // en pantalla para el rato en que el servidor responda con la version
  // anterior (ver visibilidadMarketing.ts).
  const { data: sesion } = useSession()
  const rol = (sesion?.user as { role?: string } | undefined)?.role
  const contenidos = useMemo(
    () => visiblesPara(data?.data ?? [], { rol, userId: sesion?.user?.id, miembros }),
    [data, rol, sesion?.user?.id, miembros],
  )

  // Buscar y responsable acotan el mes (Hotman, 22-ago); los conteos por
  // estado hablan de lo que queda tras ese recorte, y las pastillas de
  // estado solo esconden.
  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return contenidos.filter(c => {
      if (responsable && (c.asignadoA?.id ?? '__sin__') !== responsable) return false
      if (texto && !c.titulo.toLowerCase().includes(texto)) return false
      return true
    })
  }, [contenidos, busqueda, responsable])

  const conteos = useMemo(() => {
    const c: Record<Estado, number> = { PLANIFICADO: 0, EN_PROCESO: 0, PUBLICADO: 0 }
    for (const x of filtrados) c[x.estado]++
    return c
  }, [filtrados])

  /** Quién tiene trabajo este mes, con su cifra; "Sin responsable" de último. */
  const responsables = useMemo(() => {
    const mapa = new Map<string, OpcionResponsable>()
    for (const c of contenidos) {
      const id = c.asignadoA?.id ?? '__sin__'
      if (!mapa.has(id)) mapa.set(id, {
        id,
        nombre: c.asignadoA?.nombre ?? 'Sin responsable',
        foto: c.asignadoA?.user?.image ?? null,
        total: 0,
        pendientes: 0,
      })
      const r = mapa.get(id)!
      r.total++
      if (c.estado !== 'PUBLICADO') r.pendientes++
    }
    return [...mapa.values()].sort((a, b) =>
      a.id === '__sin__' ? 1 : b.id === '__sin__' ? -1 : b.total - a.total,
    )
  }, [contenidos])

  const visibles = useMemo(
    () => filtrados.filter(c => !ocultos.includes(c.estado)),
    [filtrados, ocultos],
  )
  const delDia = (d: Date) => visibles.filter(c => isSameDay(diaDe(c.fecha), d))

  const alternar = (e: Estado) =>
    setOcultos(p => (p.includes(e) ? p.filter(x => x !== e) : [...p, e]))

  const cerrarYRefrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['marketing-contenidos'] })
    setModal(null)
  }

  // Reprogramar arrastrando. `arrastrando` guarda la pieza en vuelo (el
  // dataTransfer no se puede leer durante el dragover, solo al soltar) y
  // `destino` el día que se está sobrevolando, para marcarlo.
  const [arrastrando, setArrastrando] = useState<string>('')
  const [destino, setDestino] = useState<string | null>(null)

  const mover = useMutation({
    mutationFn: ({ id, fecha }: { id: string; fecha: string }) =>
      apiFetch(`/marketing/contenidos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha }),
      }),
    // La pieza se pinta en su día nuevo antes de que el servidor conteste: al
    // arrastrar se espera que siga al cursor, no que parpadee de vuelta.
    onMutate: async ({ id, fecha }) => {
      await queryClient.cancelQueries({ queryKey: ['marketing-contenidos', desde, hasta] })
      const previo = queryClient.getQueryData<{ data: Contenido[] }>(['marketing-contenidos', desde, hasta])
      queryClient.setQueryData<{ data: Contenido[] }>(['marketing-contenidos', desde, hasta], viejo =>
        viejo ? { ...viejo, data: viejo.data.map(c => (c.id === id ? { ...c, fecha } : c)) } : viejo)
      return { previo }
    },
    onError: (_e, _v, ctx) => {
      // Se devuelve a su sitio: dejarla movida sería mentir sobre lo guardado.
      if (ctx?.previo) queryClient.setQueryData(['marketing-contenidos', desde, hasta], ctx.previo)
      alert('No se pudo mover la tarea')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['marketing-contenidos'] }),
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Sin botón de "nuevo contenido": se crea con el + del día, que además
          ya deja el contenido en la fecha correcta. El botón de arriba abría
          el formulario en el día de hoy y había que corregir la fecha a mano
          (Hotman, 20-ago). */}
      {/* El mismo PageHeader de las demás pestañas, y sin descripción: los
          subtítulos que explicaban cada módulo sobraban (Hotman, 22-ago). */}
      <PageHeader
        title="Planificador"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* La fila de estados subió al renglón del título, con buscador
                y responsable (Hotman, 22-ago). */}
            <label className="flex h-[38px] w-[220px] items-center gap-2 rounded-lg border border-outline-variant bg-surface-lowest px-3 transition-colors focus-within:border-primary">
              <Search className="size-3.5 shrink-0 text-on-surface-variant" />
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar una tarea…"
                className="min-w-0 flex-1 bg-transparent text-[12.5px] text-on-surface outline-none placeholder:text-on-surface-variant/60"
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
            <FiltroResponsable
              valor={responsable}
              onCambio={setResponsable}
              opciones={responsables}
              total={filtrados.length}
            />
            {/* Conteos por estado; filtran al tocarlos */}
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
            <AccionesPortada />
          </div>
        }
      />

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

        {/* Cabecera de días */}
        <div className="grid grid-cols-7 border-b border-outline-variant">
          {DIAS.map(d => (
            <span
              key={d}
              className="px-2 py-1.5 text-center text-[11px] font-bold tracking-[0.05em] text-on-surface-variant"
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
              const iso = aISO(dia)
              return (
                <div
                  key={dia.toISOString()}
                  onClick={() => setModal({ modo: 'crear', fecha: dia })}
                  onDragOver={e => {
                    // Sin preventDefault el navegador no acepta la soltada.
                    if (!arrastrando) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    if (destino !== iso) setDestino(iso)
                  }}
                  onDragLeave={() => { if (destino === iso) setDestino(null) }}
                  onDrop={e => {
                    e.preventDefault()
                    setDestino(null)
                    const id = e.dataTransfer.getData('text/plain') || arrastrando
                    const actual = contenidos.find(c => c.id === id)
                    // Soltarla en su propio día no es un cambio: no se guarda.
                    if (!id || !actual || actual.fecha.slice(0, 10) === iso) return
                    mover.mutate({ id, fecha: iso })
                  }}
                  className={cn(
                    'group flex min-h-[96px] cursor-pointer flex-col overflow-hidden border-b border-r border-outline-variant transition-colors last-of-type:border-r-0 hover:bg-surface-low/60 [&:nth-child(7n)]:border-r-0',
                    // El día bajo el cursor se marca mientras se arrastra, o no
                    // hay forma de saber dónde va a caer la pieza.
                    destino === iso && 'bg-primary/10 ring-2 ring-inset ring-primary/50',
                  )}
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
                        onArrastrar={setArrastrando}
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
function Ficha({ contenido, onAbrir, onArrastrar }: {
  contenido: Contenido
  onAbrir: () => void
  onArrastrar: (id: string) => void
}) {
  const marca = ESTADO_COLOR[contenido.estado]
  const persona = contenido.asignadoA
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onAbrir() }}
      // Reprogramar arrastrando: mover una pieza de día era abrirla, cambiar
      // la fecha en el formulario y guardar. Con doce piezas al mes eso es
      // media planificación perdida en formularios (Hotman, 20-ago).
      draggable
      onDragStart={e => {
        e.stopPropagation()
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', contenido.id)
        onArrastrar(contenido.id)
      }}
      onDragEnd={() => onArrastrar('')}
      title={`${contenido.titulo} — arrastra para cambiar de día`}
      style={{ ['--marca' as string]: marca }}
      className="flex w-full min-w-0 cursor-grab items-center gap-1.5 overflow-hidden rounded-[3px] border-l-[2.5px] border-l-[var(--marca)] bg-[color-mix(in_srgb,var(--marca)_15%,transparent)] px-1.5 py-1 text-left leading-none transition-colors hover:bg-[color-mix(in_srgb,var(--marca)_25%,transparent)] active:cursor-grabbing"
    >
      <span
        className="shrink-0 text-[8.5px] font-bold leading-none tracking-[0.03em]"
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
        <AvatarMiembro id={persona.id} nombre={persona.nombre} image={persona.user?.image} size={15} />
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
