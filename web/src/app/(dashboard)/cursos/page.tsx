'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCOP } from '@/lib/utils'
import { BookOpen, Clock, Users, Search, CalendarDays, Power, Package, X, Pencil, Loader2 } from 'lucide-react'

interface Curso {
  id: string
  nombre: string
  descripcion?: string
  precio: number
  duracionHoras: number
  activo: boolean
  tipoCurso: 'INDIVIDUAL' | 'COMBO'
  fechaInicio?: string | null
  fechaFin?: string | null
  hotmartProductId?: string | null
  _count?: { estudiantes: number }
}

function toDateInput(iso?: string | null) {
  if (!iso) return ''
  return iso.split('T')[0]
}

function fmtFecha(iso?: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function EstadoBadge({ fechaInicio, fechaFin }: { fechaInicio?: string | null; fechaFin?: string | null }) {
  if (!fechaInicio && !fechaFin) return null
  const ahora = new Date()
  const inicio = fechaInicio ? new Date(fechaInicio) : null
  const fin    = fechaFin    ? new Date(fechaFin)    : null

  let label = ''
  let cls   = ''

  if (fin && ahora > fin) {
    label = 'Finalizado'; cls = 'bg-[var(--error)]/10 text-[var(--error)]'
  } else if (inicio && ahora < inicio) {
    label = 'Próximo'; cls = 'bg-primary/10 text-primary'
  } else {
    label = 'En curso'; cls = 'bg-secondary/10 text-secondary'
  }

  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>{label}</span>
  )
}

