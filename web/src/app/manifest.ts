import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Grupo 500 — Plataforma Pre-ICFES',
    short_name: 'Grupo 500',
    description: 'Plataforma de gestión para cursos de preparación ICFES',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0f1a',
    theme_color: '#0a0f1a',
    icons: [
      // Desktop PWA (Windows/macOS) — rounded corners, dark background
      {
        src: '/icon-desktop-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-desktop-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      // Android PWA — circular (maskable: Android applies its own shape)
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      // iOS
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    categories: ['education', 'productivity'],
    lang: 'es',
  }
}
