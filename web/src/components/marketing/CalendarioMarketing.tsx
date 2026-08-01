'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  add, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isEqual, isSameDay, isSameMonth, isToday, startOfMonth, startOfToday, startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Trash2, Link2, Upload, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'

interface Miembro { id: string; nombre: string; activo: boolean; user?: { image: string | null } }
interface EntregableDto { id: string; plataforma: string; url: string | null; videoUrl: string | null; publicadoEn: string }
interface Contenido {
  id: string
  titulo: string
  tipo: 'VIDEO' | 'GUION' | 'PUBLICACION' | 'OTRO'
  fecha: string
  estado: 'PLANIFICADO' | 'EN_PROCESO' | 'PUBLICADO'
  notas: string | null
  asignadoA: Miembro | null
  guion: { id: string; titulo: string } | null
  entregables: EntregableDto[]
}

const TIPO_LABEL: Record<Contenido['tipo'], string> = { VIDEO: 'Video', GUION: 'Guion', PUBLICACION: 'Publicación', OTRO: 'Otro' }
const ESTADO_LABEL: Record<Contenido['estado'], string> = { PLANIFICADO: 'Planificado', EN_PROCESO: 'En proceso', PUBLICADO: 'Publicado' }
const ESTADO_COLOR: Record<Contenido['estado'], string> = {
  PLANIFICADO: 'var(--outline)',
  EN_PROCESO:  '#f59e0b',
  PUBLICADO:   '#16a34a',
}
const PLATAFORMAS = ['YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'DRIVE', 'OTRO']

function iniciales(n: string) {
  return n.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

function toISO(d: Date) { return format(d, 'yyyy-MM-dd') }

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
function ContenidoModal({ fecha, contenido, miembros, onClose, onSaved }: {
  fecha?: Date
  contenido?: Contenido
  miembros: Miembro[]
  onClose: () => void
  onSaved: () => void
}) {
  const esEdicion = !!contenido
  const [titulo, setTitulo]         = useState(contenido?.titulo ?? '')
  const [tipo, setTipo]             = useState<Contenido['tipo']>(contenido?.tipo ?? 'VIDEO')
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
      const body = { titulo, tipo, fecha: fechaStr, asignadoAId: asignadoAId || null, notas: notas || null, ...(esEdicion ? { estado } : {}) }
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
    >
      <div className="space-y-3 pb-2">
        <div>
          <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Título</label>
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
            <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Fecha</label>
            <input type="date" value={fechaStr} onChange={e => setFechaStr(e.target.value)} className="input-base" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Asignado a</label>
            <Select
              value={asignadoAId}
              onValueChange={setAsignadoAId}
              className="input-base"
              placeholder="Sin asignar"
              options={[{ value: '', label: 'Sin asignar' }, ...miembros.map(m => ({ value: m.id, label: m.nombre }))]}
            />
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
        </div>

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
          <div className="pt-2 border-t border-outline-variant">
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
                  <Link2 className="w-3 h-3 shrink-0" /> {e.plataforma} · {e.url ? 'link' : 'video subido'}
                </a>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={plataforma}
                onValueChange={setPlataforma}
                className="w-[120px] text-[12px] py-1.5"
                options={PLATAFORMAS.map(p => ({ value: p, label: p }))}
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

        <div className="flex items-center justify-between gap-3 pt-2">
          {esEdicion ? (
            <button
              onClick={() => confirm('¿Eliminar este contenido?') && eliminar.mutate()}
              disabled={eliminar.isPending}
              className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--error)] hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost">Cancelar</button>
            <Button onClick={() => guardar.mutate()} disabled={!titulo.trim() || guardar.isPending}>
              {guardar.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {esEdicion ? 'Guardar cambios' : 'Crear'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