// ── Tarjeta de curso ──────────────────────────────────────────────────────────
function CursoCard({
  c, isAdmin, idx,
  onToggle, onEditarFechas,
}: {
  c: Curso
  isAdmin: boolean
  idx: number
  onToggle: (id: string, activo: boolean) => void
  onEditarFechas: (c: Curso) => void
}) {
  const isCombo = c.tipoCurso === 'COMBO'

  return (
    <Link
      href={`/cursos/${c.id}`}
      className={`
        relative flex flex-col bg-surface-lowest border border-outline-variant
        rounded-2xl overflow-hidden group cursor-pointer
        transition-[transform,box-shadow,border-color] duration-200
        hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)]
        ${isCombo ? 'hover:border-amber-300/60' : 'hover:border-primary/30'}
        ${!c.activo ? '[filter:grayscale(0.6)] opacity-55' : ''}
      `}
      style={{ animation: `cardEnter 0.35s cubic-bezier(0.23,1,0.32,1) ${idx * 55}ms both` }}
    >
      {/* Acento superior */}
      <div className={`h-[3px] w-full flex-shrink-0 ${isCombo ? 'bg-amber-400' : 'bg-primary'}`} />

      <div className="flex flex-col gap-3 p-4 flex-1">

        {/* Fila: tipo + acción toggle */}
        <div className="flex items-center justify-between gap-2">
          {isCombo ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md border bg-amber-50 text-amber-600 border-amber-200/70">
              <Package className="w-2.5 h-2.5" />
              Combo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md border bg-primary/8 text-primary border-primary/15">
              <BookOpen className="w-2.5 h-2.5" />
              Individual
            </span>
          )}

          {isAdmin && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEditarFechas(c) }}
                title="Editar fechas de inicio/fin"
                aria-label="Editar fechas de inicio/fin"
                className="p-1.5 rounded-lg transition-colors duration-150 cursor-pointer text-on-surface-variant hover:text-primary hover:bg-primary/10"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(c.id, !c.activo) }}
                title={c.activo ? 'Deshabilitar curso' : 'Habilitar curso'}
                aria-label={c.activo ? 'Deshabilitar curso' : 'Habilitar curso'}
                className={`p-1.5 rounded-lg transition-colors duration-150 cursor-pointer ${
                  c.activo
                    ? 'text-on-surface-variant hover:text-[var(--error)] hover:bg-[var(--error)]/10'
                    : 'text-on-surface-variant hover:text-secondary hover:bg-secondary/10'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Nombre */}
        <p className="text-sm font-semibold text-on-surface leading-snug line-clamp-2 min-h-[2.5rem]">
          {c.nombre}
        </p>

        {/* Precio + estado */}
        <div className="flex items-end justify-between gap-2">
          <span className={`text-xl font-bold tabular-nums leading-none ${
            isCombo ? 'text-amber-500' : 'text-primary'
          } ${!c.activo ? 'line-through decoration-2 opacity-60' : ''}`}>
            {formatCOP(c.precio)}
          </span>
          <EstadoBadge fechaInicio={c.fechaInicio} fechaFin={c.fechaFin} />
        </div>

        {/* Separador + stats */}
        <div className="mt-auto pt-3 border-t border-outline-variant/40 space-y-1.5">

          <div className="flex items-center gap-2.5 text-xs text-on-surface-variant">
            {c.duracionHoras > 0 && (
              <>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 flex-shrink-0 opacity-70" />
                  {c.duracionHoras}h
                </span>
                <span className="opacity-30 select-none">·</span>
              </>
            )}
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 flex-shrink-0 opacity-70" />
              {c._count?.estudiantes ?? 0}
            </span>
          </div>

          {(c.fechaInicio || c.fechaFin) && (
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <CalendarDays className="w-3 h-3 flex-shrink-0 opacity-50" />
              <span className="truncate">
                {c.fechaInicio ? fmtFecha(c.fechaInicio) : '—'}
                {c.fechaFin ? ` → ${fmtFecha(c.fechaFin)}` : ''}
              </span>
            </div>
          )}

          {!c.activo && (
            <span className="inline-flex items-center text-[10px] font-semibold text-[var(--error)] bg-[var(--error)]/8 px-2 py-0.5 rounded-full">
              Deshabilitado
            </span>
          )}

        </div>
      </div>
    </Link>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function CursosPage() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'

  const [busqueda,     setBusqueda]     = useState('')
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activos' | 'inactivos'>('todos')

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getClientToken()
    return createClientFetcher(token ?? '')<T>(path, opts)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['cursos'],
    queryFn: () => fetcher<any>('/cursos'),
  })

  const toggleActivoMutation = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      fetcher(`/cursos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cursos'] }),
    onError: (e: Error) => alert(e.message || 'Error al cambiar el estado del curso'),
  })

  const [msgSync, setMsgSync] = useState<string | null>(null)
  const sincronizarMutation = useMutation({
    mutationFn: () => fetcher<any>('/hotmart/sincronizar', { method: 'POST' }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['cursos'] })
      const act = res?.data?.actualizados ?? 0
      const cre = res?.data?.creados ?? 0
      setMsgSync(
        act > 0 || cre > 0
          ? `${act} nombre${act !== 1 ? 's' : ''} actualizado${act !== 1 ? 's' : ''}${cre > 0 ? ` · ${cre} curso${cre !== 1 ? 's' : ''} nuevo${cre !== 1 ? 's' : ''}` : ''}`
          : 'Todo al día con Hotmart'
      )
      setTimeout(() => setMsgSync(null), 5000)
    },
    onError: (e: Error) => alert(`Error al sincronizar con Hotmart: ${e.message}`),
  })

  // ── Editar fechas de inicio/fin ──────────────────────────────────────────
  const [editandoCurso, setEditandoCurso] = useState<Curso | null>(null)
  const [fechaInicioForm, setFechaInicioForm] = useState('')
  const [fechaFinForm, setFechaFinForm] = useState('')

  function abrirEditarFechas(c: Curso) {
    setEditandoCurso(c)
    setFechaInicioForm(toDateInput(c.fechaInicio))
    setFechaFinForm(toDateInput(c.fechaFin))
  }

  const editarFechasMutation = useMutation({
    mutationFn: () => fetcher(`/cursos/${editandoCurso!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fechaInicio: fechaInicioForm ? new Date(fechaInicioForm + 'T00:00:00').toISOString() : null,
        fechaFin:    fechaFinForm    ? new Date(fechaFinForm    + 'T00:00:00').toISOString() : null,
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cursos'] })
      setEditandoCurso(null)
    },
    onError: (e: Error) => alert(e.message || 'Error al guardar las fechas'),
  })

  // Sincronización automática al montar la página (solo admin)
  useEffect(() => {
    if (isAdmin) sincronizarMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  const cursosTodos: Curso[] = data?.data ?? []
  const cursos = cursosTodos.filter(c => {
    if (filtroActivo === 'activos'   && !c.activo) return false
    if (filtroActivo === 'inactivos' &&  c.activo) return false
    if (busqueda && !c.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  const counts = {
    activos:   cursosTodos.filter(c =>  c.activo).length,
    inactivos: cursosTodos.filter(c => !c.activo).length,
    todos:     cursosTodos.length,
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Cursos"
          subtitle={
            sincronizarMutation.isPending
              ? 'Actualizando desde Hotmart...'
              : msgSync ?? `${cursos.length} curso${cursos.length !== 1 ? 's' : ''}`
          }
        />
      </div>

      {/* Barra de filtros — búsqueda arriba, tabs abajo */}
      <div className="flex flex-col gap-3">

        <div className="flex gap-2 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full bg-surface-high border border-outline-variant rounded-xl pl-9 pr-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
            />
          </div>
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              className="px-2.5 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="relative flex p-1 bg-surface-high rounded-xl border border-outline-variant self-start shrink-0">
          {(['todos', 'activos', 'inactivos'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltroActivo(f)}
              className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                filtroActivo === f
                  ? 'bg-surface-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {f === 'activos' ? 'Habilitados' : f === 'inactivos' ? 'Deshabilitados' : 'Todos'}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-colors duration-150 shrink-0 ${
                filtroActivo === f ? 'bg-primary/15 text-primary' : 'bg-outline-variant/20 text-on-surface-variant'
              }`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-52 rounded-2xl bg-surface-high animate-pulse"
              style={{ animationDelay: `${i * 40}ms` }}
            />
          ))}
        </div>
      ) : cursos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant bg-surface-lowest border border-outline-variant rounded-2xl">
          <BookOpen className="w-10 h-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">
            {busqueda
              ? `Sin resultados para "${busqueda}"`
              : isAdmin
                ? 'Sin cursos — usa "Actualizar nombres" para importarlos'
                : 'No hay cursos en esta categoría'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {cursos.map((c, idx) => (
            <CursoCard
              key={c.id}
              c={c}
              isAdmin={isAdmin}
              idx={idx}
              onToggle={(id, activo) => toggleActivoMutation.mutate({ id, activo })}
              onEditarFechas={abrirEditarFechas}
            />
          ))}
        </div>
      )}

      {/* ── Modal: editar fechas de inicio/fin ── */}
      {editandoCurso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !editarFechasMutation.isPending && setEditandoCurso(null)}
          />
          <div className="relative w-full max-w-sm bg-surface-lowest border border-outline-variant rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-on-surface">Fechas del curso</p>
              <button
                onClick={() => setEditandoCurso(null)}
                className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-high"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-on-surface-variant line-clamp-2">{editandoCurso.nombre}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Fecha de inicio</label>
                <input
                  type="date"
                  value={fechaInicioForm}
                  onChange={e => setFechaInicioForm(e.target.value)}
                  className="w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Fecha de finalización</label>
                <input
                  type="date"
                  value={fechaFinForm}
                  onChange={e => setFechaFinForm(e.target.value)}
                  className="w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setEditandoCurso(null)}
                disabled={editarFechasMutation.isPending}
                className="px-3 py-2 text-xs font-medium text-on-surface-variant hover:text-on-surface disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => editarFechasMutation.mutate()}
                disabled={editarFechasMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
              >
                {editarFechasMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
