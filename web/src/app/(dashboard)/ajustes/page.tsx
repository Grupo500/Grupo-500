'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Save, Lock, Loader2, Camera, Mail } from 'lucide-react'

interface MiAsesor { id: string; nombre: string; telefono: string; email: string }
interface MiCuenta { role: string; email: string; nombre: string | null; image: string | null; telefono?: string }

export default function AjustesPage() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [cargado, setCargado] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [fotoOverride, setFotoOverride] = useState<string | null>(null)

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getClientToken()
    return createClientFetcher(token ?? '')<T>(path, opts)
  }

  const { data } = useQuery({
    queryKey: ['mi-perfil'],
    queryFn: () => fetcher<{ data: MiAsesor }>('/asesores/me'),
  })
  const { data: cuentaData, refetch: refetchCuenta } = useQuery({
    queryKey: ['mi-cuenta'],
    queryFn: () => fetcher<{ data: MiCuenta }>('/auth/me'),
  })

  const mia = data?.data
  const cuenta = cuentaData?.data
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

  const handleSubirFoto = async (file: File) => {
    setSubiendoFoto(true)
    try {
      const token = await getClientToken()
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/imagen`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!res.ok) throw new Error('Error al subir la imagen')
      const json = await res.json()
      const url = json.data.url as string

      await fetcher(`/auth/usuarios/${session!.user.id}/foto`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: url }),
      })
      setFotoOverride(url)
      refetchCuenta()
    } catch (e: any) {
      alert(e?.message ?? 'Error al actualizar la foto')
    } finally {
      setSubiendoFoto(false)
    }
  }

  if (!session?.user) return null

  const fotoActual = fotoOverride ?? cuenta?.image ?? session.user.image ?? null

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Ajustes" subtitle="Tu perfil y configuración general del sistema" />

      {/* ── Foto de perfil ── */}
      <div className="card overflow-hidden">
        <div className="p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-primary/10 border border-primary/20 flex-shrink-0">
            {fotoActual
              ? <img src={fotoActual} alt="Foto de perfil" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">{(nombre || '?')[0]?.toUpperCase()}</span>
                </div>
            }
          </div>
          <div>
            <p className="text-base font-semibold text-on-surface">Foto de perfil</p>
            <p className="text-xs text-on-surface-variant mt-1">Se muestra en tu menú de usuario y en el listado de asesores.</p>
          </div>
        </div>
        <div className="px-5 py-3.5 bg-surface-high border-t border-outline-variant flex justify-end">
          <label className="btn-primary cursor-pointer">
            {subiendoFoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            Cambiar foto
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={subiendoFoto}
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleSubirFoto(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </div>

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
            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3 h-3" /> Correo
              </label>
              <input type="email" value={cuenta?.email ?? ''} disabled className="input-base opacity-60 cursor-not-allowed" />
              <p className="text-[11px] text-on-surface-variant mt-1">Contacta a un administrador para cambiar tu correo.</p>
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
