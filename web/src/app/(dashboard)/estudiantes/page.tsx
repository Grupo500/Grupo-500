'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate } from '@/lib/utils'
import {
  Users, Search, Plus, ChevronLeft, ChevronRight,
  School, Phone, Mail, Eye, X, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Estudiante {
  id: string
  nombre: string
  email: string
  telefono: string
  fechaNacimiento: string
  colegio?: { nombre: string }
  acudiente?: { nombre: string; telefono: string; relacion: string }
  asesor?: { nombre: string }
  createdAt: string
}

interface PaginatedResponse {
  data: { items: Estudiante[]; total: number; page: number; totalPages: number }
}

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-lowest border border-outline-variant rounded-xl shadow-float w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

function EstadoBadge({ valor }: { valor: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary">
      {valor}
    </span>
  )
}

export default function EstudiantesPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [busqueda, setBusqueda] = useState('')
  const [busquedaInput, setBusquedaInput] = useState('')
  const [modalCrear, setModalCrear] = useState(false)
  const [modalDetalle, setModalDetalle] = useState<Estudiante | null>(null)

  // Formulario nuevo estudiante
  const [form, setForm] = useState({
    nombre: '', email: '', telefono: '', fechaNacimiento: '',
    acudienteNombre: '', acudienteEmail: '', acudienteTelefono: '', acudienteRelacion: 'Padre',
  })

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getToken()
    return createClientFetcher(token)<T>(path, opts)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['estudiantes', page, busqueda],
    queryFn: () => fetcher<PaginatedResponse>(
      `/estudiantes?page=${page}&limit=15${busqueda ? `&nombre=${busqueda}` : ''}`
    ),
  })

  const crearMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        nombre: form.nombre,
        email: form.email,
        telefono: form.telefono,
        fechaNacimiento: form.fechaNacimiento,
      }
      if (form.acudienteNombre) {
        payload.acudiente = {
          nombre: form.acudienteNombre,
          email: form.acudienteEmail,
          telefono: form.acudienteTelefono,
          relacion: form.acudienteRelacion,
        }
      }
      return fetcher('/estudiantes', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estudiantes'] })
      setModalCrear(false)
      setForm({ nombre: '', email: '', telefono: '', fechaNacimiento: '', acudienteNombre: '', acudienteEmail: '', acudienteTelefono: '', acudienteRelacion: 'Padre' })
    },
  })

  const estudiantes = data?.data?.items ?? []
  const total = data?.data?.total ?? 0
  const totalPages = data?.data?.totalPages ?? 1

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault()
    setBusqueda(busquedaInput)
    setPage(1)
  }

  const inputCls = 'w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20'
  const labelCls = 'block text-xs font-medium text-on-surface-variant mb-1'

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Estudiantes"
        subtitle={`${total} estudiantes registrados`}
        action={
          <button
            onClick={() => setModalCrear(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo estudiante
          </button>
        }
      />

      {/* Barra de búsqueda */}
      <form onSubmit={handleBuscar} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={busquedaInput}
            onChange={e => setBusquedaInput(e.target.value)}
            className="w-full bg-surface-high border border-outline-variant rounded-lg pl-9 pr-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-surface-high border border-outline-variant rounded-lg text-sm text-on-surface hover:bg-surface-highest transition-colors">
          Buscar
        </button>
        {busqueda && (
          <button type="button" onClick={() => { setBusqueda(''); setBusquedaInput(''); setPage(1) }}
            className="px-3 py-2 text-on-surface-variant hover:text-on-surface">
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      {/* Tabla */}
      <div className="bg-surface-lowest border border-outline-variant rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : estudiantes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
            <Users className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No se encontraron estudiantes</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-low">
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Estudiante</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden md:table-cell">Colegio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">Acudiente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden xl:table-cell">Asesor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">Registrado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {estudiantes.map((e) => (
                <tr key={e.id} className="hover:bg-surface-low/40 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">{e.nombre[0]?.toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-on-surface">{e.nombre}</p>
                        <p className="text-xs text-on-surface-variant flex items-center gap-1">
                          <Mail className="w-3 h-3" />{e.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="flex items-center gap-1.5 text-sm text-on-surface-variant">
                      <School className="w-3.5 h-3.5" />
                      {e.colegio?.nombre ?? <span className="italic opacity-40">Sin colegio</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {e.acudiente ? (
                      <div>
                        <p className="text-sm text-on-surface">{e.acudiente.nombre}</p>
                        <p className="text-xs text-on-surface-variant flex items-center gap-1">
                          <Phone className="w-3 h-3" />{e.acudiente.telefono}
                        </p>
                      </div>
                    ) : <span className="text-xs text-on-surface-variant italic opacity-40">Sin acudiente</span>}
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <span className="text-sm text-on-surface-variant">{e.asesor?.nombre ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-on-surface-variant">{formatDate(e.createdAt)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setModalDetalle(e)}
                      className="p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant/40">
            <p className="text-xs text-on-surface-variant">Página {page} de {totalPages} · {total} resultados</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-high disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-high disabled:opacity-30 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal crear estudiante */}
      <Modal open={modalCrear} onClose={() => setModalCrear(false)}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-on-surface">Nuevo estudiante</h2>
            <button onClick={() => setModalCrear(false)} className="p-1.5 text-on-surface-variant hover:text-on-surface">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Datos del estudiante</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Nombre completo *</label>
                <input className={inputCls} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Juan Pérez" />
              </div>
              <div>
                <label className={labelCls}>Email *</label>
                <input className={inputCls} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="juan@email.com" />
              </div>
              <div>
                <label className={labelCls}>Teléfono *</label>
                <input className={inputCls} value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} placeholder="3001234567" />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Fecha de nacimiento *</label>
                <input className={inputCls} type="date" value={form.fechaNacimiento} onChange={e => setForm(f => ({ ...f, fechaNacimiento: e.target.value }))} />
              </div>
            </div>

            <p className="text-xs font-semibold text-primary uppercase tracking-wider pt-2">Datos del acudiente</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Nombre del acudiente</label>
                <input className={inputCls} value={form.acudienteNombre} onChange={e => setForm(f => ({ ...f, acudienteNombre: e.target.value }))} placeholder="María López" />
              </div>
              <div>
                <label className={labelCls}>Email acudiente</label>
                <input className={inputCls} type="email" value={form.acudienteEmail} onChange={e => setForm(f => ({ ...f, acudienteEmail: e.target.value }))} placeholder="maria@email.com" />
              </div>
              <div>
                <label className={labelCls}>Teléfono acudiente</label>
                <input className={inputCls} value={form.acudienteTelefono} onChange={e => setForm(f => ({ ...f, acudienteTelefono: e.target.value }))} placeholder="3009876543" />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Relación</label>
                <select className={inputCls} value={form.acudienteRelacion} onChange={e => setForm(f => ({ ...f, acudienteRelacion: e.target.value }))}>
                  <option>Padre</option>
                  <option>Madre</option>
                  <option>Tutor</option>
                  <option>Otro</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setModalCrear(false)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
              Cancelar
            </button>
            <button
              onClick={() => crearMutation.mutate()}
              disabled={crearMutation.isPending || !form.nombre || !form.email || !form.telefono}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {crearMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Crear estudiante
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal detalle */}
      <Modal open={!!modalDetalle} onClose={() => setModalDetalle(null)}>
        {modalDetalle && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{modalDetalle.nombre[0]?.toUpperCase()}</span>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-on-surface">{modalDetalle.nombre}</h2>
                  <p className="text-xs text-on-surface-variant">Registrado {formatDate(modalDetalle.createdAt)}</p>
                </div>
              </div>
              <button onClick={() => setModalDetalle(null)} className="p-1.5 text-on-surface-variant hover:text-on-surface">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <InfoField label="Email" value={modalDetalle.email} />
                <InfoField label="Teléfono" value={modalDetalle.telefono} />
                <InfoField label="Colegio" value={modalDetalle.colegio?.nombre ?? '—'} />
                <InfoField label="Asesor" value={modalDetalle.asesor?.nombre ?? '—'} />
                <InfoField label="Fecha nacimiento" value={formatDate(modalDetalle.fechaNacimiento)} />
              </div>
              {modalDetalle.acudiente && (
                <>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider pt-2">Acudiente</p>
                  <div className="grid grid-cols-2 gap-3">
                    <InfoField label="Nombre" value={modalDetalle.acudiente.nombre} />
                    <InfoField label="Relación" value={modalDetalle.acudiente.relacion} />
                    <InfoField label="Teléfono" value={modalDetalle.acudiente.telefono} />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-low rounded-lg p-3">
      <p className="text-[11px] text-on-surface-variant mb-0.5">{label}</p>
      <p className="text-sm text-on-surface font-medium">{value}</p>
    </div>
  )
}
