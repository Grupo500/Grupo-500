import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Grupo 500 — Plataforma Pre-ICFES',
  description: 'Plataforma de gestión para cursos de preparación ICFES',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="es" className="dark">
        <body className={`${inter.variable} font-sans`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
