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
    if (!resolvedTheme) {
      console.log('[ThemeColorSync] resolvedTheme es undefined, saliendo')
      return
    }

    const color = resolvedTheme === 'dark' ? THEME_COLORS.dark : THEME_COLORS.light

    // Log de diagnóstico — remover después
    const antes = Array.from(document.querySelectorAll('meta[name="theme-color"]')).map(m => ({
      media:   m.getAttribute('media'),
      content: m.getAttribute('content'),
    }))
    console.log('[ThemeColorSync] tema:', resolvedTheme, '→ color:', color)
    console.log('[ThemeColorSync] meta tags ANTES:', antes)

    // Eliminar TODAS las meta tags theme-color existentes (Next.js genera varias con media queries)
    document.querySelectorAll('meta[name="theme-color"]').forEach(el => el.remove())

    // Crear una sola sin media query para que el navegador la use siempre
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = color
    document.head.appendChild(meta)

    console.log('[ThemeColorSync] meta tag DESPUÉS:', { content: color })
  }, [resolvedTheme])

  return null
}
