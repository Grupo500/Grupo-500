'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate, cn } from '@/lib/utils'
import { Users, Shield, UserCheck, Loader2, RefreshCw, UserPlus, Trash2, X } from 'lucide-react'

interface Asesor { nombre: string; telefono: string }
interface Usuario {
  id: string; clerkId: string; email: string
  nombre: string | null; imageUrl: string | null
  role: 'ADMIN' | 'VENDEDOR'; asesor: Asesor | null; createdAt: string
}

export default function UsuariosPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [formEmail, setFormEmail] = useState('')
  const [formRole, setFormRole] = useState<'VENDEDOR' | 'ADMIN'>('VENDEDOR')
  const [formError, setFormError] = useState('')

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

  const usuarios = data?.data ?? []
  const totalAdmin    = usuarios.filter(u => u.role === 'ADMIN').length
  const totalVendedor = usuarios.filter(u => u.role === 'VENDEDOR').length

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Usuarios"
        subtitle="Gestión de accesos y roles del sistema"
        actions={
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <UserPlus className="w-4 h-4" />
            Agregar usuario
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total usuarios', value: usuarios.length, icon: Users, color: 'primary' },
          { label: 'Administradores', value: totalAdmin, icon: Shield, color: 'tertiary' },
          { label: 'Vendedores', value: totalVendedor, icon: UserCheck, color: 'secondary' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg bg-${color}/10 flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-4 h-4 text-${color}`} />
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">{label}</p>
              <p className="text-xl font-bold text-on-surface tabular">{value}</p>
            </div>
          </div>
        ))}
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

        {!isLoading && usuarios.length > 0 && (
          <div className="overflow-x-auto">
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

                    {/* Avatar + nombre */}
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

                    {/* Asesor */}
                    <td className="px-5 py-3.5">
                      {u.asesor
                        ? <div><p className="text-on-surface">{u.asesor.nombre}</p><p className="text-xs text-on-surface-variant">{u.asesor.telefono}</p></div>
                        : <span className="text-on-surface-variant text-xs italic">Sin perfil</span>
                      }
                    </td>

                    {/* Fecha */}
                    <td className="px-5 py-3.5 text-on-surface-variant text-xs">{formatDate(u.createdAt)}</td>

                    {/* Badge rol */}
                    <td className="px-5 py-3.5">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
                        u.role === 'ADMIN'
                          ? 'bg-tertiary/10 text-tertiary border border-tertiary/20'
                          : 'bg-primary/10 text-primary border border-primary/20',
                      )}>
                        {u.role === 'ADMIN' ? <Shield className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                        {u.role === 'ADMIN' ? 'Administrador' : 'Vendedor'}
                      </span>
                    </td>

                    {/* Selector rol */}
                    <td className="px-5 py-3.5">
                      <select
                        value={u.role}
                        disabled={cambiarRol.isPending}
                        onChange={e => cambiarRol.mutate({ id: u.id, role: e.target.value as 'ADMIN' | 'VENDEDOR' })}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border bg-[var(--surface-low)] border-[var(--outline-variant)] text-on-surface focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                      >
                        <option value="VENDEDOR">Vendedor</option>
                        <option value="ADMIN">Administrador</option>
                      </select>
                    </td>

                    {/* Eliminar */}
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar a ${u.nombre ?? u.email}? Esta acción no se puede deshacer.`))
                            eliminar.mutate(u.id)
                        }}
                        disabled={eliminar.isPending}
                        className="p-1.5 rounded-md text-on-surface-variant hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors disabled:opacity-40"
                        title="Eliminar usuario"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Nota */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/15">
        <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Los cambios de rol y eliminaciones se sincronizan inmediatamente en DB y Clerk.
          El usuario verá el nuevo rol al <strong className="text-on-surface">cerrar sesión y volver a entrar</strong>.
        </p>
      </div>

      {/* Modal agregar usuario */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--scrim)' }}>
          <div className="card w-full max-w-md p-6 space-y-5 animate-slide-up">
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
      )}
    </div>
  )
}
