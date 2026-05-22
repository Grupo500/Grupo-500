'use client'

import { useSSE } from '@/hooks/useSSE'

/**
 * SSEProvider — conecta el canal SSE en TODA la app desde el layout.
 * Al vivir en el layout (dashboard), todos los módulos reciben
 * actualizaciones en tiempo real sin necesidad de llamar useSSE() en cada página.
 */
export function SSEProvider({ children }: { children: React.ReactNode }) {
  useSSE()
  return <>{children}</>
}
