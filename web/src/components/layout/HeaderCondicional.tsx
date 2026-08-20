'use client'

import { usePathname } from 'next/navigation'
import { Header } from './Header'

/**
 * La franja de marca solo se muestra en la portada de cada área, no en todas
 * las pantallas (Hotman, 20-ago): en celular repetía el logo encima de cada
 * lista y le robaba una franja de alto a lo que la persona vino a ver. En las
 * pantallas internas ya está el título de la página diciendo dónde se está, y
 * la navegación vive en la barra de abajo.
 *
 * Portadas: el dashboard de Ventas, el selector de módulos y el resumen de
 * cada área (Administración, Finanzas, Marketing).
 */
const PORTADAS = new Set(['/dashboard', '/inicio', '/admin', '/finanzas', '/marketing'])

export function HeaderCondicional() {
  const pathname = usePathname()
  if (!pathname || !PORTADAS.has(pathname)) return null
  return <Header />
}
