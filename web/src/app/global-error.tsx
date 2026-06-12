'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error)
    }
  }, [error])

  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-surface-lowest">
        <div className="text-center space-y-4 p-8">
          <h2 className="text-lg font-semibold text-on-surface">Ocurrió un error inesperado</h2>
          <p className="text-sm text-on-surface-variant">El equipo ha sido notificado automáticamente.</p>
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}
