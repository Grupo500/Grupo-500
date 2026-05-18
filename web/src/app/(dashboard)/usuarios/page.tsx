'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate, cn } from '@/lib/utils'
import { Users, Shield, UserCheck, Loader2, RefreshCw, UserPlus, Trash2, X, Pencil, Search } from 'lucide-react'

interface Asesor { id: string; nombre: string; telefono: string }
interface Usuario {
  id: string; clerkId: string; email: string
  nombre: string | null; imageUrl: string | null
  role: 'ADMIN' | 'VENDEDOR'; asesor: Asesor | null; createdAt: string
}

export default function UsuariosPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [busqueda, setBusqueda] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [formEmail, setFormEmail] = useState('')
  const [formRole, setFormRole] = useState<'VENDEDOR' | 'ADMIN'>('VENDEDOR')
  const [formError, setFormError] = useState('')

  // Modal editar asesor
  const [editAsesor, setEditAsesor] = useState<{ asesorId: string; nombre: string; telefono: string; email: string } | null>(null)
  const [editError, setEditError] = useState('')

  const fetcher = async <T,>(url: string, opts?: RequestInit): Promise<T> => {
    const token = await getToken()
    return createClientFetcher(token ?? '')(url, opts) as Promise<T>
  }

  const { data, isLoading, isError } = useQuery<{ data: Usuario[] }>({
    queryKey: ['usuarios'],
    queryFn: () => fetcher<{ data: Usuario[] }>('/auth/usuarios'),
  })

  const cambiarRol = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'ADMIN' | 'VENDEDOR' }) =>
      fetcher(`/auth/usuarios/${id}/rol`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  })

  const eliminar = useMutation({
    mutationFn: (id: string) =>
      fetcher(`/auth/usuarios/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  })

  const guardarAsesor = useMutation({
    mutationFn: () =>
      fetcher(`/asesores/${editAsesor!.asesorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: editAsesor!.nombre, telefono: editAsesor!.telefono, email: editAsesor!.email }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      setEditAsesor(null)
      setEditError('')
    },
    onError: (e: any) => setEditError(e.message ?? 'Error al guardar'),
  })

  const agregar = useMutation({
    mutationFn: () =>
      fetcher('/auth/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formEmail.trim(), role: formRole }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      setShowModal(false)
      setFormEmail('')
      setFormRole('VENDEDOR')
      setFormError('')
    },
    onError: (e: any) => setFormError(e.message ?? 'Error al agregar usuario'),
  })

  const usuariosTodos = data?.data ?? []
  const usuarios = usuariosTodos.filter(u =>
    !busqueda ||
    u.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.email.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.asesor?.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )
  const totalAdmin    = usuariosTodos.filter(u => u.role === 'ADMIN').length
  const totalVendedor = usuariosTodos.filter(u => u.role === 'VENDEDOR').length

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Usuarios"
        subtitle="Gestión de accesos y roles del sistema"
        actions={
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-2.5 py-2.5 sm:px-4 sm:py-2 bg-primary text-on-primary rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Agregar usuario</span>
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: usuarios.length, icon: Users, color: 'primary' },
          { label: 'Admins', value: totalAdmin, icon: Shield, color: 'tertiary' },
          { label: 'Asesores', value: totalVendedor, icon: UserCheck, color: 'secondary' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-3 sm:p-4 flex flex-col sm:flex-row items-center sm:items-center gap-1 sm:gap-3 text-center sm:text-left">
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-${color}/10 flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-4 h-4 text-${color}`} />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-on-surface-variant leading-tight">{label}</p>
              <p className="text-lg sm:text-xl font-bold text-on-surface tabular">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Búsqueda */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
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

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--outline-variant)] flex items-center justify-between">
          <p className="text-sm font-semibold text-on-surface">Usuarios registrados</p>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['usuarios'] })}
            className="p-1.5 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-[var(--surface-high)] transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-on-surface-variant">
            <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Cargando...</span>
          </div>
        )}
        {isError && <div className="flex items-center justify-center py-16 text-sm text-[var(--error)]">Error al cargar usuarios</div>}
        {!isLoading && usuarios.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Users className="w-8 h-8 text-on-surface-variant opacity-40" />
            <p className="text-sm text-on-surface-variant">No hay usuarios registrados</p>
          </div>
        )}

        {!isLoading && usuarios.length > 0 && (<>
          {/* Mobile: tarjetas */}
          <div className="md:hidden divide-y divide-[var(--outline-variant)]">
            {usuarios.map(u => (
              <div key={u.id} className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 border border-primary/20 flex-shrink-0">
                    {u.imageUrl
                      ? <img src={u.imageUrl} alt={u.nombre ?? u.email} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{(u.nombre ?? u.email)[0].toUpperCase()}</span>
                        </div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-on-surface truncate">{u.nombre ?? u.asesor?.nombre ?? '—'}</p>
                    <p className="text-xs text-on-surface-variant truncate">{u.email}</p>
                  </div>
                  <span className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0',
                    u.role === 'ADMIN'
                      ? 'bg-tertiary/10 text-tertiary border border-tertiary/20'
                      : 'bg-primary/10 text-primary border border-primary/20',
                  )}>
                    {u.role === 'ADMIN' ? <Shield className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                    {u.role === 'ADMIN' ? 'Admin' : 'Asesor'}
                  </span>
                </div>

                {/* Perfil asesor */}
                {u.asesor && (
                  <div className="text-xs text-on-surface-variant bg-[var(--surface-low)] rounded-lg px-3 py-2">
                    <span className="font-medium text-on-surface">{u.asesor.nombre}</span>
                    <span className="mx-1.5">·</span>
                    {u.asesor.telefono}
                  </div>
                )}

                {/* Acciones */}
                <div className="flex items-center gap-2">
                  <select
                    value={u.role}
                    disabled={cambiarRol.isPending}
                    onChange={e => cambiarRol.mutate({ id: u.id, role: e.target.value as 'ADMIN' | 'VENDEDOR' })}
                    className="flex-1 text-xs font-medium px-3 py-2 rounded-lg border bg-[var(--surface-low)] border-[var(--outline-variant)] text-on-surface focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                  >
                    <option value="VENDEDOR">Cambiar a Asesor</option>
                    <option value="ADMIN">Cambiar a Admin</option>
                  </select>
                  {u.asesor && (
                    <button
                      onClick={() => setEditAsesor({
                        asesorId: (u.asesor as any).id,
                        nombre: u.asesor!.nombre,
                        telefono: u.asesor!.telefono,
                        email: u.email,
                      })}
                      className="p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-[var(--primary-container)] transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`¿Eliminar a ${u.nombre ?? u.email}? Esta acción no se puede deshacer.`))
                        eliminar.mutate(u.id)
                    }}
                    disabled={eliminar.isPending}
                    className="p-2 rounded-lg text-on-surface-variant hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: tabla */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--outline-variant)] bg-[var(--surface-low)]">
                  {['Usuario', 'Perfil asesor', 'Registrado', 'Rol actual', 'Cambiar rol', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--outline-variant)]">
                {usuarios.map(u => (
                  <tr key={u.id} className="hover:bg-[var(--surface-low)] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/10 border border-primary/20 flex-shrink-0">
                          {u.imageUrl
                            ? <img src={u.imageUrl} alt={u.nombre ?? u.email} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center">
                                <span className="text-xs font-bold text-primary">{(u.nombre ?? u.email)[0].toUpperCase()}</span>
                              </div>
                          }
                        </div>
                        <div>
                          <p className="font-medium text-on-surface">{u.nombre ?? u.asesor?.nombre ?? '—'}</p>
                          <p className="text-xs text-on-surface-variant">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {u.asesor
                        ? <div><p className="text-on-surface">{u.asesor.nombre}</p><p className="text-xs text-on-surface-variant">{u.asesor.telefono}</p></div>
                        : <span className="text-on-surface-variant text-xs italic">Sin perfil</span>
                      }
                    </td>
                    <td className="px-5 py-3.5 text-on-surface-variant text-xs">{formatDate(u.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
                        u.role === 'ADMIN'
                          ? 'bg-tertiary/10 text-tertiary border border-tertiary/20'
                          : 'bg-primary/10 text-primary border border-primary/20',
                      )}>
                        {u.role === 'ADMIN' ? <Shield className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                        {u.role === 'ADMIN' ? 'Administrador' : 'Asesor'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={u.role}
                        disabled={cambiarRol.isPending}
                        onChange={e => cambiarRol.mutate({ id: u.id, role: e.target.value as 'ADMIN' | 'VENDEDOR' })}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border bg-[var(--surface-low)] border-[var(--outline-variant)] text-on-surface focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                      >
                        <option value="VENDEDOR">Asesor</option>
                        <option value="ADMIN">Administrador</option>
                      </select>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        {u.asesor && (
                          <button
                            onClick={() => setEditAsesor({
                              asesorId: (u.asesor as any).id,
                              nombre: u.asesor!.nombre,
                              telefono: u.asesor!.telefono,
                              email: u.email,
                            })}
                            className="p-1.5 rounded-md text-on-surface-variant hover:text-primary hover:bg-[var(--primary-container)] transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm(`¿Eliminar a ${u.nombre ?? u.email}? Esta acción no se puede deshacer.`))
                              eliminar.mutate(u.id)
                          }}
                          disabled={eliminar.isPending}
                          className="p-1.5 rounded-md text-on-surface-variant hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors disabled:opacity-40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>)}
      </div>

      {/* Nota */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/15">
        <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Los cambios de rol y eliminaciones se sincronizan inmediatamente en DB y Clerk.
          El usuario verá el nuevo rol al <strong className="text-on-surface">cerrar sesión y volver a entrar</strong>.
        </p>
      </div>

      {/* Modal editar asesor */}
      {editAsesor && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative card w-full max-w-md p-6 space-y-5 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-on-surface">Editar perfil asesor</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">Actualiza los datos del asesor</p>
              </div>
              <button onClick={() => { setEditAsesor(null); setEditError('') }}
                className="p-1.5 rounded-md text-on-surface-variant hover:bg-[var(--surface-high)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Nombre</label>
                <input
                  type="text"
                  value={editAsesor.nombre}
                  onChange={e => setEditAsesor({ ...editAsesor, nombre: e.target.value })}
                  className="input-base"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Teléfono</label>
                <input
                  type="tel"
                  value={editAsesor.telefono}
                  onChange={e => setEditAsesor({ ...editAsesor, telefono: e.target.value })}
                  placeholder="+57 300 000 0000"
                  className="input-base"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Email</label>
                <input
                  type="email"
                  value={editAsesor.email}
                  onChange={e => setEditAsesor({ ...editAsesor, email: e.target.value })}
                  className="input-base"
                />
              </div>
              {editError && <p className="text-xs text-[var(--error)]">{editError}</p>}
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => { setEditAsesor(null); setEditError('') }} className="btn-ghost">Cancelar</button>
              <button
                onClick={() => guardarAsesor.mutate()}
                disabled={!editAsesor.nombre.trim() || !editAsesor.telefono.trim() || guardarAsesor.isPending}
                className="btn-primary"
              >
                {guardarAsesor.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Modal agregar usuario */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative card w-full max-w-md p-6 space-y-5 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-on-surface">Agregar usuario</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">El usuario debe haberse registrado primero en Clerk</p>
              </div>
              <button onClick={() => { setShowModal(false); setFormError('') }}
                className="p-1.5 rounded-md text-on-surface-variant hover:bg-[var(--surface-high)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={e => { setFormEmail(e.target.value); setFormError('') }}
                  placeholder="correo@ejemplo.com"
                  className="input-base"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Rol</label>
                <select
                  value={formRole}
                  onChange={e => setFormRole(e.target.value as 'VENDEDOR' | 'ADMIN')}
                  className="input-base"
                >
                  <option value="VENDEDOR">Vendedor</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              {formError && <p className="text-xs text-[var(--error)]">{formError}</p>}
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowModal(false); setFormError('') }} className="btn-ghost">Cancelar</button>
              <button
                onClick={() => agregar.mutate()}
                disabled={!formEmail.trim() || agregar.isPending}
                className="btn-primary"
              >
                {agregar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Agregar
              </button>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  )
}
