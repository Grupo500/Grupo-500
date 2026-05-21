'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getClientToken } from '@/lib/api'

/**
 * useSSE — conecta al endpoint SSE del backend y escucha eventos en tiempo real.
 * Cuando llega un evento 'nuevo-estudiante', invalida la query de estudiantes
 * para que la lista se actualice automáticamente.
 */
export function useSSE() {
  const queryClient = useQueryClient()

  useEffect(() => {
    let es: EventSource | null = null
    let retryTimeout: ReturnType<typeof setTimeout>
    let active = true

    async function conectar() {
      const token = await getClientToken()
      if (!token || !active) return

      const url = `${process.env.NEXT_PUBLIC_API_URL}/eventos?token=${encodeURIComponent(token)}`
      es = new EventSource(url)

      es.addEventListener('nuevo-estudiante', () => {
        // Invalida la lista de estudiantes → se refresca automáticamente
        queryClient.invalidateQueries({ queryKey: ['estudiantes'] })
      })

      es.onerror = () => {
        es?.close()
        if (active) {
          // Reconexión automática en 5 segundos si falla
          retryTimeout = setTimeout(conectar, 5_000)
        }
      }
    }

    conectar()

    return () => {
      active = false
      clearTimeout(retryTimeout)
      es?.close()
    }
  }, [queryClient])
}
