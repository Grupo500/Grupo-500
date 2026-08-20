'use client'

/**
 * Entregables — el trabajo del mes, persona por persona.
 *
 * Antes esta pantalla listaba solo enlaces ya publicados, en una sola tira
 * ordenada por fecha: servía para "¿qué salió en agosto?" pero no para lo que
 * de verdad se pregunta a diario, que es quién tiene qué pendiente. Ahora cada
 * bloque es una persona y sus tareas del período, con el enlace al lado cuando
 * ya está publicado.
 *
 * Los datos son los del calendario (`/marketing/contenidos`), no la tabla de
 * entregables: una tarea existe desde que se asigna, y el entregable aparece
 * solo al final. Filtrar por entregables dejaba fuera justo lo pendiente.
 */

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { useSession } from 'next-auth/react'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { esLiderMarketing } from '@/lib/roles'
import { PageHeader } from '@/components/ui/PageHeader'
import { MonthPicker, DateRange } from '@/components/ui/MonthPicker'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Link2, Loader2, HelpCircle, CheckCircle2, Circle, Clock, Play, Check, Pencil } from 'lucide-react'
import { type Contenido } from '@/components/marketing/CalendarioMarketing'
import { AvatarMiembro } from '@/components/marketing/AvatarMiembro'

const TIPO_LABEL: Record<Contenido['tipo'], string> = {
  VIDEO: 'Reel', VSL: 'VSL', CARRUSEL: 'Carrusel', CARRUMEME: 'Carrumeme', TIKTOKERO: 'TikTokero',
  GUION: 'Guion', PUBLICACION: 'Publicación', OTRO: 'Otro',
}
const PLATAFORMA_LABEL: Record<string, string> = {
  YOUTUBE: 'YouTube', INSTAGRAM: 'Instagram', TIKTOK: 'TikTok', FACEBOOK: 'Facebook', DRIVE: 'Drive', OTRO: 'Otro',
}
const ESTADO = {
  PLANIFICADO: { label: 'Planificado', color: 'var(--outline)', icono: Circle },
  EN_PROCESO:  { label: 'En proceso',  color: '#d97706',        icono: Clock },
  PUBLICADO:   { label: 'Publicado',   color: '#16a34a',        icono: CheckCircle2 },
} as const

function toISO(d: Date) { return format(d, 'yyyy-MM-dd') }
function rangoDelMes(month: string | null) {
  const base = month ? new Date(month + '-15') : new Date()
  return { desde: toISO(startOfMonth(base)), hasta: toISO(endOfMonth(base)) }
}
/**
 * La fecha viene como YYYY-MM-DD a medianoche UTC. Pasarla por `new Date()`
 * la corre al día anterior en Colombia (UTC-5), así que se ancla a medianoche
 * local igual que en el calendario.
 */
function deISO(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(a, m - 1, d)
}

/**
 * El paso siguiente de una tarea. Es lo único que se ofrece: la tarea avanza,
 * no se elige un estado de una lista (diseño elegido por Hotman, 20-ago).
 * Publicado no tiene siguiente — ahí termina.
 */
const SIGUIENTE: Partial<Record<Contenido['estado'], {
  estado: Contenido['estado']; texto: string; color: string
}>> = {
  PLANIFICADO: { estado: 'EN_PROCESO', texto: 'Empezar',  color: '#d97706' },
  EN_PROCESO:  { estado: 'PUBLICADO',  texto: 'Publicar', color: '#16a34a' },
}

