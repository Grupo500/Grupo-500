'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { ThemeColorSync } from '@/components/layout/ThemeColorSync'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      themes={['dark', 'light']}
      enableSystem={false}
      storageKey="grupo500-theme"
    >
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  )
}
