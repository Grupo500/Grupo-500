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
    setSpinning(true)
    // Invalida TODO el cache de TanStack Query → los charts refetchan inmediatamente
    await queryClient.invalidateQueries()
    // Re-ejecuta el Server Component para datos SSR
    router.refresh()
    setTimeout(() => setSpinning(false), 800)
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
