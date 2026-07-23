'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Save, Lock, Loader2, Camera, Mail, User, Check } from 'lucide-react'

interface MiAsesor { id: string; nombre: string; telefono: string; email: string }
interface MiCuenta { role: string; email: string; nombre: string | null; image: string | null; telefono?: string }

function SeccionCabecera({ icon: Icon, tono, titulo, descripcion }: {
  icon: typeof Camera
  tono: 'primary' | 'secondary' | 'tertiary'
  titulo: string
  descripcion: string
}) {
  const bg = tono === 'primary' ? 'bg-primary-container text-primary'
    : tono === 'secondary' ? 'bg-secondary-container text-secondary'
    : 'bg-tertiary-container text-tertiary'
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[15px] font-semibold text-on-surface">{titulo}</p>
        <p className="text-xs text-on-surface-variant mt-0.5">{descripcion}</p>
      </div>
    </div>
  )
}

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
    <div className="space-y-5">
      <PageHeader title="Ajustes" subtitle="Tu perfil y configuración general del sistema" className="animate-slide-up" />

      {/* ── Foto de perfil ── */}
      <div className="card p-5 animate-card-enter">
        <SeccionCabecera icon={Camera} tono="primary" titulo="Foto de perfil" descripcion="Se muestra en tu menú de usuario y en el listado de asesores." />

        <label className="group inline-flex items-center gap-4 cursor-pointer rounded-xl -m-1.5 p-1.5 focus-within:ring-2 focus-within:ring-primary/30 transition-shadow">
          <div className="relative w-16 h-16 rounded-full overflow-hidden bg-primary/10 border border-primary/20 shrink-0 transition-transform duration-200 group-hover:scale-[1.04]">
            {fotoActual
              ? <img src={fotoActual} alt="Foto de perfil" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">{(nombre || '?')[0]?.toUpperCase()}</span>
                </div>
            }
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 flex items-center justify-center transition-colors duration-200">
              {subiendoFoto
                ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                : <Camera className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 scale-75 group-hover:scale-100" />
              }
            </div>
          </div>
          <span className="text-sm font-semibold text-primary group-hover:underline underline-offset-2">
            Cambiar foto
          </span>
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

      {/* ── Datos personales ── */}
      <div className="card p-5 animate-card-enter delay-1">
        <SeccionCabecera icon={User} tono="secondary" titulo="Datos personales" descripcion="Tu nombre y teléfono, visibles en tu perfil de asesor." />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mb-4">
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

        <div className="pt-4 border-t border-outline-variant flex items-center justify-end gap-3">
          {guardar.isSuccess && !guardar.isPending && (
            <span className="flex items-center gap-1 text-xs font-medium text-secondary animate-slide-up">
              <Check className="w-3.5 h-3.5" /> Guardado
            </span>
          )}
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
      <div className="card p-5 animate-card-enter delay-2">
        <SeccionCabecera icon={Lock} tono="tertiary" titulo="Contraseña" descripcion="Actualiza la contraseña de tu cuenta." />

        <div className="max-w-sm mb-4">
          <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Nueva contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setPasswordMsg('') }}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            className="input-base"
          />
          {passwordMsg && <p className="text-[11px] mt-1 text-on-surface-variant animate-slide-up">{passwordMsg}</p>}
        </div>

        <div className="pt-4 border-t border-outline-variant flex justify-end">
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
