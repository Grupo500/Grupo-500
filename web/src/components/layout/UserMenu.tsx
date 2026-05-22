'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { LogOut, User, ScanFace, Loader2, Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  startRegistration,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser'
import { createClientFetcher, getClientToken } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface PasskeyInfo {
  id:         string
  name:       string | null
  deviceType: string
  createdAt:  string
  lastUsedAt: string | null
}

interface UserMenuProps {
  collapsed?: boolean
}

export function UserMenu({ collapsed = false }: UserMenuProps) {
  const { data: session } = useSession()
  const [open,          setOpen]          = useState(false)
  const [showPasskeys,  setShowPasskeys]  = useState(false)
  const [passkeys,      setPasskeys]      = useState<PasskeyInfo[]>([])
  const [loadingPk,     setLoadingPk]     = useState(false)
  const [registering,   setRegistering]   = useState(false)
  const [pkError,       setPkError]       = useState('')
  const [pkName,        setPkName]        = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const supportsWebAuthn = browserSupportsWebAuthn()

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const name  = session?.user?.name  ?? session?.user?.email?.split('@')[0] ?? 'Usuario'
  const email = session?.user?.email ?? ''
  const image = session?.user?.image
  const initials = name.slice(0, 2).toUpperCase()

  async function fetchPasskeys() {
    try {
      setLoadingPk(true)
      const token   = await getClientToken()
      const fetcher = createClientFetcher(token ?? '')
      const res: any = await fetcher('/passkeys')
      setPasskeys(res.data ?? [])
    } catch {
      setPasskeys([])
    } finally {
      setLoadingPk(false)
    }
  }

  async function openPasskeys() {
    setOpen(false)
    setPkError('')
    setPkName('')
    setShowPasskeys(true)
    await fetchPasskeys()
  }

  async function handleRegister() {
    setRegistering(true)
    setPkError('')
    try {
      const token = await getClientToken()

      // 1. Obtener opciones del servidor
      const startRes = await fetch(`${API}/api/passkeys/register/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
      if (!startRes.ok) throw new Error('Error al iniciar registro')
      const { data: regOptions } = await startRes.json()

      // 2. Ejecutar registro biométrico
      const credential = await startRegistration({ optionsJSON: regOptions })

      // 3. Verificar en el servidor
      const finishRes = await fetch(`${API}/api/passkeys/register/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...credential, name: pkName.trim() || undefined }),
      })
      if (!finishRes.ok) throw new Error('Verificación fallida')

      setPkName('')
      await fetchPasskeys()
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.name === 'NotAllowedError') {
        setPkError('Registro cancelado')
      } else {
        setPkError(err?.message ?? 'Error al registrar')
      }
    } finally {
      setRegistering(false)
    }
  }

  async function handleDelete(passkeyId: string) {
    try {
      const token   = await getClientToken()
      const fetcher = createClientFetcher(token ?? '')
      await fetcher(`/passkeys/${passkeyId}`, { method: 'DELETE' })
      setPasskeys(prev => prev.filter(p => p.id !== passkeyId))
    } catch {
      setPkError('Error al eliminar')
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
            'py-1 min-w-[180px]',
            collapsed ? 'left-full bottom-0 ml-2.5' : 'bottom-full mb-2 left-0 right-0',
          )}>
            <div className="px-3 py-2 border-b border-[var(--outline-variant)]">
              <p className="text-[12px] font-semibold text-on-surface truncate">{name}</p>
              <p className="text-[10px] text-on-surface-variant truncate">{email}</p>
            </div>

            {supportsWebAuthn && (
              <button
                onClick={openPasskeys}
                className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-on-surface-variant hover:text-on-surface hover:bg-[var(--surface-high)] transition-colors"
              >
                <ScanFace className="w-3.5 h-3.5" />
                Face ID / Biometría
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

      {/* Modal gestión de passkeys */}
      {showPasskeys && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPasskeys(false)} />
          <div className="relative bg-[var(--surface-lowest)] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5 border border-[var(--outline-variant)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <ScanFace className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface">Face ID / Biometría</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Gestiona tus dispositivos de acceso</p>
              </div>
            </div>

            {/* Lista de passkeys */}
            {loadingPk ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-on-surface-variant" />
              </div>
            ) : passkeys.length === 0 ? (
              <p className="text-[13px] text-on-surface-variant text-center py-4">
                No tienes dispositivos biométricos registrados
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Dispositivos registrados</p>
                {passkeys.map(pk => (
                  <div key={pk.id} className="flex items-center justify-between bg-surface-high rounded-xl px-3 py-2.5">
                    <div>
                      <p className="text-[12px] font-medium text-on-surface">{pk.name ?? 'Dispositivo'}</p>
                      <p className="text-[10px] text-on-surface-variant">
                        {new Date(pk.createdAt).toLocaleDateString('es-CO')}
                        {pk.lastUsedAt && ` · Último uso: ${new Date(pk.lastUsedAt).toLocaleDateString('es-CO')}`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(pk.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-on-surface-variant hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Registrar nuevo dispositivo */}
            <div className="space-y-2.5 pt-1">
              <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Agregar dispositivo</p>
              <input
                type="text"
                value={pkName}
                onChange={e => setPkName(e.target.value)}
                placeholder="Nombre del dispositivo (opcional)"
                className="w-full border border-[var(--outline-variant)] focus:border-primary/50 focus:ring-1 focus:ring-primary/20 rounded-lg text-[13px] py-2 px-3 bg-surface-high text-on-surface outline-none transition"
              />
              {pkError && <p className="text-xs text-red-500 font-medium">{pkError}</p>}
              <button
                onClick={handleRegister}
                disabled={registering}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors disabled:opacity-60"
              >
                {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {registering ? 'Verificando...' : 'Registrar este dispositivo'}
              </button>
            </div>

            <button
              onClick={() => setShowPasskeys(false)}
              className="w-full py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors font-medium"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
