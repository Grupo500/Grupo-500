'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

/**
 * La app va siempre en claro. `forcedTheme` es lo que lo garantiza: ignora lo
 * que hubiera guardado el navegador de antes y nunca pone la clase `.dark`,
 * que es lo único que activa la paleta oscura del CSS. Por eso tampoco
 * importa que el celular esté en modo oscuro.
 *
 * El proveedor se queda porque media docena de gráficas leen `resolvedTheme`
 * para elegir su paleta; con esto siempre reciben 'light'.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      forcedTheme="light"
      defaultTheme="light"
      enableSystem={false}
      storageKey="grupo500-theme"
    >
      {children}
    </NextThemesProvider>
  )
}
