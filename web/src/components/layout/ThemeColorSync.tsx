'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

/**
 * Sincroniza el meta theme-color con el color real que renderiza
 * el gradiente --bg en la parte superior de la pantalla.
 * Usa canvas para samplear el pixel exacto — así el color de la
 * barra del OS (PWA desktop) siempre continúa el gradiente sin
 * importar el display o calibración del dispositivo.
 */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
    if (!meta) return

    // Crear un canvas offscreen 1×1 y renderizar el gradiente CSS en él
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Leer el valor exacto de --bg del DOM (ya con el tema activo)
    const bgValue = getComputedStyle(document.documentElement)
      .getPropertyValue('--bg')
      .trim()

    // Aplicar el gradiente al canvas y samplear el pixel en y=0 (top)
    ctx.fillStyle = bgValue
    ctx.fillRect(0, 0, 1, 1)

    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')

    // Actualizar todos los meta theme-color (puede haber uno por media query)
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(tag => {
      tag.content = hex
    })
  }, [resolvedTheme])

  return null
}
