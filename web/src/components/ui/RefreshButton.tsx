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
      className="w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-colors"
      title="Actualizar"
    >
      <RefreshCw className={cn('w-4 h-4', spinning && 'animate-spin')} />
    </button>
  )
}
