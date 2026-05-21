'use client'

import { useQueryClient } from '@tanstack/react-query'

/**
 * Invalida todos los queries activos de la app.
 * Usar después de cualquier mutación que cambie datos financieros
 * para que dashboard, calendario, lista de estudiantes, etc. se actualicen.
 */
export function useInvalidateAll() {
  const queryClient = useQueryClient()

  return () => queryClient.invalidateQueries()
}
