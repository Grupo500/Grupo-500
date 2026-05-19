import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Grupo 500 — Plataforma Pre-ICFES',
    short_name: 'Grupo 500',
    description: 'Plataforma de gestión para cursos de preparación ICFES',
    start_url: '/',
    display: 'standalone',
    // 'any' es obligatorio para que Chrome en escritorio muestre el botón de instalación
    orientation: 'any',
    background_color: '#21b9f7',
    theme_color: '#21b9f7',
    icons: [
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    screenshots: [
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',

        form_factor: 'wide',
        label: 'Dashboard Grupo 500',
      },
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',

        form_factor: 'narrow',
        label: 'Grupo 500 móvil',
      },
    ],
    categories: ['education', 'productivity'],
    lang: 'es',
  }
}
