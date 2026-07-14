'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Save, Lock, Loader2 } from 'lucide-react'

interface MiAsesor { id: string; nombre: string; telefono: string; email: string }

export default function AjustesPage() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [cargado, setCargado] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getClientToken()
    return createClientFetcher(token ?? '')<T>(path, opts)
  }

  const { data } = useQuery({
    queryKey: ['mi-perfil'],
    queryFn: () => fetcher<{ data: MiAsesor }>('/asesores/me'),
  })

  const mia = data?.data
  if (mia && !cargado) {
    setNombre(mia.nombre)
    setTelefono(mia.telefono)
    setCargado(true)
  }

  const guardar = useMutation({
    mutationFn: () => fetcher(`/asesores/${mia!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombre.trim(), telefono: telefono.trim() }),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mi-perfil'] }),
    onError: (e: any) => alert(e?.message ?? 'Error al guardar'),
  })

  const cambiarPassword = useMutation({
    mutationFn: () => fetcher(`/auth/usuarios/${session!.user.id}/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }),
    onSuccess: () => { setPassword(''); setPasswordMsg('Contraseña actualizada') },
    onError: (e: any) => setPasswordMsg(e?.message ?? 'Error al cambiar contraseña'),
  })

  if (!session?.user) return null

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Ajustes" subtitle="Tu perfil y configuración general del sistema" />

      {/* ── Datos personales ── */}
      <div className="card overflow-hidden">
        <div className="p-5 space-y-4">
          <div>
            <p className="text-base font-semibold text-on-surface">Datos personales</p>
            <p className="text-xs text-on-surface-variant mt-1">Tu nombre y teléfono, visibles en tu perfil de asesor.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Nombre</label>
              <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} className="input-base" />
            </div>
            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Teléfono</label>
              <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} className="input-base" />
            </div>
          </div>
        </div>
        <div className="px-5 py-3.5 bg-surface-high border-t border-outline-variant flex justify-end">
          <button
            onClick={() => guardar.mutate()}
            disabled={!nombre.trim() || !telefono.trim() || guardar.isPending}
            className="btn-primary"
          >
            {guardar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </div>

      {/* ── Contraseña ── */}
      <div className="card overflow-hidden">
        <div className="p-5 space-y-4">
          <div>
            <p className="text-base font-semibold text-on-surface">Contraseña</p>
            <p className="text-xs text-on-surface-variant mt-1">Actualiza la contraseña de tu cuenta.</p>
          </div>
          <div className="max-w-sm">
            <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Nueva contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setPasswordMsg('') }}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              className="input-base"
            />
            {passwordMsg && <p className="text-[11px] mt-1 text-on-surface-variant">{passwordMsg}</p>}
          </div>
        </div>
        <div className="px-5 py-3.5 bg-surface-high border-t border-outline-variant flex justify-end">
          <button
            onClick={() => cambiarPassword.mutate()}
            disabled={password.length < 8 || cambiarPassword.isPending}
            className="btn-primary"
          >
            {cambiarPassword.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Cambiar contraseña
          </button>
        </div>
      </div>
    </div>
  )
}
