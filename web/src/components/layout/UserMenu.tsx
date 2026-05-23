'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { LogOut, ScanFace, Loader2, Trash2, Plus, CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getClientToken } from '@/lib/api'
import {
  startRegistration,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser'

interface UserMenuProps {
  collapsed?: boolean
}

interface Passkey {
  id: string
  name: string
  deviceType: string
  createdAt: string
  lastUsedAt: string | null
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

export function UserMenu({ collapsed = false }: UserMenuProps) {
  const { data: session } = useSession()
  const [open, setOpen]         = useState(false)
  const [showModal, setShowModal] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Passkeys state
  const [passkeys, setPasskeys]       = useState<Passkey[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [regSuccess, setRegSuccess]   = useState(false)
  const [error, setError]             = useState('')
  const [supportsWebAuthn, setSupportsWebAuthn] = useState(false)

  useEffect(() => { setSupportsWebAuthn(browserSupportsWebAuthn()) }, [])

  // Cerrar dropdown al clic fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const name     = session?.user?.name  ?? session?.user?.email?.split('@')[0] ?? 'Usuario'
  const email    = session?.user?.email ?? ''
  const image    = session?.user?.image
  const initials = name.slice(0, 2).toUpperCase()

  // Cargar passkeys del usuario
  const loadPasskeys = useCallback(async () => {
    setLoadingList(true)
    setError('')
    try {
      const token = await getClientToken()
      const res = await fetch(`${API}/passkeys`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      setPasskeys(json.data ?? [])
    } catch {
      setError('No se pudieron cargar las passkeys')
    } finally {
      setLoadingList(false)
    }
  }, [])

  function openModal() {
    setOpen(false)
    setRegSuccess(false)
    setError('')
    setShowModal(true)
    loadPasskeys()
  }

  // Registrar nueva passkey
  async function handleRegister() {
    setRegistering(true)
    setError('')
    setRegSuccess(false)
    try {
      const token = await getClientToken()

      // 1. Obtener opciones del servidor
      const startRes = await fetch(`${API}/passkeys/register/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!startRes.ok) throw new Error('No se pudieron obtener las opciones de registro')
      const { data: options } = await startRes.json()

      // 2. Ejecutar registro biométrico en el dispositivo
      const credential = await startRegistration({ optionsJSON: options })

      // 3. Verificar en el servidor
      const finishRes = await fetch(`${API}/passkeys/register/finish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...credential, name: `${name} — ${new Date().toLocaleDateString('es-CO')}` }),
      })
      if (!finishRes.ok) throw new Error('El servidor rechazó el registro')

      setRegSuccess(true)
      await loadPasskeys()
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
        setError('Registro cancelado por el usuario')
      } else {
        setError(err?.message ?? 'Error al registrar')
      }
    } finally {
      setRegistering(false)
    }
  }

  // Eliminar passkey
  async function handleDelete(id: string) {
    setDeletingId(id)
    setError('')
    try {
      const token = await getClientToken()
      await fetch(`${API}/passkeys/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      await loadPasskeys()
    } catch {
      setError('No se pudo eliminar')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          title={collapsed ? name : undefined}
          className="flex items-center gap-2.5 w-full cursor-pointer focus:outline-none"
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/15 border border-primary/25 flex-shrink-0 flex items-center justify-center">
            {image
              ? <img src={image} alt={name} className="w-full h-full object-cover" />
              : <span className="text-[11px] font-bold text-primary">{initials}</span>
            }
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[12px] font-semibold text-on-surface truncate">{name}</p>
              <p className="text-[10px] text-on-surface-variant truncate max-w-full overflow-hidden">{email}</p>
            </div>
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div className={cn(
            'absolute z-50 rounded-xl shadow-float border border-[var(--outline-variant)] bg-[var(--surface-lowest)]',
            'py-1 min-w-[200px]',
            collapsed ? 'left-full bottom-0 ml-2.5' : 'bottom-full mb-2 left-0 right-0',
          )}>
            <div className="px-3 py-2 border-b border-[var(--outline-variant)]">
              <p className="text-[12px] font-semibold text-on-surface truncate">{name}</p>
              <p className="text-[10px] text-on-surface-variant truncate">{email}</p>
            </div>

            {supportsWebAuthn && (
              <button
                onClick={openModal}
                className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-on-surface-variant hover:text-on-surface hover:bg-[var(--surface-high)] transition-colors"
              >
                <ScanFace className="w-3.5 h-3.5" />
                Face ID / Huella digital
              </button>
            )}

            <button
              onClick={() => { setOpen(false); signOut({ callbackUrl: '/sign-in' }) }}
              className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-on-surface-variant hover:text-on-surface hover:bg-[var(--surface-high)] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>

      {/* Modal Face ID */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-[var(--surface-lowest)] rounded-2xl shadow-float border border-[var(--outline-variant)] w-full max-w-sm p-5 space-y-4">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ScanFace className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-on-surface">Face ID / Huella</p>
                  <p className="text-[11px] text-on-surface-variant">Acceso biométrico</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--surface-high)] text-on-surface-variant transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Éxito */}
            {regSuccess && (
              <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                <p className="text-[12px] text-green-700 dark:text-green-400 font-medium">¡Dispositivo registrado exitosamente!</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-[12px] text-red-500 font-medium bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5">
                {error}
              </p>
            )}

            {/* Botón registrar */}
            <button
              onClick={handleRegister}
              disabled={registering}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white rounded-xl py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-60"
            >
              {registering
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando...</>
                : <><Plus className="w-4 h-4" /> Registrar este dispositivo</>
              }
            </button>

            {/* Lista de passkeys */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">
                Dispositivos registrados
              </p>

              {loadingList ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-on-surface-variant" />
                </div>
              ) : passkeys.length === 0 ? (
                <p className="text-[12px] text-on-surface-variant text-center py-3">
                  Ningún dispositivo registrado aún
                </p>
              ) : (
                passkeys.map(pk => (
                  <div
                    key={pk.id}
                    className="flex items-center justify-between gap-2 bg-[var(--surface-high)] rounded-xl px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-on-surface truncate">{pk.name}</p>
                      <p className="text-[10px] text-on-surface-variant">
                        {pk.lastUsedAt
                          ? `Último uso: ${new Date(pk.lastUsedAt).toLocaleDateString('es-CO')}`
                          : `Registrado: ${new Date(pk.createdAt).toLocaleDateString('es-CO')}`
                        }
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(pk.id)}
                      disabled={!!deletingId}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-100 dark:hover:bg-red-950/40 text-on-surface-variant hover:text-red-500 transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {deletingId === pk.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                ))
              )}
            </div>

            <p className="text-[11px] text-on-surface-variant text-center leading-relaxed">
              Registra este dispositivo para iniciar sesión con Face ID o huella digital sin contraseña.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
