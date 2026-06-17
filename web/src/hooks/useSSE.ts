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

      // Eventos de venta/asignación (poco frecuentes): invalidar TODO lo activo
      // para que ventas, comisiones y rankings lleguen en tiempo real a admin y asesores.
      const refrescarTodo = () => {
        startTransition(() => {
          queryClient.invalidateQueries()
        })
      }

      es.addEventListener('estudiante-asignado', refrescarTodo)
      es.addEventListener('nuevo-estudiante', refrescarTodo)
      es.addEventListener('pago-registrado', refrescarTodo)

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
