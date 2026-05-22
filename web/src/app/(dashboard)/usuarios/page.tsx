'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate, cn } from '@/lib/utils'
import { Users, Shield, UserCheck, Loader2, RefreshCw, UserPlus, Trash2, X, Pencil, Search, TrendingUp } from 'lucide-react'

interface Asesor {
  id: string; nombre: string; telefono: string
  _count?: { estudiantes: number; pagos: number }
}
interface Usuario {
  id: string; email: string
  nombre: string | null; image: string | null
  role: 'ADMIN' | 'VENDEDOR'; asesor: Asesor | null; createdAt: string
}

export default function UsuariosPage() {
  const queryClient = useQueryClient()
  const [busqueda, setBusqueda] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [formEmail, setFormEmail] = useState('')
  const [formNombre, setFormNombre] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formTelefono, setFormTelefono] = useState('')
  const [formRole, setFormRole] = useState<'VENDEDOR' | 'ADMIN'>('VENDEDOR')
  const [formError, setFormError] = useState('')

  // Modal editar asesor
  const [editAsesor, setEditAsesor] = useState<{ asesorId: string; userId: string; nombre: string; telefono: string; email: string } | null>(null)
  const [editPassword, setEditPassword] = useState('')
  const [editError, setEditError]   = useState('')

  const fetcher = async <T,>(url: string, opts?: RequestInit): Promise<T> => {
    const token = await getClientToken()
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
    mutationFn: async () => {
      // Actualizar datos del asesor
      await fetcher(`/asesores/${editAsesor!.asesorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: editAsesor!.nombre, telefono: editAsesor!.telefono, email: editAsesor!.email }),
      })
      // Si se ingresó contraseña temporal, actualizarla también
      if (editPassword.trim()) {
        await fetcher(`/auth/usuarios/${editAsesor!.userId}/password`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: editPassword.trim() }),
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      setEditAsesor(null)
      setEditPassword('')
      setEditError('')
    },
    onError: (e: any) => setEditError(e.message ?? 'Error al guardar'),
  })

  const agregar = useMutation({
    mutationFn: () =>
      fetcher('/auth/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:    formEmail.trim(),
          nombre:   formNombre.trim(),
          password: formPassword,
          telefono: formTelefono.trim() || undefined,
          role:     formRole,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      setShowModal(false)
      setFormEmail('')
      setFormNombre('')
      setFormPassword('')
      setFormTelefono('')
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
          { label: 'Total usuarios',  sublabel: 'Usuarios registrados', value: usuariosTodos.length, icon: Users,     accent: '#1a7de0' },
          { label: 'Administradores', sublabel: 'Con acceso total',      value: totalAdmin,            icon: Shield,    accent: '#7c3aed' },
          { label: 'Asesores',        sublabel: 'Vendedores activos',    value: totalVendedor,         icon: UserCheck, accent: '#16a34a' },
        ].map(({ label, sublabel, value, icon: Icon, accent }) => (
          <div
            key={label}
            className="relative overflow-hidden rounded-2xl p-3.5 flex flex-col gap-0"
            style={{ background: 'var(--surface-lowest)', border: '1.5px solid var(--outline-variant)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          >
            {/* Ícono + título */}
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accent}18` }}>
                <Icon className="w-4 h-4" style={{ color: accent }} />
              </div>
              <p className="text-[12px] sm:text-[13px] font-semibold text-on-surface leading-tight">{label}</p>
            </div>
            {/* Valor */}
            <p className="text-[16px] sm:text-[19px] font-bold tabular leading-tight" style={{ color: accent }}>{value}</p>
            {/* Sublabel */}
            <p className="mt-0.5 text-[10px] text-on-surface-variant/60 leading-tight hidden sm:block">{sublabel}</p>
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
          <div className="p-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {usuarios.map(u => (
              <div key={u.id} className="bg-surface-low border border-outline-variant rounded-xl p-3 md:p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors">

                {/* Avatar + nombre + badge */}
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 md:w-11 md:h-11 rounded-full overflow-hidden bg-primary/10 border border-primary/20 flex-shrink-0">
                    {u.image
                      ? <img src={u.image} alt={u.nombre ?? u.email} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center">
                          <span className="text-xs md:text-sm font-bold text-primary">{(u.nombre ?? u.email)[0].toUpperCase()}</span>
                        </div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] md:text-sm font-semibold text-on-surface truncate leading-snug">
                      {u.nombre ?? u.asesor?.nombre ?? '—'}
                    </p>
                    <span className={cn(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] md:text-[10px] font-bold mt-0.5',
                      u.role === 'ADMIN'
                        ? 'bg-tertiary text-white'
                        : 'bg-primary text-white',
                    )}>
                      {u.role === 'ADMIN' ? <Shield className="w-2.5 h-2.5" /> : <UserCheck className="w-2.5 h-2.5" />}
                      {u.role === 'ADMIN' ? 'Admin' : 'Asesor'}
                    </span>
                  </div>
                </div>

                {/* Contacto */}
                <div className="space-y-1">
                  <p className="text-[10px] md:text-xs text-on-surface-variant truncate">{u.email}</p>
                  {u.asesor && (
                    <p className="text-[10px] md:text-xs text-on-surface-variant">{u.asesor.telefono}</p>
                  )}
                </div>

                {/* Stats asesor */}
                {u.role === 'VENDEDOR' && u.asesor && (
                  <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-outline-variant/40">
                    <div className="flex items-center gap-1.5 bg-surface-high rounded-lg px-2 py-1.5">
                      <Users className="w-3 h-3 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-[12px] font-bold text-on-surface leading-none">{u.asesor._count?.estudiantes ?? 0}</p>
                        <p className="text-[9px] text-on-surface-variant">Est.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-surface-high rounded-lg px-2 py-1.5">
                      <TrendingUp className="w-3 h-3 text-[#16a34a] flex-shrink-0" />
                      <div>
                        <p className="text-[12px] font-bold text-on-surface leading-none">{u.asesor._count?.pagos ?? 0}</p>
                        <p className="text-[9px] text-on-surface-variant">Pagos</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Acciones */}
                <div className="pt-2 border-t border-outline-variant/40 flex items-center gap-1.5">
                  <select
                    value={u.role}
                    disabled={cambiarRol.isPending}
                    onChange={e => cambiarRol.mutate({ id: u.id, role: e.target.value as 'ADMIN' | 'VENDEDOR' })}
                    className="flex-1 text-[10px] md:text-xs font-medium px-2 py-1.5 rounded-lg border bg-surface-high border-outline-variant text-on-surface focus:outline-none disabled:opacity-50 cursor-pointer"
                  >
                    <option value="VENDEDOR">Asesor</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  {u.asesor && (
                    <button
                      onClick={() => { setEditAsesor({ asesorId: (u.asesor as any).id, userId: u.id, nombre: u.asesor!.nombre, telefono: u.asesor!.telefono, email: u.email }); setEditPassword('') }}
                      className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Editar asesor"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => { if (confirm(`¿Eliminar a ${u.nombre ?? u.email}?`)) eliminar.mutate(u.id) }}
                    disabled={eliminar.isPending}
                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors disabled:opacity-40"
                    title="Eliminar usuario"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

        </>)}
      </div>

      {/* Nota */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/15">
        <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Los cambios de rol se aplican inmediatamente en la base de datos.
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
              <div>
                <label className="text-xs font-medium text-on-surface-variant block mb-1.5">
                  Contraseña temporal
                  <span className="ml-1.5 text-[10px] text-on-surface-variant/60 font-normal">(dejar vacío para no cambiar)</span>
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  placeholder="Nueva contraseña..."
                  minLength={8}
                  className="input-base"
                />
                {editPassword && editPassword.length < 8 && (
                  <p className="text-[11px] text-[var(--error)] mt-1">Mínimo 8 caracteres</p>
                )}
              </div>
              {editError && <p className="text-xs text-[var(--error)]">{editError}</p>}
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => { setEditAsesor(null); setEditError('') }} className="btn-ghost">Cancelar</button>
              <button
                onClick={() => guardarAsesor.mutate()}
                disabled={!editAsesor.nombre.trim() || !editAsesor.telefono.trim() || guardarAsesor.isPending || (!!editPassword && editPassword.length < 8)}
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
                <p className="text-xs text-on-surface-variant mt-0.5">El usuario recibirá credenciales de acceso</p>
              </div>
              <button onClick={() => { setShowModal(false); setFormError('') }}
                className="p-1.5 rounded-md text-on-surface-variant hover:bg-[var(--surface-high)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Nombre completo</label>
                  <input
                    type="text"
                    value={formNombre}
                    onChange={e => { setFormNombre(e.target.value); setFormError('') }}
                    placeholder="Nombre Apellido"
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Teléfono <span className="text-on-surface-variant/50">(opcional)</span></label>
                  <input
                    type="tel"
                    value={formTelefono}
                    onChange={e => setFormTelefono(e.target.value)}
                    placeholder="+57 300 000 0000"
                    className="input-base"
                  />
                </div>
              </div>
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
                <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Contraseña temporal</label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={e => { setFormPassword(e.target.value); setFormError('') }}
                  placeholder="Mínimo 8 caracteres"
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
                  <option value="VENDEDOR">Asesor / Vendedor</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              {formError && <p className="text-xs text-[var(--error)]">{formError}</p>}
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowModal(false); setFormError('') }} className="btn-ghost">Cancelar</button>
              <button
                onClick={() => agregar.mutate()}
                disabled={!formEmail.trim() || !formNombre.trim() || formPassword.length < 8 || agregar.isPending}
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
