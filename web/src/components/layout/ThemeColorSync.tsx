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
    if (!resolvedTheme) return

    const color = resolvedTheme === 'dark' ? THEME_COLORS.dark : THEME_COLORS.light

    // Eliminar TODAS las meta tags theme-color existentes (Next.js genera varias con media queries)
    document.querySelectorAll('meta[name="theme-color"]').forEach(el => el.remove())

    // Crear una sola sin media query para que el navegador la use siempre
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = color
    document.head.appendChild(meta)
  }, [resolvedTheme])

  return null
}
