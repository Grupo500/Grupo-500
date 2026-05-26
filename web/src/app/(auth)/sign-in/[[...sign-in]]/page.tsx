'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Poppins } from 'next/font/google'
import { Eye, EyeOff, Loader2, ScanFace } from 'lucide-react'
import { PWAInstallButton } from '@/components/pwa/PWAInstallButton'
import {
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser'

const poppins = Poppins({ subsets: ['latin'], weight: ['700'] })

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function SignInPage() {
  const router = useRouter()
  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [showPass,      setShowPass]      = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [faceLoading,   setFaceLoading]   = useState(false)
  const [error,         setError]         = useState('')
  const [showForgot,    setShowForgot]    = useState(false)

  const [supportsWebAuthn, setSupportsWebAuthn] = useState(false)
  useEffect(() => { setSupportsWebAuthn(browserSupportsWebAuthn()) }, [])

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { setError('Completa todos los campos'); return }
    setLoading(true); setError('')

    const result = await signIn('credentials', {
      email: email.trim(), password, redirect: false,
    })
    setLoading(false)

    if (result?.error) {
      setError('Email o contraseña incorrectos')
    } else {
      router.replace('/dashboard')
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    await signIn('google', { callbackUrl: '/dashboard' })
  }

  async function handleFaceId() {
    setFaceLoading(true)
    setError('')

    try {
      // 1. Obtener opciones del servidor (discoverable: sin email)
      const startRes = await fetch(`${API}/passkeys/auth/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!startRes.ok) {
        const err = await startRes.json()
        throw new Error(err.error ?? 'Error al iniciar autenticación')
      }

      const startData = await startRes.json()
      const { userId, ...authOptions } = startData.data

      // 2. El dispositivo muestra Face ID / Huella — el usuario no escribe nada
      const credential = await startAuthentication({
        optionsJSON: {
          ...authOptions,
          challenge: authOptions.challenge as string,
          allowCredentials: (authOptions.allowCredentials ?? []).map((c: any) => ({
            ...c,
            id: String(c.id),
          })),
        },
      })

      // 3. Verificar en el servidor (userId puede ser null en flujo discoverable)
      const finishRes = await fetch(`${API}/passkeys/auth/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credential, ...(userId ? { userId } : {}) }),
      })

      if (!finishRes.ok) {
        const err = await finishRes.json()
        throw new Error(err.error ?? 'Verificación fallida')
      }

      const { data } = await finishRes.json()

      // 4. Iniciar sesión con NextAuth usando el token JWT
      const result = await signIn('credentials-passkey', {
        token: data.token,
        redirect: false,
      })

      if (result?.error) {
        throw new Error('No se pudo iniciar sesión')
      }

      router.replace('/dashboard')
    } catch (err: any) {
      // AbortError = usuario canceló el diálogo biométrico
      if (err?.name === 'AbortError' || err?.name === 'NotAllowedError') {
        setError('Autenticación cancelada')
      } else {
        setError(err?.message ?? 'Error de autenticación')
      }
    } finally {
      setFaceLoading(false)
    }
  }

  return (
    <div
      className="relative h-dvh w-full overflow-y-auto overflow-x-hidden flex flex-col items-center justify-center gap-4 px-4 py-4"
      style={{ background: '#21b9f7' }}
    >
      {/* Imagen decorativa — absoluta, detrás del contenido */}
      <Image
        src="/equipo-login.png"
        alt=""
        width={420}
        height={560}
        className="absolute bottom-[35%] md:bottom-[33%] left-1/2 -translate-x-1/2 w-72 sm:w-80 object-contain pointer-events-none select-none z-0"
        priority
        aria-hidden
      />

      {/* Contenido encima */}
      <div className="relative z-10 flex flex-col items-center gap-3 w-full max-w-sm px-4">

      {/* Espaciador */}
      <div className="h-28" />

      {/* Título */}
      <div className="text-center">
        <p className={`${poppins.className} text-xl font-bold text-white tracking-tight`}>Grupo 500</p>
        <p className="text-sm text-white/80 font-medium">Pre-ICFES</p>
      </div>

      {/* Botón instalar PWA */}
      <PWAInstallButton />

      {/* Card de login */}
      <div className="w-full">
        <p className="text-[13px] font-semibold text-white mb-2 text-center">
          Inicia sesión con:
        </p>

        <div className="bg-white rounded-xl border border-black/[0.07] shadow-none p-5 space-y-4">

          {/* Face ID / Biometría — PRIMERO */}
          {supportsWebAuthn && (
            <button
              type="button"
              onClick={handleFaceId}
              disabled={faceLoading || loading || googleLoading}
              className="w-full flex items-center justify-center gap-2 border border-[#1a7de0]/30 hover:bg-[#1a7de0]/5 transition-colors rounded-lg py-2.5 text-sm font-medium text-[#1a7de0] disabled:opacity-60"
            >
              {faceLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <ScanFace className="w-4 h-4" />
              }
              {faceLoading ? 'Verificando...' : 'Face ID / Huella digital'}
            </button>
          )}

          {/* Botón Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading || loading || faceLoading}
            className="w-full flex items-center justify-center gap-2 border border-black/[0.08] hover:bg-black/[0.03] transition-colors rounded-lg py-2.5 text-sm font-medium text-[#001d3d] disabled:opacity-60"
          >
            {googleLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
            }
            Continuar con Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-black/[0.08]" />
            <span className="text-xs text-[#5a74a8]">o</span>
            <div className="flex-1 h-px bg-black/[0.08]" />
          </div>

          {/* Formulario email/password */}
          <form onSubmit={handleCredentials} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[#2a4172] block mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="correo@ejemplo.com"
                autoComplete="email"
                required
                className="w-full border border-black/[0.10] focus:border-[#1a7de0]/50 focus:ring-1 focus:ring-[#1a7de0]/20 rounded-lg text-[13px] py-2 px-3 bg-[#f4f8ff] text-[#001d3d] outline-none transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-[#2a4172]">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-[11px] text-[#1a7de0] hover:underline font-medium cursor-pointer"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full border border-black/[0.10] focus:border-[#1a7de0]/50 focus:ring-1 focus:ring-[#1a7de0]/20 rounded-lg text-[13px] py-2 pl-3 pr-10 bg-[#f4f8ff] text-[#001d3d] outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a74a8] hover:text-[#001d3d] transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-[#c0392b] font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading || faceLoading}
              className="w-full bg-[#1a7de0] hover:bg-[#1570cc] text-white font-semibold rounded-lg py-2.5 text-sm transition-colors shadow-none disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Iniciar sesión
            </button>
          </form>

        </div>
      </div>
      </div>{/* fin contenido */}

      {/* Créditos */}
      <p className="text-[11px] text-white/60 text-center z-10 relative">
        Desarrollado por{' '}
        <span className="text-white/80 font-semibold">NexCode97</span>
      </p>

      {/* Modal — ¿Olvidaste tu contraseña? */}
      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowForgot(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1a7de0]/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#1a7de0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#001d3d]">Recuperar contraseña</p>
                <p className="text-xs text-[#5a74a8] mt-0.5">Contacta al administrador</p>
              </div>
            </div>
            <p className="text-[13px] text-[#334155] leading-relaxed">
              El acceso a esta plataforma es gestionado por el administrador del sistema. Para recuperar tu contraseña, comunícate con el equipo de <strong>Grupo 500</strong> y solicita que te asignen una nueva.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <a
                href="https://wa.me/573164134212"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#25d366] hover:bg-[#20bc5a] text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.553 4.124 1.527 5.858L0 24l6.344-1.503A11.942 11.942 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.003-1.369l-.36-.214-3.727.883.9-3.629-.235-.374A9.818 9.818 0 1112 21.818z"/>
                </svg>
                Contactar por WhatsApp
              </a>
              <button
                onClick={() => setShowForgot(false)}
                className="w-full py-2 text-sm text-[#5a74a8] hover:text-[#001d3d] transition-colors font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
