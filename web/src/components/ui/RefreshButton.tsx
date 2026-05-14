'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export function RefreshButton() {
  const [spinning, setSpinning] = useState(false)

  const handleRefresh = () => {
    setSpinning(true)
    setTimeout(() => window.location.reload(), 300)
  }

  return (
    <button
      onClick={handleRefresh}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-high border border-outline-variant transition-colors"
    >
      <RefreshCw className={cn('w-3.5 h-3.5', spinning && 'animate-spin')} />
      Actualizar
    </button>
  )
}
