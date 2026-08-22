'use client'

/**
 * Seguridad (Hotman, 22-ago): contraseña, llaves de acceso y sesiones
 * abiertas — de verdad, no de adorno. Las llaves usan los endpoints de
 * /passkeys que ya servían para entrar; las sesiones son filas de
 * SesionActiva que el web escribe en cada carga y el API rechaza al cerrarlas.
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { startRegistration } from '@simplewebauthn/browser'
import { formatDistanceToNowStrict } from 'date-fns'
import { es } from 'date-fns/locale'
import { Lock, KeyRound, Plus, Trash2, Loader2, Monitor, Smartphone, LogOut, Check } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Tarjeta } from '@/components/ajustes/Tarjeta'

interface Llave { id: string; name: string | null; deviceType: string; createdAt: string; lastUsedAt: string | null }
interface Sesion { id: string; navegador: string | null; dispositivo: string | null; creadaEn: string; ultimaVezEn: string; actual: boolean }

const hace = (iso: string) => formatDistanceToNowStrict(new Date(iso), { locale: es, addSuffix: true })

/** Qué tan buena es la contraseña: largo y mezcla. Cuatro tramos. */
function fuerza(p: string): number {
  let n = 0
  if (p.length >= 8) n++
  if (p.length >= 12) n++
  if (/[0-9]/.test(p) && /[a-zA-Z]/.test(p)) n++
  if (/[^a-zA-Z0-9]/.test(p)) n++
  return n
}

