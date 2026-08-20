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

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { useSession } from 'next-auth/react'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { esLiderMarketing } from '@/lib/roles'
import { visiblesPara } from '@/lib/visibilidadMarketing'
import { PageHeader } from '@/components/ui/PageHeader'
import { MonthPicker, DateRange } from '@/components/ui/MonthPicker'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import {
  Link2, Loader2, HelpCircle, CheckCircle2, Circle, Clock, Play, Check, Pencil,
  ArrowUpRight, Video, LayoutGrid, FileText, Megaphone, Trash2, RotateCcw,
  ChevronRight, ChevronDown, ChevronsUpDown, LayoutList, Rows3, type LucideIcon,
} from 'lucide-react'
import { ContenidoModal, type Contenido, type Miembro } from '@/components/marketing/CalendarioMarketing'
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

/** El icono que encabeza la ficha, según lo que sea la tarea. */
const ICONO_TIPO: Record<Contenido['tipo'], LucideIcon> = {
  VIDEO: Video, VSL: Video, TIKTOKERO: Video,
  CARRUSEL: LayoutGrid, CARRUMEME: LayoutGrid,
  GUION: FileText, PUBLICACION: Megaphone, OTRO: Megaphone,
}

/** Los tres estados en el orden en que ocurren, para el riel de progreso. */
const RIEL: Contenido['estado'][] = ['PLANIFICADO', 'EN_PROCESO', 'PUBLICADO']

