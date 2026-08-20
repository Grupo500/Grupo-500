'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

/** `className` lo repinta para el header, que va sobre un oscuro fijo. */
export function RefreshButton({ className }: { className?: string }) {
  const [spinning, setSpinning] = useState(false)
  const router      = useRouter()
  const queryClient = useQueryClient()

  const handleRefresh = async () => {
    if (spinning) return
    setSpinning(true)
    try {
      // `refetchQueries` y no `invalidateQueries`: invalidar solo MARCA los
      // datos como viejos y respeta el staleTime de cada consulta, así que
      // tocar el botón podía no disparar una sola petición y parecía que no
      // hacía nada (Hotman, 20-ago). Esto vuelve a pedir de verdad.
      await queryClient.refetchQueries({ type: 'active' })
      // Y re-ejecuta los Server Components, para lo que no pasa por el cache.
      router.refresh()
    } finally {
      // El giro dura lo que dura la petición —con un mínimo para que se vea—,
      // en vez de 800 ms fijos que mentían sobre si ya había terminado.
      setTimeout(() => setSpinning(false), 400)
    }
  }

  return (
    <button
      onClick={handleRefresh}
      title="Actualizar datos"
      className={cn(
        'w-9 h-9 rounded-xl bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-highest transition-colors',
        className,
      )}
    >
      <RefreshCw className={cn('w-4 h-4', spinning && 'animate-spin')} />
    </button>
  )
}
