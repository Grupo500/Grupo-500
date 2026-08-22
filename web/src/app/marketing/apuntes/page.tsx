'use client'

/**
 * Apuntes: el bloc de notas de cada quien en Marketing (Hotman, 22-ago).
 *
 * A la izquierda la lista (fijadas arriba, luego por última edición, con su
 * etiqueta de color); a la derecha la nota abierta con su barra de formato.
 * El editor es `contenteditable` con los comandos del navegador: negrita,
 * cursiva, subrayado, tachado, color y marcador sobre lo seleccionado;
 * título/subtítulo; alineación; viñetas, numeradas y lista de tareas con
 * casillas; cita, enlace, separador y limpiar formato. Guarda solo mientras
 * se escribe —sin botón— y el servidor limpia el HTML de lo que no sea
 * formato.
 *
 * Privado por defecto: cada quien ve lo suyo y lo que le compartieron.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { formatDistanceToNowStrict } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Plus, Search, X, Pin, Tag, Users, MoreHorizontal, Undo2, Redo2, Bold, Italic, Underline,
  Strikethrough, Baseline, Highlighter, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, ListChecks, Quote, Link2, Minus, RemoveFormatting, Archive, ArchiveRestore,
  Trash2, Copy, RotateCcw, ChevronLeft, ChevronDown, Check, Loader2, NotebookPen,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { AvatarMiembro } from '@/components/marketing/AvatarMiembro'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Apunte {
  id: string
  titulo: string
  contenido: string
  etiqueta: string | null
  color: string | null
  fijado: boolean
  archivadoEn: string | null
  eliminadoEn: string | null
  createdAt: string
  updatedAt: string
  dueno: { id: string; nombre: string | null; image: string | null }
  compartidos: { userId: string; nombre: string | null; image: string | null; puedeEditar: boolean }[]
  miPermiso: 'dueno' | 'editar' | 'ver'
}
interface Miembro { id: string; nombre: string; userId?: string; user?: { image: string | null } }
type Vista = 'activas' | 'archivadas' | 'papelera'

const VISTAS: { v: Vista; texto: string }[] = [
  { v: 'activas',    texto: 'Notas' },
  { v: 'archivadas', texto: 'Archivadas' },
  { v: 'papelera',   texto: 'Papelera' },
]

/** Los colores de etiqueta, por nombre: el dato guarda la clave, no el tono. */
const COLORES: Record<string, { fondo: string; texto: string; muestra: string }> = {
  amarillo: { fondo: '#fef3c7', texto: '#92400e', muestra: '#f59e0b' },
  verde:    { fondo: '#dcfce7', texto: '#166534', muestra: '#16a34a' },
  azul:     { fondo: '#dbeafe', texto: '#1e40af', muestra: '#2094ff' },
  rosa:     { fondo: '#fce7f3', texto: '#9d174d', muestra: '#ec4899' },
  morado:   { fondo: '#ede9fe', texto: '#5b21b6', muestra: '#8b5cf6' },
  gris:     { fondo: '#f1f5f9', texto: '#334155', muestra: '#94a3b8' },
}

const textoPlano = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
const haceCuanto = (iso: string) => formatDistanceToNowStrict(new Date(iso), { locale: es, addSuffix: true })

