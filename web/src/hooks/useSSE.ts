'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getClientToken } from '@/lib/api'

/**
 * useSSE — conecta al endpoint SSE del backend y escucha eventos en tiempo real.
 *
 * Eventos manejados:
 * - 'nuevo-estudiante' → invalida lista de estudiantes + todos los reportes del dashboard
 * - 'pago-registrado'  → invalida datos financieros y reportes (para uso futuro)
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

      // ── Nuevo estudiante via Typeform ────────────────────────────────────
      es.addEventListener('nuevo-estudiante', () => {
        // Lista de estudiantes
        queryClient.invalidateQueries({ queryKey: ['estudiantes'] })
        // Dashboard: todos los reportes financieros y estadísticas
        queryClient.invalidateQueries({ queryKey: ['financiero-periodo'] })
        queryClient.invalidateQueries({ queryKey: ['saldos-pendientes'] })
        queryClient.invalidateQueries({ queryKey: ['proximos-cobros'] })
        queryClient.invalidateQueries({ queryKey: ['cursos-vendidos'] })
        queryClient.invalidateQueries({ queryKey: ['ranking-asesores'] })
        queryClient.invalidateQueries({ queryKey: ['reportes-marketing'] })
      })

      // ── Pago registrado (para uso futuro en backend) ─────────────────────
      es.addEventListener('pago-registrado', () => {
        queryClient.invalidateQueries({ queryKey: ['financiero-periodo'] })
        queryClient.invalidateQueries({ queryKey: ['saldos-pendientes'] })
        queryClient.invalidateQueries({ queryKey: ['proximos-cobros'] })
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
