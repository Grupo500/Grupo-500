'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import Image from 'next/image'
import { Poppins } from 'next/font/google'

const poppins = Poppins({ subsets: ['latin'], weight: ['700'] })

export default function VerificandoPage() {
  const router = useRouter()
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const esNuevoRef = useRef(false)

  useEffect(() => {
    // Leer el parámetro ?nuevo=1 sin useSearchParams
    const params = new URLSearchParams(window.location.search)
    esNuevoRef.current = params.get('nuevo') === '1'
  }, [])

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
          router.replace(esNuevoRef.current ? '/no-autorizado?pendiente=1' : '/no-autorizado')
        }
      } catch {
        router.replace(esNuevoRef.current ? '/no-autorizado?pendiente=1' : '/no-autorizado')
      }
    }

    verificar()
  }, [isLoaded, isSignedIn, getToken, router])

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6" style={{ background: '#21b9f7' }}>
      <div className="flex flex-col items-center gap-3">
        <Image src="/logo-grupo500.png" alt="Grupo 500" width={90} height={90} className="rounded-full object-cover" priority />
        <p className={`${poppins.className} text-lg font-bold tracking-tight text-on-surface`}>Grupo 500</p>
        <p className="text-xs font-medium text-on-surface-variant -mt-1">Pre-ICFES</p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <p className="text-sm text-on-surface-variant">Verificando acceso...</p>
      </div>
    </div>
  )
}
