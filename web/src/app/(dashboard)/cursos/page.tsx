'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCOP } from '@/lib/utils'
import { BookOpen, Plus, X, Loader2, Clock, Users, Pencil, Search, CalendarDays, CalendarCheck, Power, Package } from 'lucide-react'

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
        <div className="relative bg-surface-lowest border border-outline-variant rounded-xl shadow-float w-full max-w-md">
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

// Convierte "2025-03-15T00:00:00.000Z" → "2025-03-15" para input date
function toDateInput(iso?: string | null) {
  if (!iso) return ''
  return iso.split('T')[0]
}

// Convierte "2025-03-15" → "2025-03-15T00:00:00.000Z"
function toISO(dateStr: string) {
  if (!dateStr) return null
  return new Date(dateStr + 'T00:00:00').toISOString()
}

// Formatea fecha para mostrar en tarjeta: "15 mar 2025"
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
          <input
            className={inputCls}
            type="date"
            value={f.fechaInicio}
            onChange={e => setF(p => ({ ...p, fechaInicio: e.target.value }))}
          />
        </div>
        <div>
          <label className={labelCls}>Fecha de finalización</label>
          <input
            className={inputCls}
            type="date"
            value={f.fechaFin}
            onChange={e => setF(p => ({ ...p, fechaFin: e.target.value }))}
          />
        </div>
      </div>
    </div>
  )
}

// Badge de estado según fechas
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
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
  )
}

export default function CursosPage() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'

  const [busqueda, setBusqueda] = useState('')
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activos' | 'inactivos'>('activos')
  const [modalCrear, setModalCrear] = useState(false)
  const [editCurso, setEditCurso] = useState<Curso | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)

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

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Cursos"
        subtitle={`${cursos.length} cursos disponibles`}
        actions={isAdmin ? (
          <button onClick={() => setModalCrear(true)} className="flex items-center gap-2 px-2.5 py-2.5 sm:px-4 sm:py-2 bg-primary text-on-primary rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">Nuevo curso</span>
          </button>
        ) : undefined}
      />

      {/* Búsqueda + filtro */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-1 p-1 bg-surface-high rounded-xl border border-outline-variant self-start">
          {(['activos', 'inactivos', 'todos'] as const).map(f => (
            <button key={f} onClick={() => setFiltroActivo(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filtroActivo === f
                  ? 'bg-surface-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}>
              {f === 'activos' ? 'Habilitados' : f === 'inactivos' ? 'Deshabilitados' : 'Todos'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full bg-surface-high border border-outline-variant rounded-lg pl-9 pr-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
        </div>
        {busqueda && (
          <button type="button" onClick={() => setBusqueda('')} className="px-3 py-2 text-on-surface-variant hover:text-on-surface">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : cursos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant bg-surface-lowest border border-outline-variant rounded-xl">
          <BookOpen className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No hay cursos creados</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {cursos.map(c => (
            <div key={c.id} className={`bg-surface-lowest border rounded-xl p-3 sm:p-5 hover:border-primary/30 transition-colors group flex flex-col ${c.activo ? 'border-outline-variant' : 'border-outline-variant/40 opacity-60'}`}>

              {/* Fila superior: ícono — nombre — acciones */}
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${c.tipoCurso === 'COMBO' ? 'bg-secondary/10 border-secondary/20' : 'bg-primary/10 border-primary/20'}`}>
                  {c.tipoCurso === 'COMBO' ? <Package className="w-4 h-4 text-secondary" /> : <BookOpen className="w-4 h-4 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface leading-tight truncate">{c.nombre}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {c.tipoCurso === 'COMBO' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-secondary/10 text-secondary uppercase">Combo</span>
                    )}
                    {!c.activo && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--error)]/10 text-[var(--error)] uppercase">Deshabilitado</span>
                    )}
                  </div>
                </div>
                {isAdmin && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleActivoMutation.mutate({ id: c.id, activo: !c.activo })}
                    className={`p-1.5 rounded-md transition-colors ${c.activo ? 'text-secondary hover:text-[var(--error)] hover:bg-[var(--error)]/10' : 'text-on-surface-variant hover:text-secondary hover:bg-secondary/10'}`}
                    title={c.activo ? 'Deshabilitar curso' : 'Habilitar curso'}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => abrirEditar(c)}
                    className="p-1.5 rounded-md text-on-surface-variant hover:text-primary hover:bg-[var(--primary-container)] transition-colors"
                    title="Editar curso"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
                )}
              </div>

              {/* Precio + badge estado */}
              <div className="mt-2 flex items-start justify-between gap-1">
                <h3 className="text-sm font-bold text-primary leading-tight">{formatCOP(c.precio)}</h3>
                <EstadoBadge fechaInicio={c.fechaInicio} fechaFin={c.fechaFin} />
              </div>

              {/* Info */}
              <div className="mt-auto pt-4 border-t border-outline-variant/40 flex flex-col gap-1.5 mt-4">
                <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />{c.duracionHoras} horas
                </span>
                <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                  <Users className="w-3.5 h-3.5 flex-shrink-0" />{c._count?.estudiantes ?? 0} estudiantes
                </span>
                {c.fechaInicio && (
                  <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <CalendarDays className="w-3.5 h-3.5 flex-shrink-0 text-primary/60" />
                    {fmtFecha(c.fechaInicio)}
                  </span>
                )}
                {c.fechaFin && (
                  <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <CalendarCheck className="w-3.5 h-3.5 flex-shrink-0 text-secondary/70" />
                    {fmtFecha(c.fechaFin)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear */}
      <Modal open={modalCrear} onClose={() => setModalCrear(false)}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-on-surface">Nuevo curso</h2>
            <button onClick={() => setModalCrear(false)} className="p-1.5 text-on-surface-variant hover:text-on-surface"><X className="w-4 h-4" /></button>
          </div>
          <FormFields f={form} setF={setForm} />
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setModalCrear(false)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface">Cancelar</button>
            <button
              onClick={() => crearMutation.mutate()}
              disabled={crearMutation.isPending || !form.nombre || !form.precio}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {crearMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Crear curso
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal editar */}
      <Modal open={!!editCurso} onClose={() => setEditCurso(null)}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-on-surface">Editar curso</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">{editCurso?.nombre}</p>
            </div>
            <button onClick={() => setEditCurso(null)} className="p-1.5 text-on-surface-variant hover:text-on-surface"><X className="w-4 h-4" /></button>
          </div>
          <FormFields f={editForm} setF={setEditForm} />
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setEditCurso(null)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface">Cancelar</button>
            <button
              onClick={() => editarMutation.mutate()}
              disabled={editarMutation.isPending || !editForm.nombre || !editForm.precio}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
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

