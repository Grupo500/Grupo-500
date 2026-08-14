'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  add, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isEqual, isSameDay, isSameMonth, isToday, startOfMonth, startOfToday, startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Trash2, Link2, Upload, Loader2, CalendarDays } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'

export interface Miembro { id: string; nombre: string; activo: boolean; user?: { image: string | null } }
export interface EntregableDto { id: string; plataforma: string; url: string | null; videoUrl: string | null; publicadoEn: string }
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
  guion: { id: string; titulo: string } | null
  entregables: EntregableDto[]
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

function iniciales(n: string) {
  return n.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

// Color de avatar por miembro. Se deriva del id para que cada persona conserve
// siempre el mismo, sin guardarlo en la base ni depender del orden de la lista.
const COLORES_AVATAR = ['#2094ff', '#7c3aed', '#db2777', '#0891b2', '#ca8a04', '#059669']
export function colorAvatar(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return COLORES_AVATAR[h % COLORES_AVATAR.length]
}

function toISO(d: Date) { return format(d, 'yyyy-MM-dd') }

/** `fecha` viene como YYYY-MM-DD; se ancla a medianoche local. */
function deISO(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(a, m - 1, d)
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
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="text-[21px] font-semibold leading-none tracking-[-0.025em] tabular-nums text-on-surface">
          {format(elegido, 'd')}
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-[11.5px] leading-none text-on-surface first-letter:uppercase">
            {format(elegido, "MMMM 'de' yyyy", { locale: es })}
          </span>
          <span className="text-[10px] leading-none text-on-surface-variant first-letter:uppercase">
            {format(elegido, 'EEEE', { locale: es })}
          </span>
        </span>
        <button
          type="button"
          onClick={() => { setMes(startOfMonth(elegido)); setAbierto(a => !a) }}
          className="ml-auto cursor-pointer text-[11px] text-primary underline underline-offset-2"
        >
          {abierto ? 'Listo' : 'Cambiar'}
        </button>
      </div>

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
  const [estado, setEstado]         = useState<Contenido['estado']>(contenido?.estado ?? 'PLANIFICADO')
  const [fechaStr, setFechaStr]     = useState(toISO(contenido ? new Date(contenido.fecha) : fecha ?? new Date()))
  const [asignadoAId, setAsignadoAId] = useState(contenido?.asignadoA?.id ?? '')
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
        ...(esEdicion ? { estado } : {}),
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
      titulo={esEdicion ? 'Editar contenido' : 'Nuevo contenido'}
      subtitulo={esEdicion ? TIPO_LABEL[contenido!.tipo] : undefined}
      pie={
        // La acción principal pesa más y se alcanza sin apuntar a un botón
        // pequeño en la esquina.
        <div className="flex gap-2">
          {esEdicion && (
            <button
              onClick={() => confirm('¿Eliminar este contenido?') && eliminar.mutate()}
              disabled={eliminar.isPending}
              aria-label="Eliminar contenido"
              title="Eliminar contenido"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-outline-variant text-[var(--error)] transition-colors hover:bg-surface-high disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-lg border border-outline-variant bg-surface-lowest py-2 text-[12.5px] font-semibold text-on-surface transition-colors hover:bg-surface-high"
          >
            Cancelar
          </button>
          <button
            onClick={() => guardar.mutate()}
            disabled={!titulo.trim() || guardar.isPending}
            className="flex flex-[1.4] cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-[12.5px] font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {guardar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {esEdicion ? 'Guardar cambios' : 'Crear contenido'}
          </button>
        </div>
      }
    >
      <div className="space-y-3 pb-2">
        <CampoFecha
          valor={fechaStr}
          onCambio={setFechaStr}
          agenda={agenda}
          idActual={contenido?.id}
        />

        <div>
          <label className="text-xs font-medium text-on-surface-variant block mb-1.5">
            Título <span style={{ color: '#d97706' }}>*</span>
          </label>
          <input
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            placeholder="Ej. Reel tips de comprensión lectora"
            className="input-base"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Tipo</label>
            <Select
              value={tipo}
              onValueChange={v => setTipo(v as Contenido['tipo'])}
              className="input-base"
              options={Object.entries(TIPO_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Destino</label>
            <Select
              value={destino}
              onValueChange={setDestino}
              className="input-base"
              placeholder="Sin definir"
              options={[{ value: '', label: 'Sin definir' }, ...Object.entries(DESTINO_LABEL).map(([value, label]) => ({ value, label }))]}
            />
          </div>
        </div>

        <div>
          {/* Dos opciones, se eligen de un clic: no hace falta desplegar una
              lista para ver dos ítems. Lo elegido va relleno y con borde de
              color, igual que los responsables de abajo — antes era al revés
              (pastilla blanca sobre pista azul) y sobre el fondo blanco del
              modal la teñida parecía la activa, así que "Pauta" se leía
              seleccionada cuando la marcada era "Orgánico". */}
          <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Clasificación</label>
          <div className="flex gap-1.5">
            {(Object.keys(CLASIFICACION_LABEL) as Contenido['clasificacion'][]).map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setClasificacion(c)}
                aria-pressed={clasificacion === c}
                className={cn(
                  'flex-1 rounded-full border py-1.5 text-[12.5px] transition-colors cursor-pointer',
                  clasificacion === c
                    ? 'border-primary bg-primary-container font-semibold text-on-surface'
                    : 'border-outline-variant bg-surface-lowest text-on-surface-variant hover:border-outline',
                )}
              >
                {CLASIFICACION_LABEL[c]}
              </button>
            ))}
          </div>
        </div>

        {/* Empresa o freelance. Mismo idioma que Clasificación: lo elegido va
            relleno y con borde de color. */}
        <div>
          <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Tipo de trabajo</label>
          <div className="flex gap-1.5">
            {(Object.keys(TRABAJO_LABEL) as Contenido['tipoTrabajo'][]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTipoTrabajo(t)}
                aria-pressed={tipoTrabajo === t}
                className={cn(
                  'flex-1 rounded-full border py-1.5 text-[12.5px] transition-colors cursor-pointer',
                  tipoTrabajo === t
                    ? 'border-primary bg-primary-container font-semibold text-on-surface'
                    : 'border-outline-variant bg-surface-lowest text-on-surface-variant hover:border-outline',
                )}
              >
                {TRABAJO_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        {/* El valor solo existe en los freelance, así que solo se ve ahí. La
            línea de la izquierda marca que este campo apareció por lo que se
            acaba de elegir justo arriba. */}
        {tipoTrabajo === 'FREELANCE' && (
          <div className="border-l-2 border-primary pl-3">
            <label className="text-xs font-medium text-on-surface-variant block mb-1.5">
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

        {/* Responsable por avatar: se ve de una quién está en el equipo y se
            asigna de un clic, en vez de desplegar una lista de nombres. */}
        <div>
          <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Asignado a</label>
          <div className="flex flex-wrap gap-1.5">
            {miembros.filter(m => m.activo).map(m => {
              const activo = asignadoAId === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setAsignadoAId(activo ? '' : m.id)}
                  aria-pressed={activo}
                  title={m.nombre}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[12px] transition-colors cursor-pointer',
                    activo
                      ? 'border-primary bg-primary-container text-on-surface'
                      : 'border-outline-variant bg-surface-lowest text-on-surface hover:border-outline',
                  )}
                >
                  <span
                    className="grid h-[19px] w-[19px] place-items-center rounded-full text-[8.5px] font-bold text-white"
                    style={{ background: colorAvatar(m.id) }}
                  >
                    {iniciales(m.nombre)}
                  </span>
                  {m.nombre.split(' ')[0]}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setAsignadoAId('')}
              aria-pressed={!asignadoAId}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[12px] transition-colors cursor-pointer',
                !asignadoAId
                  ? 'border-primary bg-primary-container text-on-surface'
                  : 'border-outline-variant bg-surface-lowest text-on-surface-variant hover:border-outline',
              )}
            >
              <span className="grid h-[19px] w-[19px] place-items-center rounded-full border border-dashed border-outline text-[8.5px] font-bold text-on-surface-variant">
                ?
              </span>
              Sin asignar
            </button>
          </div>
        </div>

        {esEdicion && (
          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Estado</label>
            <Select
              value={estado}
              onValueChange={v => setEstado(v as Contenido['estado'])}
              className="input-base"
              options={Object.entries(ESTADO_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Notas</label>
          <textarea
            value={notas ?? ''}
            onChange={e => setNotas(e.target.value)}
            rows={2}
            placeholder="Detalles, referencias, brief..."
            className="input-base resize-none"
          />
        </div>

        {esEdicion && (
          // -mx-5 px-5 para que la línea cruce la tarjeta de borde a borde
          // como las del encabezado y el pie: dentro del cuerpo quedaría
          // metida el ancho del padding y se leería como un recuadro suelto.
          <div className="-mx-5 border-t border-outline-variant px-5 pt-3">
            <p className="text-xs font-medium text-on-surface-variant mb-2">Entregables publicados</p>
            <div className="space-y-1.5 mb-3">
              {contenido!.entregables.length === 0 && (
                <p className="text-[12px] text-on-surface-variant">Todavía no hay nada publicado.</p>
              )}
              {contenido!.entregables.map(e => (
                <a
                  key={e.id}
                  href={e.url ?? e.videoUrl ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[12px] text-primary hover:underline"
                >
                  <Link2 className="w-3 h-3 shrink-0" /> {PLATAFORMA_LABEL[e.plataforma] ?? e.plataforma} · {e.url ? 'link' : 'video subido'}
                </a>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={plataforma}
                onValueChange={setPlataforma}
                className="w-[120px] text-[12px] py-1.5"
                options={PLATAFORMAS.map(p => ({ value: p, label: PLATAFORMA_LABEL[p] }))}
              />
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://..."
                className="input-base flex-1 min-w-[140px] py-1.5 text-[12px]"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!url || agregarEntregable.isPending}
                onClick={() => agregarEntregable.mutate(undefined)}
              >
                Agregar link
              </Button>
              <label className={cn('inline-flex', subiendo && 'opacity-60 pointer-events-none')}>
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) subirVideo(f) }}
                />
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 h-8 rounded-lg border border-outline bg-surface-lowest hover:bg-surface-high transition-colors cursor-pointer">
                  {subiendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Subir video
                </span>
              </label>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-[var(--error)]">{error}</p>}
      </div>
    </Modal>
  )
}
