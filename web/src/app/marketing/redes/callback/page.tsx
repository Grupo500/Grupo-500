'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { Loader2, AlertCircle } from 'lucide-react'

// Aterrizaje del OAuth de Meta: recibe ?code=... y lo canjea en el API por las
// cuentas (páginas FB + Instagram profesionales), luego vuelve a /marketing/redes.
function CallbackInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState('')
  const canjeado = useRef(false) // el code de Meta es de un solo uso; StrictMode monta dos veces

  useEffect(() => {
    if (canjeado.current) return
    canjeado.current = true

    const code = params.get('code')
    const errorMeta = params.get('error_description') ?? params.get('error')
    if (errorMeta) { setError(errorMeta); return }
    if (!code) { setError('Meta no devolvió el código de autorización'); return }

    const redirectUri = `${window.location.origin}/marketing/redes/callback`
    apiFetch<{ data: { vinculadas: number } }>('/redes/conectar', {
      method: 'POST',
      body: JSON.stringify({ code, redirectUri }),
    })
      .then(() => router.replace('/marketing/redes'))
      .catch(e => setError(e instanceof Error ? e.message : 'No se pudieron vincular las cuentas'))
  }, [params, router])

  return (
    <div className="card flex flex-col items-center justify-center gap-3 py-16 text-center">
      {error ? (
        <>
          <AlertCircle className="w-6 h-6 text-negative" />
          <p className="text-[13px] text-on-surface max-w-md">{error}</p>
          <button onClick={() => router.replace('/marketing/redes')} className="text-[13px] font-semibold text-primary hover:underline">
            Volver a Redes
          </button>
        </>
      ) : (
        <>
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-[13px] text-on-surface-variant">Vinculando cuentas con Meta…</p>
        </>
      )}
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div className="card flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
      <CallbackInner />
    </Suspense>
  )
}
