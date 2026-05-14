'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate, cn } from '@/lib/utils'
import { Users, Shield, UserCheck, Loader2, RefreshCw } from 'lucide-react'

interface Asesor {
  nombre: string
  telefono: string
}

interface Usuario {
  id: string
  clerkId: string
  email: string
  nombre: string | null
  imageUrl: string | null
  role: 'ADMIN' | 'VENDEDOR'
  asesor: Asesor | null
  createdAt: string
}

export default function UsuariosPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const fetcher = async <T = unknown>(url: string, opts?: RequestInit): Promise<T> => {
    const token = await getToken()
    return createClientFetcher(token ?? '')(url, opts) as Promise<T>
  }

  const { data, isLoading, isError } = useQuery<{ data: Usuario[] }>({
    queryKey: ['usuarios'],
    queryFn: () => fetcher<{ data: Usuario[] }>('/auth/usuarios'),
  })

  const cambiarRol = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: 'ADMIN' | 'VENDEDOR' }) => {
      return fetcher(`/auth/usuarios/${id}/rol`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  })

  const usuarios = data?.data ?? []
  const totalAdmin    = usuarios.filter(u => u.role === 'ADMIN').length
  const totalVendedor = usuarios.filter(u => u.role === 'VENDEDOR').length

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Usuarios"
        subtitle="Gestión de accesos y roles del sistema"
      />

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">Total usuarios</p>
            <p className="text-xl font-bold text-on-surface tabular">{usuarios.length}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-tertiary/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-tertiary" />
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">Administradores</p>
            <p className="text-xl font-bold text-on-surface tabular">{totalAdmin}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
            <UserCheck className="w-4 h-4 text-secondary" />
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">Vendedores</p>
            <p className="text-xl font-bold text-on-surface tabular">{totalVendedor}</p>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--outline-variant)] flex items-center justify-between">
          <p className="text-sm font-semibold text-on-surface">Usuarios registrados</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['usuarios'] })}
            className="p-1.5 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-[var(--surface-high)] transition-colors"
            title="Actualizar"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-on-surface-variant">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Cargando usuarios...</span>
          </div>
        )}

        {isError && (
          <div className="flex items-center justify-center py-16 text-sm text-[var(--error)]">
            Error al cargar usuarios. Intenta de nuevo.
          </div>
        )}

        {!isLoading && !isError && usuarios.length === 0 && (
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
                  <th className="text-left px-5 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Usuario</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Perfil asesor</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Registrado</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Rol actual</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Cambiar rol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--outline-variant)]">
                {usuarios.map(u => (
                  <tr key={u.id} className="hover:bg-[var(--surface-low)] transition-colors">
                    {/* Avatar + nombre */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/10 border border-primary/20 flex-shrink-0">
                          {u.imageUrl ? (
                            <img src={u.imageUrl} alt={u.nombre ?? u.email} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-xs font-bold text-primary">
                                {(u.nombre ?? u.email)[0].toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-on-surface">{u.nombre ?? u.asesor?.nombre ?? '—'}</p>
                          <p className="text-xs text-on-surface-variant">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Asesor */}
                    <td className="px-5 py-3.5">
                      {u.asesor ? (
                        <div>
                          <p className="text-on-surface">{u.asesor.nombre}</p>
                          <p className="text-xs text-on-surface-variant">{u.asesor.telefono}</p>
                        </div>
                      ) : (
                        <span className="text-on-surface-variant text-xs italic">Sin perfil</span>
                      )}
                    </td>

                    {/* Fecha */}
                    <td className="px-5 py-3.5 text-on-surface-variant text-xs">
                      {formatDate(u.createdAt)}
                    </td>

                    {/* Badge rol */}
                    <td className="px-5 py-3.5">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
                        u.role === 'ADMIN'
                          ? 'bg-tertiary/10 text-tertiary border border-tertiary/20'
                          : 'bg-primary/10 text-primary border border-primary/20',
                      )}>
                        {u.role === 'ADMIN'
                          ? <Shield className="w-3 h-3" />
                          : <UserCheck className="w-3 h-3" />
                        }
                        {u.role === 'ADMIN' ? 'Administrador' : 'Vendedor'}
                      </span>
                    </td>

                    {/* Selector de rol */}
                    <td className="px-5 py-3.5 text-center">
                      <select
                        value={u.role}
                        disabled={cambiarRol.isPending}
                        onChange={e => cambiarRol.mutate({
                          id: u.id,
                          role: e.target.value as 'ADMIN' | 'VENDEDOR',
                        })}
                        className={cn(
                          'text-xs font-medium px-3 py-1.5 rounded-lg border cursor-pointer',
                          'bg-[var(--surface-low)] border-[var(--outline-variant)]',
                          'text-on-surface focus:outline-none focus:border-primary',
                          'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                        )}
                      >
                        <option value="VENDEDOR">Vendedor</option>
                        <option value="ADMIN">Administrador</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Nota informativa */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/15">
        <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <p className="text-xs text-on-surface-variant leading-relaxed">
          El cambio de rol aplica de forma inmediata en el sistema y en Clerk.
          El usuario verá el nuevo rol reflejado al <strong className="text-on-surface">cerrar sesión y volver a entrar</strong>.
        </p>
      </div>
    </div>
  )
}
