'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

const THEME_COLORS = {
  light: '#eef6ff',
  dark:  '#0a1628',
}

/**
 * Sincroniza la meta tag theme-color con el tema activo de la app.
 * Debe montarse dentro de ThemeProvider.
 */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const color = resolvedTheme === 'dark' ? THEME_COLORS.dark : THEME_COLORS.light
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.appendChild(meta)
    }
    meta.content = color
  }, [resolvedTheme])

  return null
}
