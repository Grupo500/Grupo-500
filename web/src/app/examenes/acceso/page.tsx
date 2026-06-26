'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2, GraduationCap } from 'lucide-react'

// Login de estudiantes de simulacros: correo + número de documento.
export default function AccesoEstudiantePage() {
  const router = useRouter()
  const [email,     setEmail]     = useState('')
  const [documento, setDocumento] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !documento) { setError('Completa todos los campos'); return }
    setLoading(true); setError('')

    const result = await signIn('estudiante', {
      email: email.trim(), documento: documento.trim(), redirect: false,
    })
    setLoading(false)

    if (result?.error) {
      setError('Correo o documento incorrectos')
    } else {
      router.replace('/inicio')
    }
  }

  return (
    <div
      className="min-h-dvh w-full flex flex-col items-center justify-center px-4 py-8"
      style={{ background: '#21b9f7' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-4">
          <p className="text-xl font-bold text-white tracking-tight">Grupo 500 · Simulacros</p>
          <p className="text-sm text-white/80 font-medium">Acceso para estudiantes</p>
        </div>

        <div className="bg-white rounded-xl border border-black/[0.07] p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#1a7de0]/10 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-5 h-5 text-[#1a7de0]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#001d3d]">Inicia tu simulacro</p>
              <p className="text-xs text-[#5a74a8]">Usa tu correo y número de documento</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[#2a4172] block mb-1.5">Correo electrónico</label>
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
              <label className="text-xs font-medium text-[#2a4172] block mb-1.5">Número de documento</label>
              <input
                type="text"
                inputMode="numeric"
                value={documento}
                onChange={e => { setDocumento(e.target.value); setError('') }}
                placeholder="Tu número de documento"
                autoComplete="off"
                required
                className="w-full border border-black/[0.10] focus:border-[#1a7de0]/50 focus:ring-1 focus:ring-[#1a7de0]/20 rounded-lg text-[13px] py-2 px-3 bg-[#f4f8ff] text-[#001d3d] outline-none transition"
              />
            </div>

            {error && <p className="text-xs text-[#c0392b] font-medium">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1a7de0] hover:bg-[#1570cc] text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Entrar
            </button>
          </form>
        </div>

        <p className="text-[11px] text-white/60 text-center mt-4">
          Desarrollado por <span className="text-white/80 font-semibold">NexCode97</span>
        </p>
      </div>
    </div>
  )
}
