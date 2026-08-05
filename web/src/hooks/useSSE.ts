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

      // El JWT de sesión no va en la URL: se canjea por un ticket de un solo uso
      // y 30 segundos de vida. `EventSource` no admite cabeceras, así que algo
      // tiene que viajar en la URL; que sea algo que no sirva dos veces.
      let ticket: string
      try {
        const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/eventos/ticket`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!r.ok) throw new Error(`ticket ${r.status}`)
        ticket = (await r.json())?.data?.ticket
        if (!ticket) throw new Error('respuesta sin ticket')
      } catch {
        // Sin ticket no hay conexión; se reintenta como con cualquier corte.
        if (active) retryTimeout = setTimeout(conectar, 5_000)
        return
      }
      if (!active) return

      const url = `${process.env.NEXT_PUBLIC_API_URL}/eventos?ticket=${encodeURIComponent(ticket)}`
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
        // Se cierra a mano para que EventSource no reintente por su cuenta con
        // la misma URL: el ticket ya se gastó y solo conseguiría 401 en bucle.
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
