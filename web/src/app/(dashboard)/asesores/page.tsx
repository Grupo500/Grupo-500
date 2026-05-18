'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate } from '@/lib/utils'
import {
  UserCheck, Mail, Phone, Loader2, Users, TrendingUp, BookOpen,
  Search, X, Pencil, Eye, Calendar,
} from 'lucide-react'

interface Asesor {
  id: string
  nombre: string
  email: string
  telefono: string
  user: { role: string; email: string }
  createdAt: string
  _count?: { pagos: number; estudiantes: number; cursos: number }
}

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

function AsesorModal({
  asesor,
  onClose,
  fetcher,
}: {
  asesor: Asesor
  onClose: () => void
  fetcher: <T>(path: string, opts?: RequestInit) => Promise<T>
}) {
  const queryClient = useQueryClient()
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ nombre: asesor.nombre, email: asesor.email, telefono: asesor.telefono })
  const [error, setError] = useState('')

  const editarMutation = useMutation({
    mutationFn: () => fetcher(`/asesores/${asesor.id}`, {
      method: 'PATCH',
      body: JSON.stringify(form),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asesores'] })
      setEditando(false)
      setError('')
    },
    onError: (e: any) => setError(e.message ?? 'Error al guardar cambios'),
  })

  const iniciales = asesor.nombre.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() ?? '').join('')

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-base font-bold text-primary">{iniciales}</span>
          </div>
          <div>
            <h2 className="text-base font-semibold text-on-surface">{asesor.nombre}</h2>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">Asesor</span>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 text-on-surface-variant hover:text-on-surface">
          <X className="w-4 h-4" />
        </button>
      </div>

      {editando ? (
        /* ── Formulario edición ── */
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Nombre completo</label>
            <input className={inputCls} value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Correo electrónico</label>
            <input className={inputCls} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Teléfono</label>
            <input className={inputCls} value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} />
          </div>
          {error && (
            <p className="text-xs text-[var(--error)] bg-[var(--error-container)]/40 border border-[var(--error)]/20 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setEditando(false); setForm({ nombre: asesor.nombre, email: asesor.email, telefono: asesor.telefono }); setError('') }}
              className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface">
              Cancelar
            </button>
            <button
              onClick={() => editarMutation.mutate()}
              disabled={editarMutation.isPending || !form.nombre || !form.email}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {editarMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Guardar cambios
            </button>
          </div>
        </div>
      ) : (
        /* ── Vista detalle ── */
        <>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 py-2.5 border-b border-outline-variant/40">
              <Mail className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-on-surface-variant">Correo electrónico</p>
                <p className="text-sm text-on-surface truncate">{asesor.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 py-2.5 border-b border-outline-variant/40">
              <Phone className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-on-surface-variant">Teléfono</p>
                <p className="text-sm text-on-surface">{asesor.telefono}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 py-2.5 border-b border-outline-variant/40">
              <Mail className="w-4 h-4 text-on-surface-variant flex-shrink-0 opacity-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-on-surface-variant">Cuenta de acceso</p>
                <p className="text-sm text-on-surface truncate">{asesor.user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 py-2.5">
              <Calendar className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-on-surface-variant">Registrado</p>
                <p className="text-sm text-on-surface">{formatDate(asesor.createdAt)}</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { icon: Users, value: asesor._count?.estudiantes ?? 0, label: 'Estudiantes' },
              { icon: TrendingUp, value: asesor._count?.pagos ?? 0, label: 'Pagos' },
              { icon: BookOpen, value: asesor._count?.cursos ?? 0, label: 'Cursos' },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="bg-surface-high rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-on-surface">{value}</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex justify-end">
            <button
              onClick={() => setEditando(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Editar asesor
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function AsesoresPage() {
  const { getToken } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [asesorSeleccionado, setAsesorSeleccionado] = useState<Asesor | null>(null)

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getToken()
    return createClientFetcher(token)<T>(path, opts)
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['asesores'],
    queryFn: () => fetcher<any>('/asesores'),
  })

  const asesoresTodos: Asesor[] = data?.data ?? []
  const asesores = asesoresTodos.filter(a =>
    !busqueda ||
    a.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    a.email.toLowerCase().includes(busqueda.toLowerCase()) ||
    a.telefono.includes(busqueda)
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Asesores"
        subtitle={`${asesores.length} asesores registrados en el equipo`}
      />

      {/* Búsqueda */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o teléfono..."
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

      {/* Lista */}
      <div>
        <p className="text-[13px] font-semibold text-white/70 uppercase tracking-wide mb-3 px-1">
          Equipo registrado
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--error)] bg-[var(--surface-lowest)] border border-[var(--outline-variant)] rounded-xl">
            <p className="text-sm">Error al cargar asesores</p>
          </div>
        ) : asesores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant bg-[var(--surface-lowest)] border border-[var(--outline-variant)] rounded-xl">
            <UserCheck className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No hay asesores registrados</p>
            <p className="text-xs mt-1 opacity-60">Los usuarios con rol Asesor aparecen aquí</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {asesores.map(a => {
              const iniciales = a.nombre.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() ?? '').join('')
              return (
                <div
                  key={a.id}
                  className="bg-[var(--surface-lowest)] border border-[var(--outline-variant)] rounded-xl p-4 hover:border-primary/30 transition-colors flex flex-col"
                >
                  {/* Header */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-bold text-primary">{iniciales}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-on-surface truncate leading-snug">{a.nombre}</p>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-primary text-white leading-none mt-0.5">
                        Asesor
                      </span>
                    </div>
                  </div>

                  {/* Contacto */}
                  <div className="mt-3 space-y-1.5">
                    <p className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{a.email}</span>
                    </p>
                    <p className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      {a.telefono}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="mt-3 pt-3 border-t border-[var(--outline-variant)]/40 grid grid-cols-3 gap-1 text-center">
                    <div>
                      <p className="text-sm font-bold text-on-surface">{a._count?.estudiantes ?? 0}</p>
                      <p className="text-[10px] text-on-surface-variant">Est.</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">{a._count?.pagos ?? 0}</p>
                      <p className="text-[10px] text-on-surface-variant">Pagos</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">{a._count?.cursos ?? 0}</p>
                      <p className="text-[10px] text-on-surface-variant">Cursos</p>
                    </div>
                  </div>

                  {/* Acción */}
                  <button
                    onClick={() => setAsesorSeleccionado(a)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium text-primary bg-primary/8 hover:bg-primary/15 border border-primary/20 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Ver / Editar
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal detalle/edición */}
      <Modal open={!!asesorSeleccionado} onClose={() => setAsesorSeleccionado(null)}>
        {asesorSeleccionado && (
          <AsesorModal
            key={asesorSeleccionado.id}
            asesor={asesorSeleccionado}
            onClose={() => setAsesorSeleccionado(null)}
            fetcher={fetcher}
          />
        )}
      </Modal>
    </div>
  )
}
