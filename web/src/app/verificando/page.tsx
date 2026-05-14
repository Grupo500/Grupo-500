'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { GraduationCap } from 'lucide-react'

export default function VerificandoPage() {
  const router = useRouter()
  const { getToken, isLoaded, isSignedIn } = useAuth()

  useEffect(() => {
    if (!isLoaded) return

    if (!isSignedIn) {
      router.replace('/sign-in')
      return
    }

    const verificar = async () => {
      try {
        const token = await getToken()
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token ?? ''}` },
          cache: 'no-store',
        })

        if (res.ok) {
          router.replace('/dashboard')
        } else {
          router.replace('/no-autorizado')
        }
      } catch {
        router.replace('/no-autorizado')
      }
    }

    verificar()
  }, [isLoaded, isSignedIn, getToken, router])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6"
      style={{ background: 'var(--bg)' }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <GraduationCap className="w-6 h-6 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-on-surface tracking-tight">Grupo 500</p>
          <p className="text-sm text-on-surface-variant mt-0.5">Plataforma Pre-ICFES</p>
        </div>
      </div>

      {/* Spinner */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <p className="text-sm text-on-surface-variant">Verificando acceso...</p>
      </div>
    </div>
  )
}
