'use client'

import { useEffect } from 'react'

/** El azul claro del fondo de la app. */
const COLOR_BARRA = '#eef6ff'

/**
 * Pinta la barra del navegador —y la del sistema, en el celular— del color de
 * la app, en vez del gris por defecto.
 *
 * Next.js genera varias `theme-color` con media queries para claro y oscuro;
 * como la app va siempre en claro, se quitan todas y se deja una sola sin
 * condición, que es la que el navegador respeta siempre.
 */
export function ThemeColorSync() {
  useEffect(() => {
    document.querySelectorAll('meta[name="theme-color"]').forEach(el => el.remove())
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = COLOR_BARRA
    document.head.appendChild(meta)
  }, [])

  return null
}