/** Una dirección legible: sin protocolo ni www, que en un enlace son ruido. */
function direccionCorta(u: string) {
  return u.replace(/^https?:\/\//, '').replace(/^www\./, '')
}

/** Un dato de la ficha: etiqueta arriba en pequeño, valor abajo. */
function Dato({ label, children, className }: {
  label: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={cn('min-w-0 bg-surface-lowest px-4 py-3.5', className)}>
      <p className="mb-1.5 text-[11px] font-semibold text-on-surface-variant opacity-75">
        {label}
      </p>
      <div className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-on-surface">
        {children}
      </div>
    </div>
  )
}

/**
 * Detalle de una tarea: todo lo que no cabe en la fila.
 *
 * El orden lo manda a qué se entra. Arriba el estado —la pregunta que se hace
 * de un vistazo, ¿dónde va esto?— con el mismo botón que avanza en la lista:
 * quien acaba de arreglar una corrección la marca y publica sin cerrar ni
 * volver a buscar la fila. Después la ficha (quién, para cuándo, cuánto), los
 * enlaces, y al final el hilo de correcciones, que es lo que reemplaza a
 * Trello. Escribir queda anclado al pie, que no se va con el scroll.
 *
 * Antes era una pila de pastillas del mismo tamaño donde el estado pesaba lo
 * mismo que el pago, los $50.000 se leían como una etiqueta gris cualquiera y
 * las correcciones —a lo que se entra— quedaban al final, tras una frase
 * suelta que decía "Ninguna" (rediseño aprobado por Hotman, 20-ago).
 */
function DetalleTarea({
  c, puedePedir, esMio, onCerrar, onCambio, onEditar, onAvanzar, avanzando, miUserId, esAdmin,
}: {
  c: Contenido
  puedePedir: boolean
  esMio: boolean
  onCerrar: () => void
  onCambio: () => void
  /** Abre el formulario completo. Solo se ofrece a quien puede tocar la tarea. */
  onEditar?: () => void
  onAvanzar: (id: string, estado: Contenido['estado']) => void
  avanzando: boolean
  /** Para saber cuáles correcciones son propias y se pueden arreglar o retirar. */
  miUserId?: string | null
  esAdmin: boolean
}) {
  const [mensaje, setMensaje] = useState('')
  // El recuadro de escribir empieza plegado: ocupa una línea hasta que hace
  // falta, y así el hilo se lee sin un formulario vacío ocupando el pie.
  const [escribiendo, setEscribiendo] = useState(false)
  // La corrección que se está reescribiendo, si hay alguna. Se edita en el
  // mismo sitio donde está: sacarla a otra ventana la saca del hilo.
  const [corrigiendo, setCorrigiendo] = useState<{ id: string; texto: string } | null>(null)
  const e = ESTADO[c.estado]
  const paso = SIGUIENTE[c.estado]
  const correcciones = c.correcciones ?? []
  const pendientes = correcciones.filter(x => !x.resueltaEn)
  const indice = RIEL.indexOf(c.estado)

  const pedir = useMutation({
    mutationFn: () => apiFetch(`/marketing/contenidos/${c.id}/correcciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje: mensaje.trim() }),
    }),
    onSuccess: () => { setMensaje(''); setEscribiendo(false); onCambio() },
    onError: (err: Error) => alert(err.message || 'No se pudo enviar'),
  })

  const resolver = useMutation({
    mutationFn: () => apiFetch(`/marketing/contenidos/${c.id}/correcciones`, { method: 'PATCH' }),
    onSuccess: onCambio,
    onError: (err: Error) => alert(err.message || 'No se pudo marcar'),
  })

  const editarCorr = useMutation({
    mutationFn: ({ id, mensaje }: { id: string; mensaje: string }) =>
      apiFetch(`/marketing/correcciones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje }),
      }),
    onSuccess: () => { setCorrigiendo(null); onCambio() },
    onError: (err: Error) => alert(err.message || 'No se pudo guardar'),
  })

  const borrarCorr = useMutation({
    mutationFn: (id: string) => apiFetch(`/marketing/correcciones/${id}`, { method: 'DELETE' }),
    onSuccess: onCambio,
    onError: (err: Error) => alert(err.message || 'No se pudo eliminar'),
  })

  return (
    <Modal
      abierto
      onClose={onCerrar}
      titulo={c.titulo}
      icono={ICONO_TIPO[c.tipo]}
      subtitulo={`${TIPO_LABEL[c.tipo]} · ${format(deISO(c.fecha), "d 'de' MMMM", { locale: es })}`}
      // Editar sin ir al Planificador: quien tiene la tarea delante es quien
      // nota que el título quedó mal o que falta el enlace (Hotman, 20-ago).
      extra={onEditar && (
        <button
          type="button"
          onClick={onEditar}
          title="Editar"
          aria-label="Editar"
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface-high text-on-surface-variant transition-colors hover:bg-surface-highest hover:text-on-surface"
        >
          <Pencil className="size-3.5" />
        </button>
      )}
      pie={(esMio && pendientes.length > 0) || puedePedir ? (
        <div className="-mx-5 -my-3.5 space-y-3 bg-surface-low px-5 py-3.5">
          {esMio && pendientes.length > 0 && (
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 text-[11.5px] text-on-surface-variant">
                {pendientes.length === 1
                  ? 'Tienes un cambio por hacer.'
                  : `Tienes ${pendientes.length} cambios por hacer.`}
              </p>
              <button
                type="button"
                disabled={resolver.isPending}
                onClick={() => resolver.mutate()}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-[#16a34a] px-3.5 py-2 text-[11.5px] font-bold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
              >
                {resolver.isPending
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <Check className="size-3.5" strokeWidth={2.6} />}
                Ya lo corregí
              </button>
            </div>
          )}

          {puedePedir && (escribiendo ? (
            <div>
              <textarea
                autoFocus
                value={mensaje}
                onChange={ev => setMensaje(ev.target.value)}
                placeholder="¿Qué hay que corregir?"
                className="min-h-[76px] w-full resize-y rounded-[13px] border border-outline-variant bg-surface-lowest px-3.5 py-2.5 text-[12.5px] leading-relaxed text-on-surface outline-none focus:border-primary"
              />
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-[10.5px] text-on-surface-variant">
                  {c.asignadoA
                    ? `Le llega a ${c.asignadoA.nombre} como notificación.`
                    : 'Nadie tiene esta tarea asignada todavía.'}
                </p>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => { setEscribiendo(false); setMensaje('') }}
                    className="cursor-pointer rounded-full border border-outline-variant px-3.5 py-2 text-[11.5px] font-semibold text-on-surface-variant transition-colors hover:border-outline hover:text-on-surface"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={mensaje.trim().length < 3 || pedir.isPending}
                    onClick={() => pedir.mutate()}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#dc2626] px-3.5 py-2 text-[11.5px] font-bold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.97] disabled:opacity-45"
                  >
                    {pedir.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Pencil className="size-3.5" />}
                    Pedir cambios
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setEscribiendo(true)}
                className="min-w-0 flex-1 cursor-text truncate rounded-full border border-outline-variant bg-surface-lowest px-4 py-2.5 text-left text-[12.5px] text-on-surface-variant transition-colors hover:border-outline"
              >
                ¿Qué hay que corregir?
              </button>
              <button
                type="button"
                onClick={() => setEscribiendo(true)}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-[#dc2626] px-3.5 py-2.5 text-[11.5px] font-bold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.97]"
              >
                <Pencil className="size-3.5" /> Pedir cambios
              </button>
            </div>
          ))}
        </div>
      ) : undefined}
    >
      {/* Las secciones van de borde a borde: el Modal acolcha el cuerpo y aquí
          la barra de estado y la ficha llevan fondo y líneas propias. */}
      <div className="-mx-5 -my-2">

        {/* ── Estado: dónde va la tarea, y el botón que la mueve ── */}
        <div className="border-b border-outline-variant bg-surface-low px-5 py-4">
          <div className="mb-3.5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: e.color }} />
              <span className="shrink-0 text-[14px] font-semibold" style={{ color: e.color }}>{e.label}</span>
              {pendientes.length > 0 ? (
                <span className="truncate text-[11.5px] text-on-surface-variant">
                  · {pendientes.length} corrección{pendientes.length !== 1 ? 'es' : ''} abierta{pendientes.length !== 1 ? 's' : ''}
                </span>
              ) : c.estado === 'PUBLICADO' && c.entregables.length === 0 ? (
                <span className="truncate text-[11.5px] text-on-surface-variant">· sin enlace</span>
              ) : null}
            </div>
            {paso ? (
              <button
                type="button"
                disabled={avanzando}
                onClick={() => onAvanzar(c.id, paso.estado)}
                title={`Marcar como ${paso.estado === 'EN_PROCESO' ? 'en proceso' : 'publicado'}`}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-[11.5px] font-bold text-white transition-[transform,filter] hover:-translate-y-px hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
                style={{ background: paso.color }}
              >
                {avanzando
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : paso.estado === 'EN_PROCESO' ? <Play className="size-3.5" /> : <Check className="size-3.5" />}
                {paso.texto}
              </button>
            ) : (
              // "Publicado" no tiene paso siguiente, así que una tarea
              // publicada por error quedaba encallada: el selector de estado
              // salió del formulario y con él la única forma de deshacerlo.
              // Este es el camino de vuelta, y el único (Hotman, 20-ago).
              <button
                type="button"
                disabled={avanzando}
                onClick={() => onAvanzar(c.id, 'EN_PROCESO')}
                title="Reabrir — vuelve a En proceso"
                className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-outline-variant px-3.5 py-2 text-[11.5px] font-semibold text-on-surface-variant transition-colors hover:border-[#d97706] hover:text-[#d97706] disabled:cursor-wait disabled:opacity-60"
              >
                {avanzando
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <RotateCcw className="size-3.5" />}
                Reabrir
              </button>
            )}
          </div>

          <div className="flex gap-1.5">
            {RIEL.map((p, i) => (
              <div key={p} className="min-w-0 flex-1">
                {/* `block` en la pista es obligatorio: como elemento en línea la
                    altura no aplica y la barra crece hasta el alto del texto. */}
                <span
                  className="block h-[5px] overflow-hidden rounded-full"
                  style={{ background: 'color-mix(in srgb, var(--outline) 24%, transparent)' }}
                >
                  <span
                    className="block h-full rounded-full transition-[width] duration-500"
                    style={{ width: i <= indice ? '100%' : 0, background: ESTADO[p].color }}
                  />
                </span>
                <span className={cn(
                  'mt-2 block truncate text-[11px] font-semibold',
                  i === indice ? 'text-on-surface'
                    : i < indice ? 'text-on-surface-variant'
                    : 'text-on-surface-variant opacity-50',
                )}>
                  {ESTADO[p].label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Ficha: quién, para cuándo, cuánto ── */}
        <dl className="grid grid-cols-[1.35fr_1fr_1fr] gap-px border-b border-outline-variant bg-outline-variant">
          <Dato label="Responsable" className="pl-5">
            {c.asignadoA ? (
              <>
                <AvatarMiembro id={c.asignadoA.id} nombre={c.asignadoA.nombre} image={c.asignadoA.user?.image} size={26} />
                <span className="truncate">{c.asignadoA.nombre}</span>
              </>
            ) : (
              <span className="text-on-surface-variant">Sin asignar</span>
            )}
          </Dato>

          <Dato label="Entrega">
            {format(deISO(c.fecha), "d 'de' MMM", { locale: es })}
          </Dato>

          {/* El valor de un freelance se lee como plata y no como una etiqueta
              más: es el dato que después hay que aprobar en Cobros. */}
          <Dato label={c.tipoTrabajo === 'FREELANCE' ? 'Pago' : 'Trabajo'} className="pr-5">
            <span className="min-w-0">
              <span className={cn(
                'block',
                c.tipoTrabajo === 'FREELANCE' && 'text-[15px] font-semibold tabular-nums tracking-tight',
              )}>
                {c.tipoTrabajo === 'FREELANCE'
                  ? (c.valor ? `$${c.valor.toLocaleString('es-CO')}` : 'Sin valor')
                  : 'De la empresa'}
              </span>
              <span className="mt-0.5 block truncate text-[10.5px] font-medium text-on-surface-variant">
                {c.tipoTrabajo === 'FREELANCE'
                  ? `Freelance${c.clasificacion === 'PAUTA' ? ' · Pauta' : ''}`
                  : (c.clasificacion === 'PAUTA' ? 'Pauta' : 'Orgánico')}
              </span>
            </span>
          </Dato>
        </dl>

        {/* ── Notas: el encargo, tal como se dio ── */}
        {c.notas && (
          <div className="border-b border-outline-variant px-5 py-4">
            <p className="mb-2.5 text-[11px] font-semibold text-on-surface-variant opacity-75">
              Notas
            </p>
            <p className="whitespace-pre-wrap rounded-xl bg-surface-low px-3.5 py-3 text-[12.5px] leading-relaxed text-on-surface">
              {c.notas}
            </p>
          </div>
        )}

        {/* ── Enlaces: una tarjeta por sitio, con la dirección a la vista ── */}
        {c.entregables.length > 0 && (
          <div className="border-b border-outline-variant px-5 py-4">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold text-on-surface-variant opacity-75">
                Publicado en
              </p>
              <p className="shrink-0 text-[10px] tabular-nums text-on-surface-variant">
                {c.entregables.length} enlace{c.entregables.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {c.entregables.map(en => {
                const url = en.url ?? en.videoUrl
                return (
                  <a
                    key={en.id}
                    href={url ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-xl border border-outline-variant px-3.5 py-2.5 transition-[border-color,transform] hover:translate-x-0.5 hover:border-primary"
                  >
                    <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-primary-container text-primary">
                      <Link2 className="size-[15px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold text-on-surface">
                        {PLATAFORMA_LABEL[en.plataforma] ?? en.plataforma}
                      </span>
                      {url && (
                        <span className="block truncate text-[10.5px] text-on-surface-variant">
                          {direccionCorta(url)}
                        </span>
                      )}
                    </span>
                    <ArrowUpRight className="size-3.5 shrink-0 text-on-surface-variant opacity-50 transition-[color,opacity] group-hover:text-primary group-hover:opacity-100" />
                  </a>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Correcciones: un hilo, no una lista de cajas ── */}
        <div className="px-5 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold text-on-surface-variant opacity-75">
              Correcciones
            </p>
            {correcciones.length > 0 && (
              <p className="shrink-0 text-[10px] tabular-nums text-on-surface-variant">{correcciones.length}</p>
            )}
          </div>

          {correcciones.length === 0 ? (
            <div className="flex items-center gap-3 rounded-[13px] border border-dashed border-outline-variant px-4 py-3.5">
              <span
                className="flex size-[34px] shrink-0 items-center justify-center rounded-full text-[#16a34a]"
                style={{ background: 'color-mix(in srgb, #16a34a 13%, transparent)' }}
              >
                <Check className="size-4" strokeWidth={2.6} />
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold text-on-surface">Sin cambios pedidos</span>
                <span className="block text-[11.5px] text-on-surface-variant">El trabajo pasó tal como se entregó.</span>
              </span>
            </div>
          ) : (
            <div className="flex flex-col">
              {correcciones.map((x, i) => {
                const ultima = i === correcciones.length - 1
                // Se arregla o se retira la propia, y mientras siga pendiente:
                // una ya corregida se hizo sobre ese texto, y reescribirlo
                // después deja el trabajo respondiendo a algo que ya no dice.
                const mia = !x.resueltaEn && (x.pedidaPorId === miUserId || esAdmin)
                const enEdicion = corrigiendo?.id === x.id
                return (
                  <div key={x.id} className={cn('group relative grid grid-cols-[26px_1fr] gap-3', !ultima && 'pb-4')}>
                    {/* La línea que cose el hilo: se lee como una conversación
                        en orden y no como cajas sueltas una debajo de otra. */}
                    {!ultima && <span className="absolute bottom-1 left-[12.5px] top-8 w-px bg-outline-variant" />}
                    <AvatarMiembro
                      id={x.pedidaPor?.email ?? x.id}
                      nombre={x.pedidaPor?.nombre ?? 'Alguien'}
                      image={x.pedidaPor?.image}
                      size={26}
                    />
                    <div className="min-w-0">
                      <div className="mb-1.5 flex flex-wrap items-baseline gap-2">
                        <span className="text-[12px] font-semibold text-on-surface">
                          {x.pedidaPor?.nombre ?? 'Alguien'}
                        </span>
                        <span className="text-[10.5px] text-on-surface-variant">
                          {format(new Date(x.createdAt), "d 'de' MMM, h:mm a", { locale: es })}
                        </span>
                        {x.resueltaEn ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-[#16a34a]"
                            style={{ background: 'color-mix(in srgb, #16a34a 14%, transparent)' }}
                          >
                            <Check className="size-2.5" strokeWidth={3} /> Corregido
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-[#dc2626]"
                            style={{ background: 'color-mix(in srgb, #dc2626 12%, transparent)' }}
                          >
                            <HelpCircle className="size-2.5" strokeWidth={2.6} /> Pendiente
                          </span>
                        )}

                        {/* Arreglar o retirar lo que uno mismo pidió. Aparecen
                            al pasar el mouse para no llenar el hilo de iconos,
                            y quedan fijos en pantallas táctiles, donde no hay
                            forma de "pasar por encima". */}
                        {mia && !enEdicion && (
                          <span className="ml-auto flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                            <button
                              type="button"
                              title="Corregir el texto"
                              aria-label="Corregir el texto"
                              onClick={() => setCorrigiendo({ id: x.id, texto: x.mensaje })}
                              className="grid size-6 cursor-pointer place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-high hover:text-on-surface"
                            >
                              <Pencil className="size-3" />
                            </button>
                            <button
                              type="button"
                              title="Retirar la corrección"
                              aria-label="Retirar la corrección"
                              disabled={borrarCorr.isPending}
                              onClick={() => {
                                if (confirm('¿Retirar esta corrección? Deja de contar como pendiente.')) {
                                  borrarCorr.mutate(x.id)
                                }
                              }}
                              className="grid size-6 cursor-pointer place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-[#dc2626]/12 hover:text-[#dc2626]"
                            >
                              {borrarCorr.isPending && borrarCorr.variables === x.id
                                ? <Loader2 className="size-3 animate-spin" />
                                : <Trash2 className="size-3" />}
                            </button>
                          </span>
                        )}
                      </div>

                      {enEdicion ? (
                        <div>
                          <textarea
                            autoFocus
                            value={corrigiendo.texto}
                            onChange={ev => setCorrigiendo({ id: x.id, texto: ev.target.value })}
                            className="min-h-[70px] w-full resize-y rounded-[3px_12px_12px_12px] border border-outline-variant bg-surface-lowest px-3.5 py-2.5 text-[12.5px] leading-relaxed text-on-surface outline-none focus:border-primary"
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setCorrigiendo(null)}
                              className="cursor-pointer rounded-full border border-outline-variant px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant transition-colors hover:border-outline hover:text-on-surface"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={corrigiendo.texto.trim().length < 3 || editarCorr.isPending}
                              onClick={() => editarCorr.mutate({ id: x.id, mensaje: corrigiendo.texto.trim() })}
                              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-on transition-[filter,transform] hover:brightness-110 active:scale-[0.97] disabled:opacity-45"
                            >
                              {editarCorr.isPending && <Loader2 className="size-3 animate-spin" />}
                              Guardar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p
                          className={cn(
                            'whitespace-pre-wrap rounded-[3px_12px_12px_12px] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-on-surface',
                            x.resueltaEn && 'bg-surface-low opacity-75',
                          )}
                          style={x.resueltaEn ? undefined : {
                            background: 'color-mix(in srgb, #dc2626 8%, var(--surface-lowest))',
                            boxShadow: 'inset 2px 0 0 #dc2626',
                          }}
                        >
                          {x.mensaje}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ── Vista de tabla ────────────────────────────────────────────────────── */

const DESTINO_LABEL: Record<string, string> = {
  SEBASTIAN_PERSONAL: 'Sebastián personal',
  ANDRES_PERSONAL: 'Andrés personal',
  PREICFES: 'Preicfes',
  PREMEDICO: 'Premédico',
  __sin__: 'Sin cuenta asignada',
}
/** El orden de las bandas: el mismo de la hoja de cálculo del equipo. */
const ORDEN_DESTINO = ['SEBASTIAN_PERSONAL', 'ANDRES_PERSONAL', 'PREICFES', 'PREMEDICO', '__sin__']

type Columna = 'titulo' | 'tipo' | 'responsable' | 'estado' | 'fecha' | 'valor'

/** El estado de una tarea, y el botón que la mueve, en una sola celda. */
function CeldaEstado({ c, onAvanzar, avanzando }: {
  c: Contenido
  onAvanzar: (id: string, estado: Contenido['estado']) => void
  avanzando: boolean
}) {
  const e = ESTADO[c.estado]
  const paso = SIGUIENTE[c.estado]

  // Publicada ya no avanza: deja de ser botón y ofrece la vuelta.
  if (!paso) {
    return (
      <span className="inline-flex items-center gap-1">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
          style={{ background: `color-mix(in srgb, ${e.color} 14%, transparent)`, color: e.color }}
        >
          <span className="size-[7px] shrink-0 rounded-full" style={{ background: e.color }} />
          {e.label}
        </span>
        <button
          type="button"
          disabled={avanzando}
          title="Reabrir — vuelve a En proceso"
          onClick={() => onAvanzar(c.id, 'EN_PROCESO')}
          className="grid size-[26px] cursor-pointer place-items-center rounded-full text-on-surface-variant opacity-0 transition-[opacity,background,color] hover:bg-[#d97706]/14 hover:text-[#d97706] focus-visible:opacity-100 group-hover/fila:opacity-100"
        >
          {avanzando ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-[13px]" />}
        </button>
      </span>
    )
  }

  // Al pasar el mouse se tiñe del color del paso siguiente: se ve a dónde
  // lleva antes de pulsar, sin tener que leer el globo de ayuda.
  return (
    <button
      type="button"
      disabled={avanzando}
      title={`Pulsa para marcarla ${paso.estado === 'EN_PROCESO' ? 'en proceso' : 'publicada'}`}
      onClick={() => onAvanzar(c.id, paso.estado)}
      className="group/est inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 text-[10.5px] font-semibold transition-colors disabled:cursor-wait"
      style={{
        background: `color-mix(in srgb, ${e.color} 13%, transparent)`,
        color: e.color,
        // Variables para que el hover pinte con el color del paso siguiente
        // sin duplicar la clase por estado.
        ['--sig' as string]: paso.color,
      }}
      onMouseEnter={ev => {
        ev.currentTarget.style.background = `color-mix(in srgb, ${paso.color} 16%, transparent)`
        ev.currentTarget.style.color = paso.color
        ev.currentTarget.style.borderColor = `color-mix(in srgb, ${paso.color} 38%, transparent)`
      }}
      onMouseLeave={ev => {
        ev.currentTarget.style.background = `color-mix(in srgb, ${e.color} 13%, transparent)`
        ev.currentTarget.style.color = e.color
        ev.currentTarget.style.borderColor = 'transparent'
      }}
    >
      {avanzando
        ? <Loader2 className="size-3 animate-spin" />
        : <span className="size-[7px] shrink-0 rounded-full transition-colors" style={{ background: 'currentColor' }} />}
      {e.label}
      <ChevronRight className="size-3 opacity-0 transition-[opacity,transform] group-hover/est:translate-x-0.5 group-hover/est:opacity-100" />
    </button>
  )
}

/**
 * Las mismas tareas, en filas.
 *
 * Las tarjetas responden «¿qué tiene cada quien?»; la tabla responde «¿qué hay
 * para el 21?», «¿qué falta por publicar?» y «¿cuánto se debe en freelance este
 * mes?». Va agrupada por cuenta, que es como el equipo lo lleva en su hoja de
 * cálculo, y ordenable por cualquier columna (Hotman, 20-ago).
 */
function TablaEntregables({ tareas, onAbrir, onAvanzar, avanzandoId }: {
  tareas: Contenido[]
  onAbrir: (c: Contenido) => void
  onAvanzar: (id: string, estado: Contenido['estado']) => void
  avanzandoId?: string
}) {
  const [orden, setOrden] = useState<{ col: Columna; asc: boolean }>({ col: 'fecha', asc: true })

  const ordenar = (col: Columna) =>
    setOrden(o => (o.col === col ? { col, asc: !o.asc } : { col, asc: true }))

  const bandas = useMemo(() => {
    const clave = (c: Contenido, col: Columna) => {
      switch (col) {
        case 'titulo':      return c.titulo.toLowerCase()
        case 'tipo':        return TIPO_LABEL[c.tipo]
        case 'responsable': return c.asignadoA?.nombre ?? 'zzz'
        case 'estado':      return ['PLANIFICADO', 'EN_PROCESO', 'PUBLICADO'].indexOf(c.estado)
        case 'fecha':       return c.fecha.slice(0, 10)
        case 'valor':       return c.valor ?? -1
      }
    }
    const mapa = new Map<string, Contenido[]>()
    for (const c of tareas) {
      const k = c.destino ?? '__sin__'
      if (!mapa.has(k)) mapa.set(k, [])
      mapa.get(k)!.push(c)
    }
    return ORDEN_DESTINO
      .filter(k => mapa.has(k))
      .map(k => ({
        destino: k,
        // La ordenación manda dentro de cada cuenta: reordenar el mundo entero
        // rompería las bandas, que es lo que da sentido a la lista.
        filas: [...mapa.get(k)!].sort((a, b) => {
          const x = clave(a, orden.col), y = clave(b, orden.col)
          const cmp = x < y ? -1 : x > y ? 1 : 0
          return orden.asc ? cmp : -cmp
        }),
      }))
  }, [tareas, orden])

  const publicadas = tareas.filter(t => t.estado === 'PUBLICADO').length
  const conCorreccion = tareas.filter(t => (t.correcciones ?? []).some(x => !x.resueltaEn)).length
  const freelance = tareas.reduce((a, t) => a + (t.tipoTrabajo === 'FREELANCE' ? t.valor ?? 0 : 0), 0)

  const Cabecera = ({ col, texto, alDerecha }: { col: Columna; texto: string; alDerecha?: boolean }) => (
    <th className={cn('whitespace-nowrap px-3.5 py-2.5 first:pl-5 last:pr-5', alDerecha ? 'text-right' : 'text-left')}>
      <button
        type="button"
        onClick={() => ordenar(col)}
        className={cn(
          'inline-flex cursor-pointer items-center gap-1.5 text-[11.5px] font-semibold transition-colors',
          orden.col === col ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface',
        )}
      >
        {texto}
        {orden.col === col
          ? <ChevronDown className={cn('size-3 text-primary transition-transform', !orden.asc && 'rotate-180')} />
          : <ChevronsUpDown className="size-3 opacity-35" />}
      </button>
    </th>
  )

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-lowest">
              <Cabecera col="titulo" texto="Nombre" />
              <Cabecera col="tipo" texto="Tipo" />
              <Cabecera col="responsable" texto="Responsable" />
              <Cabecera col="estado" texto="Estado" />
              <Cabecera col="fecha" texto="Fecha" />
              <th className="px-3.5 py-2.5 text-left text-[11.5px] font-semibold text-on-surface-variant">
                Enlace
              </th>
              <Cabecera col="valor" texto="Pago" alDerecha />
            </tr>
          </thead>
          <tbody>
            {bandas.map(b => {
              const publ = b.filas.filter(t => t.estado === 'PUBLICADO').length
              return (
                <Fragment key={b.destino}>
                  {/* La franja de cuenta, como en la hoja de cálculo.
                      Llevaba el mismo azul claro que la fila de títulos y que
                      el fondo de la página, así que las tres se confundían y
                      la banda dejaba de separar nada (Hotman, 20-ago). Ahora
                      es un tono decididamente más oscuro, con una barra de
                      color a la izquierda que la ancla como corte. */}
                  <tr>
                    <td
                      colSpan={7}
                      className="border-y border-outline-variant bg-surface-low px-5 py-2.5 text-left shadow-[inset_3px_0_0_var(--primary)]"
                    >
                      <span className="inline-flex items-baseline gap-2.5">
                        {/* El nombre de la cuenta es un título de sección, no
                            una etiqueta: se lee al tamaño del contenido y con
                            su acento, no en versalitas apretadas. */}
                        <span className="text-[13px] font-semibold tracking-[-0.01em] text-on-surface">
                          {DESTINO_LABEL[b.destino]}
                        </span>
                        <span className="text-[11.5px] text-on-surface-variant">
                          {b.filas.length} pieza{b.filas.length !== 1 ? 's' : ''} · {publ} publicada{publ !== 1 ? 's' : ''}
                        </span>
                      </span>
                    </td>
                  </tr>

                  {b.filas.map(t => {
                    const pendientes = (t.correcciones ?? []).filter(x => !x.resueltaEn).length
                    const enlace = t.entregables[0]
                    return (
                      <tr
                        key={t.id}
                        onClick={() => onAbrir(t)}
                        className={cn(
                          'group/fila cursor-pointer border-b border-outline-variant transition-colors last:border-b-0 hover:bg-surface-low/60',
                          pendientes > 0 && 'bg-[#dc2626]/[0.04] shadow-[inset_3px_0_0_#dc2626]',
                        )}
                      >
                        <td className="max-w-[280px] px-3.5 py-2.5 pl-5">
                          <p className="truncate text-[12.5px] font-medium text-on-surface">{t.titulo}</p>
                          {pendientes > 0 && (
                            <p className="mt-0.5 text-[10.5px] font-semibold text-[#dc2626]">
                              {pendientes} corrección{pendientes !== 1 ? 'es' : ''} por hacer
                            </p>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className="inline-block whitespace-nowrap rounded-md bg-surface-high px-2 py-1 text-[10.5px] font-semibold text-on-surface-variant">
                            {TIPO_LABEL[t.tipo]}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5">
                          {t.asignadoA ? (
                            <span className="inline-flex max-w-[150px] items-center gap-2">
                              <AvatarMiembro
                                id={t.asignadoA.id}
                                nombre={t.asignadoA.nombre}
                                image={t.asignadoA.user?.image}
                                size={22}
                              />
                              <span className="truncate text-[12px] text-on-surface">
                                {t.asignadoA.nombre.split(' ').slice(0, 2).join(' ')}
                              </span>
                            </span>
                          ) : (
                            <span className="text-[11.5px] italic text-on-surface-variant opacity-60">Sin responsable</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5" onClick={ev => ev.stopPropagation()}>
                          <CeldaEstado c={t} onAvanzar={onAvanzar} avanzando={avanzandoId === t.id} />
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-2.5 text-[12px] text-on-surface">
                          {format(deISO(t.fecha), "d 'de' MMM", { locale: es })}
                        </td>
                        <td className="px-3.5 py-2.5" onClick={ev => ev.stopPropagation()}>
                          {enlace ? (
                            <span className="inline-flex items-center gap-1.5">
                              <a
                                href={enlace.url ?? enlace.videoUrl ?? '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-full bg-surface-high px-2.5 py-1 text-[10.5px] font-semibold text-on-surface-variant transition-colors hover:bg-primary-container hover:text-primary"
                              >
                                <Link2 className="size-3" />
                                {PLATAFORMA_LABEL[enlace.plataforma] ?? enlace.plataforma}
                              </a>
                              {t.entregables.length > 1 && (
                                <span className="text-[10.5px] font-semibold text-on-surface-variant">
                                  +{t.entregables.length - 1}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[11px] text-on-surface-variant opacity-45">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-2.5 pr-5 text-right">
                          {t.tipoTrabajo === 'FREELANCE' ? (
                            <span className="text-[12.5px] font-semibold tabular-nums tracking-tight text-on-surface">
                              ${(t.valor ?? 0).toLocaleString('es-CO')}
                            </span>
                          ) : (
                            <span className="text-[12px] text-on-surface-variant">Empresa</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Lo que hoy hay que sacar a mano para Cobros. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant bg-surface-low px-5 py-3">
        <p className="text-[11.5px] text-on-surface-variant">
          <b className="font-semibold text-on-surface">{tareas.length}</b> pieza{tareas.length !== 1 ? 's' : ''}
          {' · '}<b className="font-semibold text-on-surface">{publicadas}</b> publicada{publicadas !== 1 ? 's' : ''}
          {conCorreccion > 0 && <> · <b className="font-semibold text-[#dc2626]">{conCorreccion}</b> con correcciones</>}
        </p>
        <p className="flex items-baseline gap-2.5">
          <span className="text-[11px] font-semibold text-on-surface-variant">
            Freelance del período
          </span>
          <span className="text-[17px] font-semibold tabular-nums tracking-tight text-on-surface">
            ${freelance.toLocaleString('es-CO')}
          </span>
        </p>
      </div>
    </div>
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
  // Cómo prefiere verlo cada quien. Se recuerda en el equipo: quien trabaja
  // con la tabla no tiene que volver a elegirla cada mañana (Hotman, 20-ago).
  // La tabla es la vista de entrada: es la que responde las preguntas del día
  // —qué hay para el 21, qué falta por publicar, cuánto se debe— y la que se
  // parece a la hoja de cálculo con la que el equipo ya trabajaba.
  const [vista, setVista] = useState<'tarjetas' | 'tabla'>('tabla')
  useEffect(() => {
    const guardada = localStorage.getItem('entregables-vista')
    if (guardada === 'tabla' || guardada === 'tarjetas') setVista(guardada)
  }, [])
  const cambiarVista = (v: 'tarjetas' | 'tabla') => {
    setVista(v)
    localStorage.setItem('entregables-vista', v)
  }
  const [verTodas, setVerTodas] = useState<Grupo | null>(null)
  const [detalle, setDetalle] = useState<Contenido | null>(null)
  const [editando, setEditando] = useState<Contenido | null>(null)
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

  const { data: miembrosData } = useQuery({
    queryKey: ['marketing-miembros'],
    queryFn: () => apiFetch<{ data: Miembro[] }>('/marketing/miembros'),
    staleTime: 5 * 60_000,
  })
  const miembrosMkt = miembrosData?.data ?? []

  const { data, isLoading } = useQuery({
    queryKey: ['marketing-contenidos-equipo', desde, hasta],
    queryFn: () => apiFetch<{ data: Contenido[] }>(`/marketing/contenidos?desde=${desde}&hasta=${hasta}`),
    staleTime: 30_000,
  })

  // Agrupado por persona, y los que nadie tomó al final: no es una persona
  // más, es una alerta — algo agendado que no tiene quién lo haga.
  const grupos = useMemo(() => {
    const todos = visiblesPara(data?.data ?? [], { rol, userId: miUserId, miembros: miembrosMkt })
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
  }, [data, filtro, rol, miUserId, miembrosMkt])

  // Las mismas tareas sin agrupar. Sale de `grupos` a propósito: así la tabla
  // no puede enseñar de más — el filtro de privacidad ya se aplicó ahí.
  const planas = useMemo(() => grupos.flatMap(g => g.tareas), [grupos])

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
          {/* Dos formas de ver lo mismo: las tarjetas responden "¿qué tiene
              cada quien?" y la tabla "¿qué hay para el 21?". */}
          <div className="flex gap-0.5 rounded-xl border border-outline-variant bg-surface-low p-1" role="group" aria-label="Forma de ver">
            {([
              { v: 'tabla'    as const, icono: Rows3,      texto: 'Tabla' },
              { v: 'tarjetas' as const, icono: LayoutList, texto: 'Tarjetas' },
            ]).map(o => (
              <button
                key={o.v}
                type="button"
                onClick={() => cambiarVista(o.v)}
                aria-pressed={vista === o.v}
                className={cn(
                  'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[11.5px] font-semibold transition-colors',
                  vista === o.v
                    ? 'bg-surface-lowest text-on-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface',
                )}
              >
                <o.icono className="size-3.5" />
                {o.texto}
              </button>
            ))}
          </div>
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
      ) : vista === 'tabla' ? (
        <TablaEntregables
          tareas={planas}
          onAbrir={setDetalle}
          onAvanzar={(id, estado) => avanzar.mutate({ id, estado })}
          avanzandoId={avanzar.isPending ? avanzar.variables?.id : undefined}
        />
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
          // Puede editar quien tiene la tarea a su nombre, quien la asigno y
          // los lideres: el resto solo la ve.
          onEditar={
            esLiderMarketing(rol) ||
            detalle.asignadoA?.userId === miUserId ||
            (!!detalle.asignadoPorId && detalle.asignadoPorId === miUserId)
              ? () => { setEditando(detalle); setDetalle(null) }
              : undefined
          }
          onCerrar={() => setDetalle(null)}
          onCambio={() => queryClient.invalidateQueries({ queryKey: ['marketing-contenidos-equipo'] })}
          // El mismo botón que avanza en la lista, para no tener que cerrar y
          // volver a buscar la fila después de arreglar una corrección.
          onAvanzar={(id, estado) => avanzar.mutate({ id, estado })}
          avanzando={avanzar.isPending && avanzar.variables?.id === detalle.id}
          miUserId={miUserId}
          esAdmin={rol === 'ADMIN'}
        />
      )}

      {/* El formulario completo, el mismo del Planificador */}
      {editando && (
        <ContenidoModal
          contenido={editando}
          miembros={miembrosMkt}
          agenda={data?.data ?? []}
          onClose={() => setEditando(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['marketing-contenidos-equipo'] })
            queryClient.invalidateQueries({ queryKey: ['marketing-contenidos'] })
            setEditando(null)
          }}
        />
      )}
    </div>
  )
}
