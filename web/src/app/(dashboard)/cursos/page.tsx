'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCOP } from '@/lib/utils'
import { BookOpen, Plus, X, Loader2, Clock, Users, Pencil, Trash2 } from 'lucide-react'

interface Curso {
  id: string
  nombre: string
  descripcion?: string
  precio: number
  duracionHoras: number
  _count?: { estudiantes: number }
}

type FormState = { nombre: string; descripcion: string; precio: string; duracionHoras: string }

const emptyForm: FormState = { nombre: '', descripcion: '', precio: '', duracionHoras: '100' }

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

// Formatea número con puntos: 600000 → "600.000"
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

function FormFields({ f, setF }: { f: FormState; setF: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Nombre del curso *</label>
        <input className={inputCls} value={f.nombre} onChange={e => setF(p => ({ ...p, nombre: e.target.value }))} placeholder="Curso Intensivo ICFES 2025" />
      </div>
      <div>
        <label className={labelCls}>Descripción</label>
        <textarea className={inputCls + ' resize-none'} rows={3} value={f.descripcion} onChange={e => setF(p => ({ ...p, descripcion: e.target.value }))} placeholder="Descripción del curso..." />
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
    </div>
  )
}

export default function CursosPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const [modalCrear, setModalCrear] = useState(false)
  const [editCurso, setEditCurso] = useState<Curso | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getToken()
    return createClientFetcher(token)<T>(path, opts)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['cursos'],
    queryFn: () => fetcher<any>('/cursos'),
  })

  const crearMutation = useMutation({
    mutationFn: () => fetcher('/cursos', {
      method: 'POST',
      body: JSON.stringify({ nombre: form.nombre, descripcion: form.descripcion, precio: Number(form.precio), duracionHoras: Number(form.duracionHoras) }),
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
      body: JSON.stringify({ nombre: editForm.nombre, descripcion: editForm.descripcion, precio: Number(editForm.precio), duracionHoras: Number(editForm.duracionHoras) }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cursos'] })
      setEditCurso(null)
    },
  })

  const eliminarMutation = useMutation({
    mutationFn: (id: string) => fetcher(`/cursos/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cursos'] }),
  })

  const abrirEditar = (c: Curso) => {
    setEditCurso(c)
    setEditForm({ nombre: c.nombre, descripcion: c.descripcion ?? '', precio: String(c.precio), duracionHoras: String(c.duracionHoras) })
  }

  const cursos: Curso[] = data?.data ?? []

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Cursos"
        subtitle={`${cursos.length} cursos disponibles`}
        actions={
          <button onClick={() => setModalCrear(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />Nuevo curso
          </button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : cursos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant bg-surface-lowest border border-outline-variant rounded-xl">
          <BookOpen className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No hay cursos creados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cursos.map(c => (
            <div key={c.id} className="bg-surface-lowest border border-outline-variant rounded-xl p-5 hover:border-primary/30 transition-colors group">
              {/* Fila superior: ícono — precio — acciones */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                <p className="text-lg font-bold text-primary flex-1">{formatCOP(c.precio)}</p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => abrirEditar(c)}
                    className="p-1.5 rounded-md text-on-surface-variant hover:text-primary hover:bg-[var(--primary-container)] transition-colors"
                    title="Editar curso"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`¿Eliminar "${c.nombre}"? Esta acción no se puede deshacer.`))
                        eliminarMutation.mutate(c.id)
                    }}
                    disabled={eliminarMutation.isPending}
                    className="p-1.5 rounded-md text-on-surface-variant hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
                    title="Eliminar curso"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-on-surface">{c.nombre}</h3>
              {c.descripcion && <p className="mt-1 text-xs text-on-surface-variant line-clamp-2">{c.descripcion}</p>}
              <div className="mt-4 pt-4 border-t border-outline-variant/40 flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                  <Clock className="w-3.5 h-3.5" />{c.duracionHoras} horas
                </span>
                <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                  <Users className="w-3.5 h-3.5" />{c._count?.estudiantes ?? 0} estudiantes
                </span>
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
