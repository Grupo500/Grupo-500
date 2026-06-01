'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCOP } from '@/lib/utils'
import { BookOpen, Plus, X, Loader2, Clock, Users, Pencil, Search, CalendarDays, Power, Package } from 'lucide-react'

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
  _count?: { estudiantes: number }
}

type FormState = {
  nombre: string
  precio: string
  duracionHoras: string
  tipoCurso: 'INDIVIDUAL' | 'COMBO'
  fechaInicio: string
  fechaFin: string
}

const emptyForm: FormState = { nombre: '', precio: '', duracionHoras: '100', tipoCurso: 'INDIVIDUAL', fechaInicio: '', fechaFin: '' }

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-surface-lowest border border-outline-variant rounded-2xl shadow-float w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20'
const labelCls = 'block text-xs font-medium text-on-surface-variant mb-1'

function formatPrecio(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('es-CO', { maximumFractionDigits: 0 })
}

function PrecioInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      className={inputCls}
      inputMode="numeric"
      placeholder="800.000"
      value={formatPrecio(value)}
      onChange={e => {
        const raw = e.target.value.replace(/\./g, '').replace(/\D/g, '')
        onChange(raw)
      }}
    />
  )
}

function toDateInput(iso?: string | null) {
  if (!iso) return ''
  return iso.split('T')[0]
}

function toISO(dateStr: string) {
  if (!dateStr) return null
  return new Date(dateStr + 'T00:00:00').toISOString()
}

