'use client'

/**
 * Perfil: quién eres en la plataforma. La foto y el rol arriba, los datos
 * que el resto del equipo ve debajo. El correo se muestra y no se edita: es
 * la llave con la que se entra; lo cambia un admin desde Usuarios.
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Camera, Loader2, Lock, Check, Save } from 'lucide-react'
import { apiFetch, getClientToken } from '@/lib/api'
import { ROL_LABEL } from '@/lib/roles'
import { CampoTelefono } from '@/components/ui/CampoTelefono'
import { Tarjeta } from '@/components/ajustes/Tarjeta'
import type { Financieros } from '@/components/marketing/DatosFinancieros'

interface MiCuenta {
  role: string; email: string; nombre: string | null; image: string | null
  telefono?: string
  esMarketing: boolean
  financieros: Financieros | null
}

export default function PerfilPage() {
  const { data: session, update: updateSession } = useSession()
  const queryClient = useQueryClient()
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [cargado, setCargado] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [fotoOverride, setFotoOverride] = useState<string | null>(null)

  // Todo sale de /auth/me: el nombre y el teléfono de quien sea, tenga ficha
  // de asesor o no.
  const { data: cuentaData, refetch: refetchCuenta } = useQuery({
    queryKey: ['mi-cuenta'],
    queryFn: () => apiFetch<{ data: MiCuenta }>('/auth/me'),
  })
  const cuenta = cuentaData?.data
  if (cuenta && !cargado) {
    setNombre(cuenta.nombre ?? '')
    setTelefono(cuenta.telefono ?? '')
    setCargado(true)
  }

  const guardar = useMutation({
    mutationFn: () => apiFetch('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ nombre: nombre.trim(), ...(telefono.trim() ? { telefono: telefono.trim() } : {}) }),
    }),
    onSuccess: async () => {
      // Todo el cache: el nombre sale en Usuarios, Planificador, Entregables,
      // Cobros y rankings; nombrar pantallas una por una deja alguna atrás.
      await queryClient.invalidateQueries()
      await queryClient.refetchQueries({ type: 'active' })
      await updateSession({ name: nombre.trim() })
    },
    onError: (e: Error) => alert(e.message || 'Error al guardar'),
  })

  const subirFoto = async (file: File) => {
    setSubiendoFoto(true)
    try {
      const token = await getClientToken()
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/imagen`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData })
      if (!res.ok) throw new Error('Error al subir la imagen')
      const json = await res.json()
      const url = json.data.url as string
      await apiFetch(`/auth/usuarios/${session!.user.id}/foto`, { method: 'PATCH', body: JSON.stringify({ image: url }) })
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
  const rol = (cuenta?.role ?? session.user.role) as keyof typeof ROL_LABEL
  const inicial = (nombre || cuenta?.email || '?')[0]?.toUpperCase()

  return (
    <>
      {/* Identidad: foto, nombre, rol y correo de un vistazo */}
      <section className="rounded-2xl border border-outline-variant bg-surface-lowest p-5">
        <div className="flex flex-wrap items-center gap-4">
          <label className="group relative size-[72px] shrink-0 cursor-pointer overflow-hidden rounded-full border border-outline-variant bg-primary/10 focus-within:ring-2 focus-within:ring-primary/30">
            {fotoActual
              ? <img src={fotoActual} alt="Foto de perfil" className="size-full object-cover" />
              : <span className="grid size-full place-items-center text-xl font-bold text-primary">{inicial}</span>}
            <span className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/45">
              {subiendoFoto ? <Loader2 className="size-4 animate-spin text-white" /> : <Camera className="size-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />}
            </span>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={subiendoFoto}
              onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.target.value = '' }} />
          </label>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-[18px] font-bold tracking-[-0.015em] text-on-surface">
              <span className="truncate">{nombre || 'Sin nombre'}</span>
              <span className="rounded-full bg-[#e8f3ff] px-2.5 py-0.5 text-[10.5px] font-bold text-[#0b4f9c]">{ROL_LABEL[rol] ?? rol}</span>
            </p>
            <p className="mt-0.5 text-[12.5px] text-on-surface-variant">{cuenta?.email ?? session.user.email}</p>
          </div>
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-lowest px-3 text-[12.5px] font-semibold text-on-surface transition-colors hover:bg-surface-low">
            <Camera className="size-3.5" />Cambiar foto
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={subiendoFoto}
              onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.target.value = '' }} />
          </label>
        </div>
      </section>

      <Tarjeta titulo="Datos personales" descripcion="Cómo te ve el resto del equipo dentro de la plataforma.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[11.5px] font-semibold text-on-surface">Nombre</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} className="input-base" />
          </div>
          {/* El teléfono vive en la ficha de asesor: a quien no la tiene no se
              le muestra un campo que al guardar no iría a ninguna parte. */}
          {!cuenta?.esMarketing && (
            <div>
              <label className="mb-1.5 block text-[11.5px] font-semibold text-on-surface">Teléfono</label>
              <CampoTelefono valor={telefono} onCambio={setTelefono} />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[11.5px] font-semibold text-on-surface">Correo</label>
            <div className="flex h-10 items-center gap-2 rounded-xl border border-outline-variant bg-surface-low px-3 text-[13px] text-on-surface-variant">
              <Lock className="size-3.5" />{cuenta?.email ?? session.user.email}
            </div>
            <p className="mt-1 text-[11px] text-on-surface-variant">Es con el que entras a la plataforma. Lo cambia un administrador.</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-3 border-t border-outline-variant pt-4">
          {guardar.isSuccess && !guardar.isPending && (
            <span className="flex items-center gap-1 text-[12px] font-medium text-[#0f7a35]"><Check className="size-3.5" />Guardado</span>
          )}
          <button onClick={() => guardar.mutate()} disabled={!nombre.trim() || guardar.isPending} className="btn-primary">
            {guardar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Guardar cambios
          </button>
        </div>
      </Tarjeta>
    </>
  )
}