// ── Página ────────────────────────────────────────────────────────────────────
export default function ApuntesPage() {
  const queryClient = useQueryClient()
  const { data: sesion } = useSession()
  const miId = sesion?.user?.id ?? ''

  const [vista, setVista] = useState<Vista>('activas')
  const [busqueda, setBusqueda] = useState('')
  const [seleccionada, setSeleccionada] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['apuntes', vista],
    queryFn: () => apiFetch<{ data: Apunte[] }>(`/marketing/apuntes?vista=${vista}`),
  })
  const apuntes = useMemo(() => data?.data ?? [], [data])
  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['apuntes'] })

  const { data: miembrosData } = useQuery({
    queryKey: ['marketing-miembros'],
    queryFn: () => apiFetch<{ data: Miembro[] }>('/marketing/miembros'),
    staleTime: 5 * 60_000,
  })
  const miembros = (miembrosData?.data ?? []).filter(m => m.userId && m.userId !== miId)

  // La búsqueda mira título y texto, sin etiquetas HTML.
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return apuntes
    return apuntes.filter(a => a.titulo.toLowerCase().includes(q) || textoPlano(a.contenido).toLowerCase().includes(q))
  }, [apuntes, busqueda])
  const mias = visibles.filter(a => a.miPermiso === 'dueno')
  const compartidasConmigo = visibles.filter(a => a.miPermiso !== 'dueno')
  const abierta = apuntes.find(a => a.id === seleccionada) ?? null

  const crear = useMutation({
    mutationFn: () => apiFetch<{ data: Apunte }>('/marketing/apuntes', { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: r => { invalidar(); setVista('activas'); setSeleccionada(r.data.id) },
  })

  return (
    <div className="flex h-[calc(100dvh-140px)] min-h-[520px] flex-col gap-3 animate-fade-in">
      <PageHeader title="Apuntes" />

      <div className={cn('flex items-center gap-2', abierta && 'max-md:hidden')}>
        <label className="flex h-[38px] min-w-[130px] flex-1 items-center gap-2 rounded-lg border border-outline-variant bg-surface-lowest px-3 transition-colors focus-within:border-primary">
          <Search className="size-3.5 shrink-0 text-on-surface-variant" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar en mis apuntes…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-on-surface outline-none placeholder:text-on-surface-variant/60"
          />
          {busqueda && (
            <button type="button" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda" className="grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-full bg-surface-high text-on-surface-variant hover:text-on-surface">
              <X className="size-2.5" strokeWidth={3} />
            </button>
          )}
        </label>
        <div className="flex h-[38px] shrink-0 items-center gap-0.5 rounded-xl border border-outline-variant bg-surface-low p-[3px]" role="group" aria-label="Qué notas ver">
          {VISTAS.map(o => (
            <button
              key={o.v}
              type="button"
              onClick={() => { setVista(o.v); setSeleccionada(null) }}
              aria-pressed={vista === o.v}
              className={cn(
                'inline-flex h-[30px] cursor-pointer items-center whitespace-nowrap rounded-lg px-3 text-[12.5px] transition-colors',
                vista === o.v ? 'bg-surface-lowest font-semibold text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              {o.texto}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => crear.mutate()}
          disabled={crear.isPending}
          className="inline-flex h-[38px] shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="size-4" strokeWidth={2.2} />
          <span className="max-sm:hidden">Nueva nota</span>
        </button>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[300px_1fr]">
        {/* ── Lista ── */}
        <div className={cn('flex min-h-0 flex-col gap-1 overflow-auto rounded-2xl border border-outline-variant bg-surface-lowest p-2', abierta && 'max-md:hidden')}>
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-on-surface-variant"><Loader2 className="size-5 animate-spin" /></div>
          ) : visibles.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-[12.5px] text-on-surface-variant">
              <NotebookPen className="size-6 opacity-50" />
              {busqueda ? 'Nada con ese texto.' : vista === 'activas' ? 'Todavía no tienes apuntes. Crea el primero.' : vista === 'archivadas' ? 'Nada archivado.' : 'La papelera está vacía.'}
            </div>
          ) : (
            <>
              {mias.length > 0 && (
                <>
                  {mias.map(a => <FilaNota key={a.id} a={a} activa={a.id === seleccionada} onClick={() => setSeleccionada(a.id)} />)}
                </>
              )}
              {compartidasConmigo.length > 0 && (
                <>
                  <p className="px-2 pb-0.5 pt-3 text-[10.5px] font-semibold text-on-surface-variant">Compartidas conmigo</p>
                  {compartidasConmigo.map(a => <FilaNota key={a.id} a={a} activa={a.id === seleccionada} onClick={() => setSeleccionada(a.id)} />)}
                </>
              )}
            </>
          )}
        </div>

        {/* ── Editor ── */}
        <div className={cn('flex min-h-0 flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-lowest', !abierta && 'max-md:hidden')}>
          {abierta ? (
            <Editor
              key={abierta.id}
              apunte={abierta}
              miembros={miembros}
              vista={vista}
              onVolver={() => setSeleccionada(null)}
              onCambio={invalidar}
              onCerrar={() => { setSeleccionada(null); invalidar() }}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-[13px] text-on-surface-variant">
              <NotebookPen className="size-7 opacity-40" />
              Elige una nota o crea una nueva.
            </div>
          )}
        </div>
      </div>

      {/* El formato del texto vive en clases propias: el preflight de Tailwind
          borra listas y títulos, y aquí sí se necesitan. */}
      <style>{`
        .apunte-texto{outline:0;font-size:14px;line-height:1.7}
        .apunte-texto h1,.apunte-texto h2{font-size:20px;font-weight:700;letter-spacing:-.015em;margin:0 0 8px}
        .apunte-texto h3,.apunte-texto h4{font-size:15.5px;font-weight:600;margin:16px 0 6px}
        .apunte-texto p,.apunte-texto div{margin:0 0 6px}
        .apunte-texto ul{list-style:disc;margin:4px 0 10px 22px}
        .apunte-texto ol{list-style:decimal;margin:4px 0 10px 22px}
        .apunte-texto li{margin:2px 0}
        .apunte-texto mark{background:#fef08a;padding:0 2px;border-radius:2px}
        .apunte-texto a{color:#1a7de0;text-decoration:underline}
        .apunte-texto blockquote{border-left:3px solid #21b9f7;margin:10px 0;padding:6px 14px;background:#f0f9ff;border-radius:0 10px 10px 0}
        .apunte-texto hr{border:0;border-top:1px solid var(--outline-variant);margin:14px 0}
        .apunte-texto li.tarea{list-style:none;margin-left:-22px;display:flex;align-items:flex-start;gap:8px}
        .apunte-texto li.tarea input{margin-top:6px;accent-color:#16a34a}
        .apunte-texto li.tarea.ok span{text-decoration:line-through;color:#94a3b8}
        .apunte-texto:empty:before{content:'Escribe aquí…';color:#94a3b8}
      `}</style>
    </div>
  )
}

// ── Una fila de la lista ──────────────────────────────────────────────────────
function FilaNota({ a, activa, onClick }: { a: Apunte; activa: boolean; onClick: () => void }) {
  const color = a.color ? COLORES[a.color] : null
  const resumen = textoPlano(a.contenido)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full cursor-pointer rounded-xl border px-3 py-2.5 text-left transition-colors',
        activa ? 'border-[#bfe0ff] bg-[#e8f3ff]' : 'border-transparent hover:bg-surface-low',
      )}
    >
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-on-surface">
        {a.fijado && <Pin className="size-3 shrink-0 text-[#d97706]" />}
        <span className="truncate">{a.titulo || 'Sin título'}</span>
      </span>
      <span className="mt-0.5 block truncate text-[11.5px] text-on-surface-variant">{resumen || 'Vacía'}</span>
      <span className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-on-surface-variant">
        {a.etiqueta && (
          <span className="rounded-full px-2 py-px text-[10px] font-semibold" style={{ background: color?.fondo ?? '#f1f5f9', color: color?.texto ?? '#334155' }}>
            {a.etiqueta}
          </span>
        )}
        {a.miPermiso !== 'dueno' && <span className="rounded-full bg-surface-high px-2 py-px text-[10px] font-semibold">de {a.dueno.nombre?.split(' ')[0] ?? 'alguien'}</span>}
        <span>{haceCuanto(a.updatedAt)}</span>
      </span>
    </button>
  )
}

