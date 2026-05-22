'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      themes={['dark', 'light']}
      enableSystem={false}
      storageKey="grupo500-theme"
    >
      {children}
    </NextThemesProvider>
  )
}
