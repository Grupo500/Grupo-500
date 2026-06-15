'use client'

import { useEffect, startTransition } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getClientToken } from '@/lib/api'

/**
 * useSSE — conecta al endpoint SSE del backend y escucha eventos en tiempo real.
 *
 * Eventos:
 * - 'estudiante-asignado' → invalida dashboard del asesor + lista de estudiantes
 * - 'nuevo-estudiante'    → invalida lista de estudiantes + reportes admin
 * - 'pago-registrado'     → invalida reportes financieros
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

      // ── Estudiante creado o asignado a asesor ────────────────────────────
      es.addEventListener('estudiante-asignado', () => {
        startTransition(() => {
          queryClient.invalidateQueries({ queryKey: ['reportes-dashboard'] })
          queryClient.invalidateQueries({ queryKey: ['estudiantes'] })
        })
      })

      // ── Nuevo estudiante via Hotmart ─────────────────────────────────────
      es.addEventListener('nuevo-estudiante', () => {
        startTransition(() => {
          queryClient.invalidateQueries({ queryKey: ['estudiantes'] })
          queryClient.invalidateQueries({ queryKey: ['cursos'] })
          queryClient.invalidateQueries({ queryKey: ['reportes-dashboard'] })
          queryClient.invalidateQueries({ queryKey: ['financiero-periodo'] })
          queryClient.invalidateQueries({ queryKey: ['cursos-vendidos'] })
          queryClient.invalidateQueries({ queryKey: ['ranking-asesores'] })
        })
      })

      // ── Pago registrado ──────────────────────────────────────────────────
      es.addEventListener('pago-registrado', () => {
        startTransition(() => {
          queryClient.invalidateQueries({ queryKey: ['reportes-dashboard'] })
          queryClient.invalidateQueries({ queryKey: ['financiero-periodo'] })
          queryClient.invalidateQueries({ queryKey: ['estudiantes'] })
          queryClient.invalidateQueries({ queryKey: ['reportes-medios-pago'] })
        })
      })

      es.onerror = () => {
        es?.close()
        if (active) {
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
