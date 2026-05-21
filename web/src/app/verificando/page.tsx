'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { Poppins } from 'next/font/google'

const poppins = Poppins({ subsets: ['latin'], weight: ['700'] })

export default function VerificandoPage() {
  const router  = useRouter()
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') { router.replace('/sign-in'); return }
    // Autenticado → al dashboard
    router.replace('/dashboard')
  }, [status, router])

  return (
    <div className="h-dvh w-full flex flex-col items-center justify-center gap-6" style={{ background: '#21b9f7' }}>
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
