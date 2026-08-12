'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** `className` lo repinta para el header, que va sobre un oscuro fijo. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <div className={cn('w-9 h-9 rounded-xl bg-surface-high animate-pulse', className)} />
  }

  const isDark = theme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      className={cn(
        'w-9 h-9 rounded-xl bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-highest transition-colors',
        className,
      )}
    >
      {isDark ? <Sun className="w-4 h-4 text-[#21b9f7]" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}