function fmtFecha(iso?: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function FormFields({ f, setF }: { f: FormState; setF: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Nombre del curso *</label>
        <input className={inputCls} value={f.nombre} onChange={e => setF(p => ({ ...p, nombre: e.target.value }))} placeholder="Curso Intensivo ICFES 2025" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Precio *</label>
          <PrecioInput value={f.precio} onChange={v => setF(p => ({ ...p, precio: v }))} />
        </div>
        <div>
          <label className={labelCls}>Duración (horas) *</label>
          <input className={inputCls} type="number" value={f.duracionHoras} onChange={e => setF(p => ({ ...p, duracionHoras: e.target.value }))} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Tipo de curso</label>
        <select className={inputCls} value={f.tipoCurso} onChange={e => setF(p => ({ ...p, tipoCurso: e.target.value as 'INDIVIDUAL' | 'COMBO' }))}>
          <option value="INDIVIDUAL">Individual</option>
          <option value="COMBO">Combo</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Fecha de inicio</label>
          <input className={inputCls} type="date" value={f.fechaInicio} onChange={e => setF(p => ({ ...p, fechaInicio: e.target.value }))} />
        </div>
        <div>
          <label className={labelCls}>Fecha de finalización</label>
          <input className={inputCls} type="date" value={f.fechaFin} onChange={e => setF(p => ({ ...p, fechaFin: e.target.value }))} />
        </div>
      </div>
    </div>
  )
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
  onToggle, onEdit,
}: {
  c: Curso
  isAdmin: boolean
  idx: number
  onToggle: (id: string, activo: boolean) => void
  onEdit: (c: Curso) => void
}) {
  const isCombo = c.tipoCurso === 'COMBO'

  return (
    <div
      className={`
        relative flex flex-col bg-surface-lowest border border-outline-variant
        rounded-2xl overflow-hidden group cursor-default
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

        {/* Fila: tipo + acciones admin */}
        <div className="flex items-center justify-between gap-2">
          {isCombo ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md border bg-amber-50 text-amber-600 border-amber-200/70">
              <Package className="w-2.5 h-2.5" />
              Combo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-on-surface-variant/50">
              <BookOpen className="w-2.5 h-2.5" />
            </span>
          )}

          {isAdmin && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <button
                onClick={() => onToggle(c.id, !c.activo)}
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
              <button
                onClick={() => onEdit(c)}
                title="Editar curso"
                aria-label="Editar curso"
                className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors duration-150 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
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

          {/* Horas · Estudiantes */}
          <div className="flex items-center gap-2.5 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 flex-shrink-0 opacity-70" />
              {c.duracionHoras}h
            </span>
            <span className="opacity-30 select-none">·</span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 flex-shrink-0 opacity-70" />
              {c._count?.estudiantes ?? 0}
            </span>
          </div>

          {/* Fechas */}
          {(c.fechaInicio || c.fechaFin) && (
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <CalendarDays className="w-3 h-3 flex-shrink-0 opacity-50" />
              <span className="truncate">
                {c.fechaInicio ? fmtFecha(c.fechaInicio) : '—'}
                {c.fechaFin ? ` → ${fmtFecha(c.fechaFin)}` : ''}
              </span>
            </div>
          )}

          {/* Badge deshabilitado */}
          {!c.activo && (
            <span className="inline-flex items-center text-[10px] font-semibold text-[var(--error)] bg-[var(--error)]/8 px-2 py-0.5 rounded-full">
              Deshabilitado
            </span>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function CursosPage() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'

  const [busqueda,     setBusqueda]     = useState('')
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activos' | 'inactivos'>('activos')
  const [modalCrear,   setModalCrear]   = useState(false)
  const [editCurso,    setEditCurso]    = useState<Curso | null>(null)
  const [form,         setForm]         = useState<FormState>(emptyForm)
  const [editForm,     setEditForm]     = useState<FormState>(emptyForm)

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getClientToken()
    return createClientFetcher(token ?? '')<T>(path, opts)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['cursos'],
    queryFn: () => fetcher<any>('/cursos'),
  })

  const buildPayload = (f: FormState) => ({
    nombre:        f.nombre,
    precio:        Number(f.precio),
    duracionHoras: Number(f.duracionHoras),
    tipoCurso:     f.tipoCurso,
    fechaInicio:   toISO(f.fechaInicio),
    fechaFin:      toISO(f.fechaFin),
  })

  const crearMutation = useMutation({
    mutationFn: () => fetcher('/cursos', {
      method: 'POST',
      body: JSON.stringify(buildPayload(form)),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cursos'] })
      setModalCrear(false)
      setForm(emptyForm)
    },
  })

  const editarMutation = useMutation({
    mutationFn: () => fetcher(`/cursos/${editCurso!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(editForm)),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cursos'] })
      setEditCurso(null)
    },
  })

  const toggleActivoMutation = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      fetcher(`/cursos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cursos'] }),
  })

  const abrirEditar = (c: Curso) => {
    setEditCurso(c)
    setEditForm({
      nombre:        c.nombre,
      precio:        String(c.precio),
      duracionHoras: String(c.duracionHoras),
      tipoCurso:     c.tipoCurso ?? 'INDIVIDUAL',
      fechaInicio:   toDateInput(c.fechaInicio),
      fechaFin:      toDateInput(c.fechaFin),
    })
  }

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
      <PageHeader
        title="Cursos"
        subtitle={`${cursos.length} curso${cursos.length !== 1 ? 's' : ''}`}
        actions={isAdmin ? (
          <button
            onClick={() => setModalCrear(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary/90 active:scale-[0.97] transition-all duration-150 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo curso</span>
          </button>
        ) : undefined}
      />

      {/* Barra de filtros */}
      <div className="flex flex-col sm:flex-row gap-3">

        {/* Segmented control con indicador deslizante */}
        <div className="relative flex p-1 bg-surface-high rounded-xl border border-outline-variant self-start shrink-0">
            {(['activos', 'inactivos', 'todos'] as const).map(f => (
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

        {/* Búsqueda */}
        <div className="flex gap-2 flex-1 max-w-sm">
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
            {busqueda ? `Sin resultados para "${busqueda}"` : 'No hay cursos en esta categoría'}
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
              onEdit={abrirEditar}
            />
          ))}
        </div>
      )}

      {/* Modal crear */}
      <Modal open={modalCrear} onClose={() => setModalCrear(false)}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-on-surface">Nuevo curso</h2>
            <button onClick={() => setModalCrear(false)} className="p-1.5 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer rounded-lg hover:bg-surface-high">
              <X className="w-4 h-4" />
            </button>
          </div>
          <FormFields f={form} setF={setForm} />
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setModalCrear(false)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">
              Cancelar
            </button>
            <button
              onClick={() => crearMutation.mutate()}
              disabled={crearMutation.isPending || !form.nombre || !form.precio}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary/90 active:scale-[0.97] disabled:opacity-50 transition-all duration-150 cursor-pointer"
            >
              {crearMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Crear curso
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal editar */}
      <Modal open={!!editCurso} onClose={() => setEditCurso(null)}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-on-surface">Editar curso</h2>
              <p className="text-xs text-on-surface-variant mt-0.5 truncate max-w-[260px]">{editCurso?.nombre}</p>
            </div>
            <button onClick={() => setEditCurso(null)} className="p-1.5 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer rounded-lg hover:bg-surface-high flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          <FormFields f={editForm} setF={setEditForm} />
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setEditCurso(null)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">
              Cancelar
            </button>
            <button
              onClick={() => editarMutation.mutate()}
              disabled={editarMutation.isPending || !editForm.nombre || !editForm.precio}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary/90 active:scale-[0.97] disabled:opacity-50 transition-all duration-150 cursor-pointer"
            >
              {editarMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <Pencil className="w-3.5 h-3.5" />
              Guardar cambios
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
