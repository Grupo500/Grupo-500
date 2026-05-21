'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Poppins } from 'next/font/google'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { PWAInstallButton } from '@/components/pwa/PWAInstallButton'

const poppins = Poppins({ subsets: ['latin'], weight: ['700'] })

export default function SignInPage() {
  const router = useRouter()
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error,     setError]     = useState('')

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { setError('Completa todos los campos'); return }
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email:    email.trim(),
      password,
      redirect: false,
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

  return (
    <div
      className="h-dvh w-full overflow-y-auto overflow-x-hidden flex flex-col items-center justify-center gap-4 px-4 py-4"
      style={{ background: '#21b9f7' }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center gap-2">
        <Image
          src="/logo-grupo500.png"
          alt="Grupo 500"
          width={120}
          height={120}
          className="rounded-full object-cover w-36 h-36 md:w-32 md:h-32 lg:w-28 lg:h-28"
          priority
        />
        <p className={`${poppins.className} text-xl md:text-lg lg:text-base font-bold tracking-tight text-on-surface mt-0.5`}>
          Grupo 500
        </p>
        <p className="text-sm md:text-xs font-medium text-on-surface-variant -mt-1">Pre-ICFES</p>
      </div>

      {/* Botón instalar PWA */}
      <PWAInstallButton />

      {/* Card de login */}
      <div className="w-full max-w-sm">
        <p className="text-[13px] font-semibold text-on-surface-variant mb-2 text-center">
          Inicia sesión con:
        </p>

        <div className="bg-white rounded-xl border border-black/[0.07] shadow-none p-5 space-y-4">

          {/* Botón Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-2.5 border border-black/[0.08] hover:bg-black/[0.03] transition-colors rounded-lg py-2.5 text-sm font-medium text-[#001d3d] disabled:opacity-60"
          >
            {googleLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <svg className="w-4 h-4" viewBox="0 0 24 24">
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
              <label className="text-xs font-medium text-[#2a4172] block mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
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
              disabled={loading || googleLoading}
              className="w-full bg-[#1a7de0] hover:bg-[#1570cc] text-white font-semibold rounded-lg py-2.5 text-sm transition-colors shadow-none disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Iniciar sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