// ── El editor ─────────────────────────────────────────────────────────────────
const BLOQUE: Record<string, string> = { P: 'Texto normal', DIV: 'Texto normal', H1: 'Título', H2: 'Título', H3: 'Subtítulo', H4: 'Subtítulo', BLOCKQUOTE: 'Cita', LI: 'Lista' }

function Editor({ apunte, miembros, vista, onVolver, onCambio, onCerrar }: {
  apunte: Apunte
  miembros: Miembro[]
  vista: Vista
  onVolver: () => void
  onCambio: () => void
  onCerrar: () => void
}) {
  const esDueno = apunte.miPermiso === 'dueno'
  const puedeEscribir = apunte.miPermiso !== 'ver' && !apunte.eliminadoEn
  const hoja = useRef<HTMLDivElement>(null)
  const [titulo, setTitulo] = useState(apunte.titulo)
  const [estadoGuardado, setEstadoGuardado] = useState<'guardado' | 'guardando' | 'error'>('guardado')
  const [ultimoGuardado, setUltimoGuardado] = useState<Date>(new Date(apunte.updatedAt))
  const [bloque, setBloque] = useState('Texto normal')
  const [activos, setActivos] = useState<Record<string, boolean>>({})
  const [menu, setMenu] = useState<'etiqueta' | 'compartir' | 'mas' | null>(null)
  const [palabras, setPalabras] = useState(() => textoPlano(apunte.contenido).split(' ').filter(Boolean).length)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  // El contenido entra al DOM una sola vez, al abrir la nota: volver a
  // meterlo con cada refetch movería el cursor de quien escribe.
  useEffect(() => {
    if (hoja.current) {
      hoja.current.innerHTML = apunte.contenido
      hoja.current.querySelectorAll<HTMLLIElement>('li.tarea').forEach(li => {
        const caja = li.querySelector<HTMLInputElement>('input[type=checkbox]')
        li.classList.toggle('ok', !!caja?.checked)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apunte.id])

  const guardar = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<{ data: Apunte }>(`/marketing/apuntes/${apunte.id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => { setEstadoGuardado('guardado'); setUltimoGuardado(new Date()); onCambio() },
    onError: () => setEstadoGuardado('error'),
  })

  /** Guarda título y texto un momento después de la última tecla. */
  const programarGuardado = useCallback(() => {
    if (!puedeEscribir) return
    setEstadoGuardado('guardando')
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => {
      const html = hoja.current?.innerHTML ?? ''
      setPalabras(textoPlano(html).split(' ').filter(Boolean).length)
      guardar.mutate({ titulo: hoja.current ? (document.getElementById(`titulo-${apunte.id}`) as HTMLInputElement | null)?.value ?? '' : '', contenido: html })
    }, 800)
  }, [apunte.id, guardar, puedeEscribir])

  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current) }, [])

  const refrescarEstado = useCallback(() => {
    const sel = window.getSelection()
    let n: Node | null = sel?.anchorNode ?? null
    let etiqueta = 'P'
    while (n && n !== hoja.current) {
      if (n.nodeType === 1 && BLOQUE[(n as Element).tagName]) { etiqueta = (n as Element).tagName; break }
      n = n.parentNode
    }
    setBloque(BLOQUE[etiqueta] ?? 'Texto normal')
    const e: Record<string, boolean> = {}
    for (const c of ['bold', 'italic', 'underline', 'strikeThrough', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull', 'insertUnorderedList', 'insertOrderedList']) {
      try { e[c] = document.queryCommandState(c) } catch { e[c] = false }
    }
    setActivos(e)
  }, [])

  useEffect(() => {
    const alSeleccionar = () => { if (hoja.current && hoja.current.contains(document.activeElement)) refrescarEstado() }
    document.addEventListener('selectionchange', alSeleccionar)
    return () => document.removeEventListener('selectionchange', alSeleccionar)
  }, [refrescarEstado])

  /** Un comando del navegador sobre la selección, sin soltar el foco. */
  const ejecutar = (cmd: string, valor?: string) => {
    if (!puedeEscribir) return
    hoja.current?.focus()
    if (cmd === 'enlace') {
      const url = window.prompt('Enlace (https://…)')
      if (url) document.execCommand('createLink', false, url)
    } else if (cmd === 'tarea') {
      document.execCommand('insertUnorderedList')
      const sel = window.getSelection()
      const nodo = sel?.anchorNode
      const li = nodo ? (nodo.nodeType === 1 ? (nodo as Element) : nodo.parentElement)?.closest('li') : null
      if (li && !li.classList.contains('tarea')) {
        li.classList.add('tarea')
        li.innerHTML = `<input type="checkbox"><span>${li.innerHTML || 'Nueva tarea'}</span>`
      }
    } else if (cmd === 'bloque') {
      const sig = bloque === 'Título' ? 'H3' : bloque === 'Subtítulo' ? 'P' : 'H2'
      document.execCommand('formatBlock', false, sig)
    } else {
      document.execCommand(cmd, false, valor ?? undefined)
    }
    refrescarEstado()
    programarGuardado()
  }

  const alCambiarCasilla = (e: React.ChangeEvent<HTMLDivElement>) => {
    const t = e.target as unknown as HTMLInputElement
    if (t?.type === 'checkbox') {
      // La propiedad no viaja en el HTML; el atributo sí.
      t.toggleAttribute('checked', t.checked)
      t.closest('li')?.classList.toggle('ok', t.checked)
      programarGuardado()
    }
  }

  const accion = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<{ data: Apunte }>(`/marketing/apuntes/${apunte.id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => { onCambio(); setMenu(null) },
  })
  const duplicar = useMutation({
    mutationFn: () => apiFetch<{ data: Apunte }>(`/marketing/apuntes/${apunte.id}/duplicar`, { method: 'POST' }),
    onSuccess: () => { onCambio(); setMenu(null) },
  })
  const eliminarDelTodo = useMutation({
    mutationFn: () => apiFetch(`/marketing/apuntes/${apunte.id}`, { method: 'DELETE' }),
    onSuccess: onCerrar,
  })
  const compartir = useMutation({
    mutationFn: ({ userId, puedeEditar }: { userId: string; puedeEditar: boolean }) =>
      apiFetch<{ data: Apunte }>(`/marketing/apuntes/${apunte.id}/compartir`, { method: 'PUT', body: JSON.stringify({ userId, puedeEditar }) }),
    onSuccess: onCambio,
  })
  const dejarDeCompartir = useMutation({
    mutationFn: (userId: string) => apiFetch<{ data: Apunte }>(`/marketing/apuntes/${apunte.id}/compartir/${userId}`, { method: 'DELETE' }),
    onSuccess: onCambio,
  })

  const color = apunte.color ? COLORES[apunte.color] : null
  const Boton = ({ cmd, valor, titulo: t, activo, children }: { cmd: string; valor?: string; titulo: string; activo?: boolean; children: React.ReactNode }) => (
    <button
      type="button"
      title={t}
      aria-label={t}
      aria-pressed={activo}
      disabled={!puedeEscribir}
      onMouseDown={e => { e.preventDefault(); ejecutar(cmd, valor) }}
      className={cn(
        'grid h-[30px] min-w-[30px] cursor-pointer place-items-center rounded-lg px-1.5 text-on-surface transition-colors hover:bg-surface-high disabled:cursor-default disabled:opacity-40',
        activo && 'bg-[#dbeafe] text-[#1e40af]',
      )}
    >
      {children}
    </button>
  )

  return (
    <>
      {/* Cabecera: título + acciones de la nota */}
      <div className="flex items-center gap-2 border-b border-outline-variant px-3 py-2.5 sm:px-4">
        <button type="button" onClick={onVolver} aria-label="Volver a la lista" className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-outline-variant text-on-surface-variant md:hidden">
          <ChevronLeft className="size-4" />
        </button>
        <input
          id={`titulo-${apunte.id}`}
          value={titulo}
          onChange={e => { setTitulo(e.target.value); programarGuardado() }}
          placeholder="Título"
          readOnly={!puedeEscribir}
          className="min-w-0 flex-1 bg-transparent text-[17px] font-bold tracking-[-0.015em] text-on-surface outline-none placeholder:text-on-surface-variant/50"
        />
        {apunte.etiqueta && (
          <span className="hidden rounded-full px-2.5 py-1 text-[10.5px] font-semibold sm:inline" style={{ background: color?.fondo ?? '#f1f5f9', color: color?.texto ?? '#334155' }}>
            {apunte.etiqueta}
          </span>
        )}
        {esDueno && (
          <>
            <IconoAccion titulo={apunte.fijado ? 'Quitar de fijadas' : 'Fijar arriba'} activo={apunte.fijado} onClick={() => accion.mutate({ fijado: !apunte.fijado })}>
              <Pin className="size-3.5" />
            </IconoAccion>
            <div className="relative">
              <IconoAccion titulo="Etiqueta y color" activo={menu === 'etiqueta'} onClick={() => setMenu(m => (m === 'etiqueta' ? null : 'etiqueta'))}><Tag className="size-3.5" /></IconoAccion>
              {menu === 'etiqueta' && (
                <Flotante onCerrar={() => setMenu(null)}>
                  <p className="mb-2 text-[11px] font-semibold text-on-surface-variant">Etiqueta</p>
                  <input
                    defaultValue={apunte.etiqueta ?? ''}
                    placeholder="Pendientes, Ideas, Reuniones…"
                    onKeyDown={e => { if (e.key === 'Enter') accion.mutate({ etiqueta: (e.target as HTMLInputElement).value.trim() || null }) }}
                    onBlur={e => { const v = e.target.value.trim(); if (v !== (apunte.etiqueta ?? '')) accion.mutate({ etiqueta: v || null }) }}
                    className="input-base mb-3 h-9 w-full text-[13px]"
                  />
                  <p className="mb-2 text-[11px] font-semibold text-on-surface-variant">Color</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(COLORES).map(([k, c]) => (
                      <button key={k} type="button" title={k} onClick={() => accion.mutate({ color: k })} className="grid size-7 cursor-pointer place-items-center rounded-full border border-outline-variant" style={{ background: c.fondo }}>
                        {apunte.color === k && <Check className="size-3.5" style={{ color: c.texto }} />}
                      </button>
                    ))}
                    <button type="button" title="Sin color" onClick={() => accion.mutate({ color: null })} className="grid size-7 cursor-pointer place-items-center rounded-full border border-dashed border-outline text-on-surface-variant"><X className="size-3" /></button>
                  </div>
                </Flotante>
              )}
            </div>
            <div className="relative">
              <IconoAccion titulo="Compartir con alguien del equipo" activo={menu === 'compartir' || apunte.compartidos.length > 0} onClick={() => setMenu(m => (m === 'compartir' ? null : 'compartir'))}><Users className="size-3.5" /></IconoAccion>
              {menu === 'compartir' && (
                <Flotante onCerrar={() => setMenu(null)} ancho={300}>
                  <p className="mb-2 text-[11px] font-semibold text-on-surface-variant">Compartir con</p>
                  {miembros.length === 0 && <p className="text-[12px] text-on-surface-variant">No hay nadie más en el equipo.</p>}
                  <div className="max-h-[260px] space-y-1 overflow-auto">
                    {miembros.map(m => {
                      const c = apunte.compartidos.find(x => x.userId === m.userId)
                      return (
                        <div key={m.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-surface-low">
                          <AvatarMiembro id={m.id} nombre={m.nombre} image={m.user?.image} size={24} />
                          <span className="min-w-0 flex-1 truncate text-[12.5px]">{m.nombre}</span>
                          <div className="flex overflow-hidden rounded-lg border border-outline-variant text-[11px]">
                            <button type="button" onClick={() => c && !c.puedeEditar ? dejarDeCompartir.mutate(m.userId!) : compartir.mutate({ userId: m.userId!, puedeEditar: false })}
                              className={cn('cursor-pointer px-2 py-1', c && !c.puedeEditar ? 'bg-primary font-semibold text-on-primary' : 'text-on-surface-variant hover:bg-surface-low')}>Ver</button>
                            <button type="button" onClick={() => c?.puedeEditar ? dejarDeCompartir.mutate(m.userId!) : compartir.mutate({ userId: m.userId!, puedeEditar: true })}
                              className={cn('cursor-pointer border-l border-outline-variant px-2 py-1', c?.puedeEditar ? 'bg-primary font-semibold text-on-primary' : 'text-on-surface-variant hover:bg-surface-low')}>Editar</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="mt-2 text-[10.5px] text-on-surface-variant">Toca otra vez para dejar de compartir.</p>
                </Flotante>
              )}
            </div>
            <div className="relative">
              <IconoAccion titulo="Más" activo={menu === 'mas'} onClick={() => setMenu(m => (m === 'mas' ? null : 'mas'))}><MoreHorizontal className="size-3.5" /></IconoAccion>
              {menu === 'mas' && (
                <Flotante onCerrar={() => setMenu(null)} ancho={220}>
                  <OpcionMenu icono={<Copy className="size-3.5" />} texto="Duplicar" onClick={() => duplicar.mutate()} />
                  {vista !== 'papelera' && (
                    <OpcionMenu icono={apunte.archivadoEn ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />} texto={apunte.archivadoEn ? 'Sacar de archivadas' : 'Archivar'} onClick={() => accion.mutate({ archivado: !apunte.archivadoEn })} />
                  )}
                  {apunte.eliminadoEn ? (
                    <>
                      <OpcionMenu icono={<RotateCcw className="size-3.5" />} texto="Restaurar" onClick={() => accion.mutate({ eliminado: false })} />
                      <OpcionMenu icono={<Trash2 className="size-3.5" />} texto="Eliminar definitivamente" peligro onClick={() => { if (confirm('¿Eliminar este apunte del todo? No se puede deshacer.')) eliminarDelTodo.mutate() }} />
                    </>
                  ) : (
                    <OpcionMenu icono={<Trash2 className="size-3.5" />} texto="Eliminar" peligro onClick={() => accion.mutate({ eliminado: true })} />
                  )}
                </Flotante>
              )}
            </div>
          </>
        )}
      </div>

      {/* Barra de formato */}
      <div className="flex flex-nowrap items-center gap-0.5 overflow-x-auto border-b border-outline-variant bg-surface-low px-2 py-1.5">
        <Boton cmd="undo" titulo="Deshacer (Ctrl+Z)"><Undo2 className="size-[15px]" /></Boton>
        <Boton cmd="redo" titulo="Rehacer (Ctrl+Y)"><Redo2 className="size-[15px]" /></Boton>
        <Separador />
        <button type="button" disabled={!puedeEscribir} onMouseDown={e => { e.preventDefault(); ejecutar('bloque') }} title="Tipo de texto: toca para alternar normal, título y subtítulo"
          className="inline-flex h-[30px] cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg px-2 text-[12px] font-medium text-on-surface hover:bg-surface-high disabled:opacity-40">
          {bloque} <ChevronDown className="size-3 text-on-surface-variant" />
        </button>
        <Separador />
        <Boton cmd="bold" titulo="Negrita (Ctrl+B)" activo={activos.bold}><Bold className="size-[15px]" /></Boton>
        <Boton cmd="italic" titulo="Cursiva (Ctrl+I)" activo={activos.italic}><Italic className="size-[15px]" /></Boton>
        <Boton cmd="underline" titulo="Subrayado (Ctrl+U)" activo={activos.underline}><Underline className="size-[15px]" /></Boton>
        <Boton cmd="strikeThrough" titulo="Tachado" activo={activos.strikeThrough}><Strikethrough className="size-[15px]" /></Boton>
        <Separador />
        <Boton cmd="foreColor" valor="#dc2626" titulo="Color de texto"><Baseline className="size-[15px] text-[#dc2626]" /></Boton>
        <Boton cmd="hiliteColor" valor="#fef08a" titulo="Marcador"><Highlighter className="size-[15px] text-[#ca8a04]" /></Boton>
        <Separador />
        <Boton cmd="justifyLeft" titulo="Alinear a la izquierda" activo={activos.justifyLeft}><AlignLeft className="size-[15px]" /></Boton>
        <Boton cmd="justifyCenter" titulo="Centrar" activo={activos.justifyCenter}><AlignCenter className="size-[15px]" /></Boton>
        <Boton cmd="justifyRight" titulo="Alinear a la derecha" activo={activos.justifyRight}><AlignRight className="size-[15px]" /></Boton>
        <Boton cmd="justifyFull" titulo="Justificar" activo={activos.justifyFull}><AlignJustify className="size-[15px]" /></Boton>
        <Separador />
        <Boton cmd="insertUnorderedList" titulo="Viñetas" activo={activos.insertUnorderedList}><List className="size-[15px]" /></Boton>
        <Boton cmd="insertOrderedList" titulo="Lista numerada" activo={activos.insertOrderedList}><ListOrdered className="size-[15px]" /></Boton>
        <Boton cmd="tarea" titulo="Lista de tareas"><ListChecks className="size-[15px]" /></Boton>
        <Separador />
        <Boton cmd="formatBlock" valor="blockquote" titulo="Cita"><Quote className="size-[15px]" /></Boton>
        <Boton cmd="enlace" titulo="Enlace (Ctrl+K)"><Link2 className="size-[15px]" /></Boton>
        <Boton cmd="insertHorizontalRule" titulo="Separador"><Minus className="size-[15px]" /></Boton>
        <Separador />
        <Boton cmd="removeFormat" titulo="Limpiar formato"><RemoveFormatting className="size-[15px]" /></Boton>
      </div>

      {/* La hoja */}
      <div className="min-h-0 flex-1 overflow-auto px-5 py-5 sm:px-7">
        <div
          ref={hoja}
          className="apunte-texto mx-auto max-w-[760px] text-on-surface"
          contentEditable={puedeEscribir}
          suppressContentEditableWarning
          spellCheck
          onInput={programarGuardado}
          onChange={alCambiarCasilla}
          onKeyDown={e => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ejecutar('enlace') }
          }}
          onMouseUp={refrescarEstado}
          onKeyUp={refrescarEstado}
        />
      </div>

      {/* Pie: guardado y cuenta */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant px-4 py-2 text-[11px] text-on-surface-variant">
        <span>
          {!puedeEscribir
            ? (apunte.eliminadoEn ? 'En la papelera · restáurala para editar' : `Solo lectura · la comparte ${apunte.dueno.nombre ?? 'alguien'}`)
            : estadoGuardado === 'guardando' ? 'Guardando…'
            : estadoGuardado === 'error' ? <span className="text-[#dc2626]">No se pudo guardar. Revisa la conexión.</span>
            : <><b className="font-semibold text-[#0f7a35]">Guardado</b> · {haceCuanto(ultimoGuardado.toISOString())}{esDueno && apunte.compartidos.length === 0 && ' · solo tú ves esta nota'}{esDueno && apunte.compartidos.length > 0 && ` · la ven ${apunte.compartidos.length} persona${apunte.compartidos.length !== 1 ? 's' : ''} más`}</>}
        </span>
        <span className="tabular-nums">{palabras} palabra{palabras !== 1 ? 's' : ''}</span>
      </div>
    </>
  )
}

function Separador() { return <span className="mx-1 h-5 w-px shrink-0 bg-outline-variant" /> }

function IconoAccion({ titulo, activo, onClick, children }: { titulo: string; activo?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      className={cn(
        'grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border transition-colors',
        activo ? 'border-[#fde68a] bg-[#fffbeb] text-[#d97706]' : 'border-outline-variant bg-surface-lowest text-on-surface-variant hover:text-on-surface',
      )}
    >
      {children}
    </button>
  )
}

function Flotante({ children, onCerrar, ancho = 260 }: { children: React.ReactNode; onCerrar: () => void; ancho?: number }) {
  const caja = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) onCerrar() }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [onCerrar])
  return (
    <div ref={caja} style={{ width: ancho }} className="absolute right-0 top-[calc(100%+6px)] z-30 rounded-2xl border border-outline-variant bg-surface-lowest p-3 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.18)]">
      {children}
    </div>
  )
}

function OpcionMenu({ icono, texto, onClick, peligro }: { icono: React.ReactNode; texto: string; onClick: () => void; peligro?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-surface-low', peligro ? 'text-[#dc2626]' : 'text-on-surface')}>
      {icono}{texto}
    </button>
  )
}
