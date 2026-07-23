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
  const etiqueta = 'text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide block mb-1.5'
  const campo = 'w-full px-3 py-2 rounded-lg border border-outline-variant bg-transparent text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors'
  const boton = 'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed'
  const botonSecundario = 'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-on-surface border border-outline-variant hover:bg-surface-high transition-colors cursor-pointer disabled:opacity-50'

  return (
    <div className="max-w-[640px] animate-fade-in">
      <PageHeader title="Ajustes" subtitle="Tu perfil y configuración general del sistema" />

      {/* ── Foto de perfil ── */}
      <section className="py-6 border-b border-outline-variant">
        <p className="text-sm font-semibold text-on-surface mb-3">Foto de perfil</p>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-primary/10 border border-outline-variant flex-shrink-0">
            {fotoActual
              ? <img src={fotoActual} alt="Foto de perfil" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center">
                  <span className="text-base font-bold text-primary">{(nombre || '?')[0]?.toUpperCase()}</span>
                </div>
            }
          </div>
          <label className={botonSecundario}>
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
      </section>

      {/* ── Datos personales ── */}
      <section className="py-6 border-b border-outline-variant">
        <p className="text-sm font-semibold text-on-surface mb-4">Datos personales</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={etiqueta}>Nombre</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} className={campo} />
          </div>
          <div>
            <label className={etiqueta}>Teléfono</label>
            <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} className={campo} />
          </div>
        </div>
        <div className="mb-4">
          <label className={etiqueta}>Correo</label>
          <input type="email" value={cuenta?.email ?? ''} disabled className={`${campo} opacity-60 cursor-not-allowed`} />
          <p className="text-[11px] text-on-surface-variant mt-1.5 flex items-center gap-1">
            <Mail className="w-3 h-3" /> Contacta a un administrador para cambiar tu correo.
          </p>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => guardar.mutate()}
            disabled={!nombre.trim() || !telefono.trim() || guardar.isPending}
            className={boton}
          >
            {guardar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </section>

      {/* ── Contraseña ── */}
      <section className="py-6">
        <p className="text-sm font-semibold text-on-surface mb-4">Contraseña</p>
        <div className="mb-4">
          <label className={etiqueta}>Nueva contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setPasswordMsg('') }}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            className={campo}
          />
          {passwordMsg && <p className="text-[11px] mt-1.5 text-on-surface-variant">{passwordMsg}</p>}
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => cambiarPassword.mutate()}
            disabled={password.length < 8 || cambiarPassword.isPending}
            className={botonSecundario}
          >
            {cambiarPassword.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Cambiar contraseña
          </button>
        </div>
      </section>
    </div>
  )
}