/** Una tarea. El enlace solo aparece cuando ya hay algo publicado. */
function Tarea({ c, onAvanzar, avanzando, onAbrir }: {
  c: Contenido
  onAvanzar: (id: string, estado: Contenido['estado']) => void
  avanzando: boolean
  onAbrir?: (c: Contenido) => void
}) {
  const e = ESTADO[c.estado]
  const Icono = e.icono
  const paso = SIGUIENTE[c.estado]
  const pendientes = (c.correcciones ?? []).filter(x => !x.resueltaEn).length
  return (
    <div
      onClick={() => onAbrir?.(c)}
      role={onAbrir ? 'button' : undefined}
      tabIndex={onAbrir ? 0 : undefined}
      onKeyDown={ev => { if (onAbrir && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); onAbrir(c) } }}
      // La fila entera abre el detalle: el título y las notas de una tarea no
      // caben en una línea, y hasta ahora no había forma de verlos sin ir al
      // Planificador (Hotman, 20-ago).
      className={cn(
        'flex items-center gap-3 px-4 py-2.5',
        onAbrir && 'cursor-pointer transition-colors hover:bg-surface-low',
        pendientes > 0 && 'border-l-[3px] border-l-[#dc2626] bg-[#dc2626]/[0.04]',
      )}
    >
      {/* El icono de estado a 18px: a 14 el círculo y el visto no se
          distinguían de un punto (Hotman, 20-ago). */}
      <Icono className="size-[18px] shrink-0" strokeWidth={2.2} style={{ color: e.color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-on-surface">{c.titulo}</p>
        <p className="mt-0.5 text-[11px] text-on-surface-variant">
          {TIPO_LABEL[c.tipo]} · {format(deISO(c.fecha), "d 'de' MMM", { locale: es })}
          {c.tipoTrabajo === 'FREELANCE' && ' · Freelance'}
          {/* Una tarea publicada sin enlace no es un error, pero conviene que
              se note: el enlace es la razón de ser de esta pantalla. */}
          {c.estado === 'PUBLICADO' && c.entregables.length === 0 && ' · sin enlace'}
          {pendientes > 0 && (
            <span className="font-semibold text-[#dc2626]">
              {' · '}{pendientes} corrección{pendientes !== 1 ? 'es' : ''} por hacer
            </span>
          )}
        </p>
      </div>
      {/* Ancho fijo a la derecha: sin él, "Publicado" y los botones "Empezar"
          quedaban a distinta distancia del borde y la columna se veía rota
          (Hotman, 20-ago). Todo lo que va aquí ocupa el mismo espacio. */}
      <div className="flex w-[112px] shrink-0 items-center justify-end gap-1.5">
        {c.entregables.slice(0, 1).map(en => (
          <a
            key={en.id}
            href={en.url ?? en.videoUrl ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={ev => ev.stopPropagation()}
            className="flex items-center gap-1 rounded-full bg-surface-high px-2.5 py-1.5 text-[10px] font-semibold text-on-surface-variant transition-colors hover:text-primary"
          >
            <Link2 className="size-3" />
            {PLATAFORMA_LABEL[en.plataforma] ?? en.plataforma}
          </a>
        ))}
        {paso ? (
          <button
            type="button"
            disabled={avanzando}
            onClick={ev => { ev.stopPropagation(); onAvanzar(c.id, paso.estado) }}
            title={`Marcar como ${paso.estado === 'EN_PROCESO' ? 'en proceso' : 'publicado'}`}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[10.5px] font-bold text-white transition-[transform,filter] hover:-translate-y-px hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
            style={{ background: paso.color }}
          >
            {avanzando
              ? <Loader2 className="size-3.5 animate-spin" />
              : paso.estado === 'EN_PROCESO' ? <Play className="size-3.5" /> : <Check className="size-3.5" />}
            {paso.texto}
          </button>
        ) : (
          c.entregables.length === 0 && (
            <span
              className="inline-flex items-center rounded-full px-3 py-1.5 text-[10.5px] font-bold"
              style={{ background: `color-mix(in srgb, ${e.color} 14%, transparent)`, color: e.color }}
            >
              {e.label}
            </span>
          )
        )}
      </div>
    </div>
  )
}

/**
 * Detalle de una tarea: todo lo que no cabe en la fila, y el hilo de
 * correcciones. Quien puede pedir cambios escribe aquí; quien hizo el trabajo
 * marca desde aquí que ya corrigió.
 */
function DetalleTarea({ c, puedePedir, esMio, onCerrar, onCambio }: {
  c: Contenido
  puedePedir: boolean
  esMio: boolean
  onCerrar: () => void
  onCambio: () => void
}) {
  const [mensaje, setMensaje] = useState('')
  const e = ESTADO[c.estado]
  const correcciones = c.correcciones ?? []
  const pendientes = correcciones.filter(x => !x.resueltaEn)

  const pedir = useMutation({
    mutationFn: () => apiFetch(`/marketing/contenidos/${c.id}/correcciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje: mensaje.trim() }),
    }),
    onSuccess: () => { setMensaje(''); onCambio() },
    onError: (err: Error) => alert(err.message || 'No se pudo enviar'),
  })

  const resolver = useMutation({
    mutationFn: () => apiFetch(`/marketing/contenidos/${c.id}/correcciones`, { method: 'PATCH' }),
    onSuccess: onCambio,
    onError: (err: Error) => alert(err.message || 'No se pudo marcar'),
  })

  return (
    <Modal abierto onClose={onCerrar} titulo={c.titulo}
           subtitulo={`${TIPO_LABEL[c.tipo]} · ${format(deISO(c.fecha), "d 'de' MMMM", { locale: es })}`}>
      <div className="space-y-4 px-1 py-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold"
                style={{ background: `color-mix(in srgb, ${e.color} 14%, transparent)`, color: e.color }}>
            {e.label}
          </span>
          {c.tipoTrabajo === 'FREELANCE' && (
            <span className="rounded-full bg-surface-high px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant">
              Freelance{c.valor ? ` · $${c.valor.toLocaleString('es-CO')}` : ''}
            </span>
          )}
          {c.clasificacion === 'PAUTA' && (
            <span className="rounded-full bg-surface-high px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant">Pauta</span>
          )}
          {c.asignadoA && (
            <span className="ml-auto flex items-center gap-2 text-[12px] text-on-surface-variant">
              <AvatarMiembro id={c.asignadoA.id} nombre={c.asignadoA.nombre} image={c.asignadoA.user?.image} size={22} />
              {c.asignadoA.nombre}
            </span>
          )}
        </div>

        {c.notas && (
          <div>
            <p className="mb-1 text-[11px] font-semibold text-on-surface-variant">Notas</p>
            <p className="whitespace-pre-wrap rounded-xl bg-surface-low px-3.5 py-3 text-[12.5px] leading-relaxed text-on-surface">
              {c.notas}
            </p>
          </div>
        )}

        {c.entregables.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-on-surface-variant">Publicado en</p>
            <div className="flex flex-wrap gap-2">
              {c.entregables.map(en => (
                <a key={en.id} href={en.url ?? en.videoUrl ?? '#'} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-1.5 rounded-full bg-surface-high px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant hover:text-primary">
                  <Link2 className="size-3.5" />
                  {PLATAFORMA_LABEL[en.plataforma] ?? en.plataforma}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── Correcciones ── */}
        <div className="border-t border-outline-variant pt-3.5">
          <p className="mb-2 text-[11px] font-semibold text-on-surface-variant">
            Correcciones {correcciones.length > 0 && `(${correcciones.length})`}
          </p>

          {correcciones.length === 0 && (
            <p className="text-[12px] text-on-surface-variant">Ninguna. El trabajo no ha necesitado cambios.</p>
          )}

          <div className="space-y-2">
            {correcciones.map(x => (
              <div key={x.id}
                   className={cn(
                     'rounded-xl border-l-[3px] px-3.5 py-2.5',
                     x.resueltaEn
                       ? 'border-l-outline-variant bg-surface-low'
                       : 'border-l-[#dc2626] bg-[#dc2626]/[0.07]',
                   )}>
                <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-on-surface">{x.mensaje}</p>
                <p className="mt-1.5 text-[10.5px] text-on-surface-variant">
                  {x.pedidaPor?.nombre ?? 'Alguien'} · {format(new Date(x.createdAt), "d 'de' MMM, h:mm a", { locale: es })}
                  {x.resueltaEn && <span className="font-semibold text-[#16a34a]"> · corregido</span>}
                </p>
              </div>
            ))}
          </div>

          {esMio && pendientes.length > 0 && (
            <button
              type="button"
              disabled={resolver.isPending}
              onClick={() => resolver.mutate()}
              className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#d97706] px-3.5 py-2 text-[11.5px] font-bold text-white hover:brightness-110 disabled:opacity-60"
            >
              {resolver.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Ya lo corregí
            </button>
          )}

          {puedePedir && (
            <div className="mt-3">
              <textarea
                value={mensaje}
                onChange={ev => setMensaje(ev.target.value)}
                placeholder="¿Qué hay que corregir?"
                className="min-h-[74px] w-full resize-y rounded-xl border border-outline-variant bg-surface-lowest px-3.5 py-2.5 text-[12.5px] text-on-surface outline-none focus:border-primary"
              />
              <button
                type="button"
                disabled={mensaje.trim().length < 3 || pedir.isPending}
                onClick={() => pedir.mutate()}
                className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#dc2626] px-3.5 py-2 text-[11.5px] font-bold text-white hover:brightness-110 disabled:opacity-45"
              >
                {pedir.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Pencil className="size-3.5" />}
                Pedir cambios
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

/** Cuántas tareas se ven en la tarjeta antes de mandar el resto al modal. */
const VISIBLES = 5

type Grupo = { id: string; nombre: string; foto: string | null; tareas: Contenido[] }

export default function EntregablesPage() {
  const now = new Date()
  const currentMonth = format(now, 'yyyy-MM')
  const [month, setMonth] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [filtro, setFiltro] = useState<'' | 'PENDIENTE' | 'PUBLICADO'>('')
  const [verTodas, setVerTodas] = useState<Grupo | null>(null)
  const [detalle, setDetalle] = useState<Contenido | null>(null)
  const { data: sesion } = useSession()
  const rol = (sesion?.user as { role?: string } | undefined)?.role
  const miUserId = sesion?.user?.id
  const queryClient = useQueryClient()

  // Avanzar la tarea al siguiente estado. Se refresca la lista al terminar en
  // vez de pintar el cambio antes de tiempo: si el guardado falla, la pantalla
  // no puede quedar diciendo que algo se publicó cuando no.
  const avanzar = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: Contenido['estado'] }) =>
      apiFetch(`/marketing/contenidos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-contenidos-equipo'] })
      queryClient.invalidateQueries({ queryKey: ['marketing-contenidos'] })
    },
    onError: (e: Error) => alert(e.message || 'No se pudo cambiar el estado'),
  })

  const { desde, hasta } = dateRange
    ? { desde: toISO(dateRange.start), hasta: toISO(dateRange.end) }
    : rangoDelMes(month)

  const { data, isLoading } = useQuery({
    queryKey: ['marketing-contenidos-equipo', desde, hasta],
    queryFn: () => apiFetch<{ data: Contenido[] }>(`/marketing/contenidos?desde=${desde}&hasta=${hasta}`),
    staleTime: 30_000,
  })

  // Agrupado por persona, y los que nadie tomó al final: no es una persona
  // más, es una alerta — algo agendado que no tiene quién lo haga.
  const grupos = useMemo(() => {
    const todos = data?.data ?? []
    const visibles = todos.filter(c =>
      filtro === '' ? true
      : filtro === 'PUBLICADO' ? c.estado === 'PUBLICADO'
      : c.estado !== 'PUBLICADO',
    )
    const mapa = new Map<string, Grupo>()
    for (const c of visibles) {
      const id = c.asignadoA?.id ?? '__sin__'
      if (!mapa.has(id)) mapa.set(id, {
        id,
        nombre: c.asignadoA?.nombre ?? 'Sin responsable',
        foto: c.asignadoA?.user?.image ?? null,
        tareas: [],
      })
      mapa.get(id)!.tareas.push(c)
    }
    return [...mapa.values()].sort((a, b) =>
      a.id === '__sin__' ? 1 : b.id === '__sin__' ? -1 : a.nombre.localeCompare(b.nombre),
    )
  }, [data, filtro])

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Entregables" subtitle="Las tareas de cada quien y lo que ya publicó" />
        <div className="flex items-center gap-2">
          <Select
            value={filtro}
            onValueChange={v => setFiltro(v as typeof filtro)}
            className="w-[160px]"
            options={[
              { value: '',           label: 'Todo' },
              { value: 'PENDIENTE',  label: 'Pendiente' },
              { value: 'PUBLICADO',  label: 'Publicado' },
            ]}
          />
          <MonthPicker
            value={month}
            currentMonth={currentMonth}
            dateRange={dateRange}
            onChange={(m, r) => { setMonth(m); setDateRange(r) }}
            alignRight
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-on-surface-variant">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : grupos.length === 0 ? (
        <div className="card py-16 text-center text-[13px] text-on-surface-variant">
          Nada agendado en este período.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {grupos.map(g => {
            const sinDueno   = g.id === '__sin__'
            const publicados = g.tareas.filter(t => t.estado === 'PUBLICADO').length
            const pendientes = g.tareas.length - publicados
            return (
              <div key={g.id} className="card overflow-hidden">
                <div className="flex items-center gap-2.5 border-b border-outline-variant px-4 py-3">
                  {sinDueno
                    ? <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-high">
                        <HelpCircle className="size-4 text-on-surface-variant" />
                      </span>
                    : <AvatarMiembro id={g.id} nombre={g.nombre} image={g.foto} size={32} />}
                  <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-on-surface">{g.nombre}</p>
                  <p className="shrink-0 text-[11px] tabular-nums text-on-surface-variant">
                    {pendientes > 0 && <span className="font-semibold text-[#d97706]">{pendientes} pend.</span>}
                    {pendientes > 0 && publicados > 0 && ' · '}
                    {publicados > 0 && <span className="font-semibold text-[#16a34a]">{publicados} publ.</span>}
                  </p>
                </div>
                {/* Solo las 5 más recientes: con diez y pico tareas la tarjeta
                    de una persona estiraba la página y descuadraba la columna
                    de al lado. El resto se ve completo en el modal (Hotman,
                    20-ago). */}
                <div className="divide-y divide-outline-variant/50">
                  {g.tareas.slice(0, VISIBLES).map(t => <Tarea key={t.id} c={t} onAbrir={setDetalle} onAvanzar={(id, estado) => avanzar.mutate({ id, estado })} avanzando={avanzar.isPending && avanzar.variables?.id === t.id} />)}
                </div>
                {g.tareas.length > VISIBLES && (
                  <button
                    type="button"
                    onClick={() => setVerTodas(g)}
                    className="w-full cursor-pointer border-t border-outline-variant px-4 py-2.5 text-[12px] font-semibold text-primary transition-colors hover:bg-surface-low"
                  >
                    Ver las {g.tareas.length} tareas
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Todas las tareas de una persona, sin recortar */}
      <Modal
        abierto={!!verTodas}
        onClose={() => setVerTodas(null)}
        titulo={verTodas?.nombre ?? ''}
        subtitulo={verTodas
          ? `${verTodas.tareas.length} tarea${verTodas.tareas.length !== 1 ? 's' : ''} en el período`
          : ''}
      >
        <div className="divide-y divide-outline-variant/50">
          {verTodas?.tareas.map(t => <Tarea key={t.id} c={t} onAbrir={setDetalle} onAvanzar={(id, estado) => avanzar.mutate({ id, estado })} avanzando={avanzar.isPending && avanzar.variables?.id === t.id} />)}
        </div>
      </Modal>

      {/* Detalle de una tarea, con su hilo de correcciones */}
      {detalle && (
        <DetalleTarea
          // Se relee de la lista para que el hilo se refresque al pedir o
          // resolver una corrección sin cerrar y volver a abrir.
          c={(data?.data ?? []).find(x => x.id === detalle.id) ?? detalle}
          // Pide cambios quien repartió ese trabajo, y los líderes y admins.
          puedePedir={
            esLiderMarketing(rol) || (!!detalle.asignadoPorId && detalle.asignadoPorId === miUserId)
          }
          esMio={detalle.asignadoA?.userId === miUserId}
          onCerrar={() => setDetalle(null)}
          onCambio={() => queryClient.invalidateQueries({ queryKey: ['marketing-contenidos-equipo'] })}
        />
      )}
    </div>
  )
}