export default function SeguridadPage() {
  const { data: sesion } = useSession()
  const queryClient = useQueryClient()

  // ── Contraseña ──
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const cambiar = useMutation({
    mutationFn: () => apiFetch(`/auth/usuarios/${sesion!.user.id}/password`, { method: 'PATCH', body: JSON.stringify({ password: nueva }) }),
    onSuccess: () => { setNueva(''); setRepetida(''); setMensaje('Contraseña actualizada. Las demás sesiones quedaron cerradas.'); queryClient.invalidateQueries({ queryKey: ['sesiones'] }) },
    onError: (e: Error) => setMensaje(e.message || 'No se pudo cambiar'),
  })
  const nivel = fuerza(nueva)
  const coinciden = nueva.length > 0 && nueva === repetida

  // ── Llaves de acceso ──
  const { data: llavesData, isLoading: cargandoLlaves } = useQuery({
    queryKey: ['passkeys'],
    queryFn: () => apiFetch<{ data: Llave[] }>('/passkeys'),
  })
  const llaves = llavesData?.data ?? []
  const [errorLlave, setErrorLlave] = useState<string | null>(null)
  const agregarLlave = useMutation({
    mutationFn: async () => {
      setErrorLlave(null)
      const { data: opciones } = await apiFetch<{ data: Parameters<typeof startRegistration>[0]['optionsJSON'] }>('/passkeys/register/start', { method: 'POST', body: '{}' })
      const respuesta = await startRegistration({ optionsJSON: opciones })
      const nombre = describirEquipo()
      await apiFetch('/passkeys/register/finish', { method: 'POST', body: JSON.stringify({ ...respuesta, name: nombre }) })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['passkeys'] }),
    onError: (e: Error) => setErrorLlave(/cancel|abort|NotAllowed/i.test(e.message) ? 'Se canceló. Si tu equipo no pidió huella ni rostro, puede que no tenga llaves de acceso disponibles.' : e.message),
  })
  const quitarLlave = useMutation({
    mutationFn: (id: string) => apiFetch(`/passkeys/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['passkeys'] }),
  })

  // ── Sesiones ──
  const { data: sesionesData, isLoading: cargandoSesiones } = useQuery({
    queryKey: ['sesiones'],
    queryFn: () => apiFetch<{ data: Sesion[] }>('/auth/sesiones'),
  })
  const sesiones = sesionesData?.data ?? []
  const cerrarUna = useMutation({
    mutationFn: (id: string) => apiFetch(`/auth/sesiones/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sesiones'] }),
  })
  const cerrarOtras = useMutation({
    mutationFn: () => apiFetch<{ data: { cerradas: number } }>('/auth/sesiones/cerrar-otras', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sesiones'] }),
  })
  const otras = sesiones.filter(s => !s.actual)

  return (
    <>
      <Tarjeta titulo="Contraseña" descripcion="Cámbiala de vez en cuando; nunca la compartas.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[11.5px] font-semibold text-on-surface">Nueva contraseña</label>
            <input type="password" value={nueva} onChange={e => { setNueva(e.target.value); setMensaje(null) }} autoComplete="new-password" placeholder="Mínimo 8 caracteres" className="input-base" />
            <div className="mt-2 flex gap-1" aria-hidden>
              {[1, 2, 3, 4].map(i => <span key={i} className={cn('h-1 flex-1 rounded-full', nivel >= i ? (nivel >= 3 ? 'bg-[#16a34a]' : 'bg-[#d97706]') : 'bg-outline-variant')} />)}
            </div>
            <p className="mt-1 text-[11px] text-on-surface-variant">
              {nueva.length === 0 ? 'Mínimo 8 caracteres; mejor 12 con números y letras.' : nivel >= 3 ? 'Buena.' : nivel === 2 ? 'Aceptable; súmale números o un signo.' : 'Corta: mínimo 8 caracteres.'}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-[11.5px] font-semibold text-on-surface">Repite la nueva</label>
            <input type="password" value={repetida} onChange={e => setRepetida(e.target.value)} autoComplete="new-password" className="input-base" />
            {repetida.length > 0 && !coinciden && <p className="mt-1 text-[11px] text-[#dc2626]">No coinciden.</p>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant pt-4">
          <span className="text-[11.5px] text-on-surface-variant">{mensaje ?? 'Al cambiarla se cierran las demás sesiones abiertas.'}</span>
          <button
            type="button"
            onClick={() => cambiar.mutate()}
            disabled={nueva.length < 8 || !coinciden || cambiar.isPending}
            className="btn-primary"
          >
            {cambiar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            Actualizar contraseña
          </button>
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="Llaves de acceso"
        descripcion="Entra con la huella o el rostro de tu equipo, sin escribir la contraseña."
        accion={
          <button type="button" onClick={() => agregarLlave.mutate()} disabled={agregarLlave.isPending} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-lowest px-3 text-[12.5px] font-semibold text-on-surface transition-colors hover:bg-surface-low disabled:opacity-50">
            {agregarLlave.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" strokeWidth={2.2} />}
            Agregar este equipo
          </button>
        }
      >
        {errorLlave && <p className="mb-3 rounded-xl bg-[#fef2f2] px-3 py-2 text-[12px] text-[#b91c1c]">{errorLlave}</p>}
        {cargandoLlaves ? (
          <div className="flex justify-center py-6 text-on-surface-variant"><Loader2 className="size-4 animate-spin" /></div>
        ) : llaves.length === 0 ? (
          <p className="rounded-xl border border-dashed border-outline-variant px-4 py-5 text-center text-[12.5px] text-on-surface-variant">
            Todavía no tienes llaves. Agrega este equipo y la próxima vez entras con la huella o el rostro.
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant">
            {llaves.map(l => (
              <li key={l.id} className="flex items-center gap-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-low text-on-surface"><KeyRound className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-on-surface">{l.name || 'Dispositivo'}</span>
                  <span className="block text-[11.5px] text-on-surface-variant">
                    Agregada {hace(l.createdAt)}{l.lastUsedAt ? ` · último uso ${hace(l.lastUsedAt)}` : ''}
                  </span>
                </span>
                <button type="button" onClick={() => { if (confirm('¿Quitar esta llave? Dejará de servir para entrar.')) quitarLlave.mutate(l.id) }} disabled={quitarLlave.isPending} className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-outline-variant px-2.5 text-[12px] text-on-surface-variant transition-colors hover:text-[#dc2626] disabled:opacity-50">
                  <Trash2 className="size-3.5" />Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <Tarjeta
        titulo="Sesiones abiertas"
        descripcion="Dónde está abierta tu cuenta ahora mismo."
        accion={
          otras.length > 0 ? (
            <button type="button" onClick={() => cerrarOtras.mutate()} disabled={cerrarOtras.isPending} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 text-[12.5px] font-semibold text-[#b91c1c] transition-colors hover:bg-[#fee2e2] disabled:opacity-50">
              {cerrarOtras.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
              Cerrar las demás
            </button>
          ) : null
        }
      >
        {cargandoSesiones ? (
          <div className="flex justify-center py-6 text-on-surface-variant"><Loader2 className="size-4 animate-spin" /></div>
        ) : (
          <ul className="divide-y divide-outline-variant">
            {sesiones.map(s => {
              const movil = /iphone|android|ipad|celular|móvil/i.test(s.dispositivo ?? '')
              return (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-low text-on-surface">{movil ? <Smartphone className="size-4" /> : <Monitor className="size-4" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-on-surface">
                      {[s.dispositivo, s.navegador].filter(Boolean).join(' · ') || 'Equipo sin identificar'}
                    </span>
                    <span className="block text-[11.5px] text-on-surface-variant">{s.actual ? 'Activa ahora' : `Última vez ${hace(s.ultimaVezEn)}`} · entró {hace(s.creadaEn)}</span>
                  </span>
                  {s.actual ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-2.5 py-1 text-[10.5px] font-bold text-[#166534]"><Check className="size-3" />esta</span>
                  ) : (
                    <button type="button" onClick={() => cerrarUna.mutate(s.id)} disabled={cerrarUna.isPending} className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-outline-variant px-2.5 text-[12px] text-on-surface-variant transition-colors hover:text-[#dc2626] disabled:opacity-50">
                      <LogOut className="size-3.5" />Cerrar
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-on-surface-variant">Una sesión cerrada deja de servir al instante en el servidor; en ese equipo la pantalla pide entrar de nuevo en la siguiente carga.</p>
      </Tarjeta>
    </>
  )
}

/** Un nombre legible para la llave, sacado del navegador: "Windows · Chrome". */
function describirEquipo(): string {
  const ua = navigator.userAgent
  const so = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Equipo'
  const nav = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : ''
  return nav ? `${so} · ${nav}` : so
}
