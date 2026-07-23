'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { registrarEstudiante } from '../acciones'

export default function RegistroBritoPage() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [documento, setDocumento] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || !email.trim() || !documento.trim()) {
      setError('Completa todos los campos')
      return
    }
    setLoading(true)
    setError('')

    const res = await registrarEstudiante({ nombre, email, documento })
    if (res.error) {
      setError(res.error)
      setLoading(false)
      return
    }

    const login = await signIn('estudiante', { email: email.trim(), documento: documento.trim(), redirect: false })
    setLoading(false)
    if (login?.error) {
      setError('Cuenta creada, pero no se pudo iniciar sesión. Intenta desde /sign-in.')
      return
    }
    router.replace('/brito/mapa')
  }

  return (
    <main
      className="min-h-dvh relative overflow-hidden flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'linear-gradient(160deg, #003060 0%, #2094ff 55%, #21b9f7 100%)' }}
    >
      <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-[#ffb703]/25 blur-3xl pointer-events-none" aria-hidden />
      <div className="absolute -bottom-28 -right-16 w-96 h-96 rounded-full bg-[#95daff]/20 blur-3xl pointer-events-none" aria-hidden />

      <Link href="/brito" className="absolute top-4 left-4 z-10 inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Volver
      </Link>

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-5">
        <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden shadow-xl">
          <Image src="/brito/brito-hero.jpg" alt="Brito" width={80} height={80} className="object-cover w-full h-full" priority />
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Crea tu cuenta</h1>
          <p className="text-sm text-white/80 mt-1">Empieza a practicar con Brito</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full bg-white rounded-2xl p-5 shadow-[0_20px_50px_-12px_rgba(0,30,60,0.5)] space-y-3">
          <div>
            <label className="text-xs font-medium text-[#2a4172] block mb-1.5">Nombre completo</label>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Tu nombre"
              className="w-full border border-black/[0.10] focus:border-[#1a7de0]/50 focus:ring-2 focus:ring-[#1a7de0]/15 rounded-xl text-[13px] py-2.5 px-3 bg-[#f4f8ff] text-[#001d3d] outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#2a4172] block mb-1.5">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="w-full border border-black/[0.10] focus:border-[#1a7de0]/50 focus:ring-2 focus:ring-[#1a7de0]/15 rounded-xl text-[13px] py-2.5 px-3 bg-[#f4f8ff] text-[#001d3d] outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#2a4172] block mb-1.5">Número de documento</label>
            <input
              value={documento}
              onChange={e => setDocumento(e.target.value)}
              placeholder="Tu documento (será tu contraseña)"
              className="w-full border border-black/[0.10] focus:border-[#1a7de0]/50 focus:ring-2 focus:ring-[#1a7de0]/15 rounded-xl text-[13px] py-2.5 px-3 bg-[#f4f8ff] text-[#001d3d] outline-none transition-all"
            />
          </div>

          {error && <p className="text-xs text-[#c0392b] font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#ffb703] to-[#fb8500] hover:brightness-105 text-white font-semibold rounded-xl py-2.5 text-sm transition-all active:scale-[0.97] shadow-[0_8px_20px_-6px_rgba(251,133,0,0.5)] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Crear cuenta y jugar
          </button>

          <p className="text-[11px] text-[#5a74a8] text-center">
            ¿Ya tienes cuenta? <Link href="/sign-in" className="text-[#1a7de0] font-medium hover:underline">Inicia sesión</Link>
          </p>
        </form>
      </div>
    </main>
  )
}
