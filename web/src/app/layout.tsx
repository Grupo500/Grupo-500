import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { ServiceWorkerRegister } from '@/components/layout/ServiceWorkerRegister'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Grupo 500 — Plataforma Pre-ICFES',
  description: 'Plataforma de gestión para cursos de preparación ICFES',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Grupo 500',
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <SessionProvider>
          <ThemeProvider>
            <ServiceWorkerRegister />
            {children}
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
