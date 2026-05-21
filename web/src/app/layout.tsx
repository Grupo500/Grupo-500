import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { esES } from '@clerk/localizations'
import { Inter } from 'next/font/google'
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
  // theme-color se maneja via inline script en <head> para respetar
  // el tema guardado en localStorage (independiente del modo del SO)
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      localization={esES}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/verificando"
      signUpFallbackRedirectUrl="/verificando"
      afterSignOutUrl="/sign-in"
    >
      <html lang="es" suppressHydrationWarning>
        <body className={`${inter.variable} font-sans`}>
          {/* Inline script — lee localStorage antes de hidratación para theme-color */}
          <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('grupo500-theme')||'light';var c=t==='dark'?'#0a1628':'#eef6ff';var m=document.querySelector('meta[name="theme-color"]');if(m){m.content=c;}else{m=document.createElement('meta');m.name='theme-color';m.content=c;document.head.appendChild(m);}}catch(e){}})();` }} />
          <ThemeProvider>
            <ServiceWorkerRegister />
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
