'use client'

import { usePathname } from 'next/navigation'
import { Header } from './Header'

/**
 * La franja de marca se comporta distinto según el tamaño de pantalla
 * (Hotman, 20-ago):
 *
 * - **Escritorio: siempre.** Hay alto de sobra y la franja es la marca de la
 *   app; quitarla dejaba las pantallas internas empezando en el vacío.
 * - **Celular: solo en las portadas.** Ahí sí competía por espacio — repetía
 *   el logo encima de cada lista y le robaba una franja a lo que la persona
 *   vino a ver. En las pantallas internas basta el título de la página, y la
 *   navegación vive en la barra de abajo.
 *
 * Se oculta con CSS y no dejando de renderizarla, para que el servidor y el
 * navegador pinten lo mismo: decidirlo con el ancho de la ventana provoca un
 * parpadeo en la primera carga.
 *
 * Portadas: el dashboard de Ventas, el selector de módulos y el resumen de
 * cada área (Administración, Finanzas, Marketing).
 */
const PORTADAS = new Set(['/dashboard', '/inicio', '/admin', '/finanzas', '/marketing'])

export function HeaderCondicional() {
  const pathname = usePathname()
  const esPortada = !!pathname && PORTADAS.has(pathname)
  return <Header className={esPortada ? undefined : 'max-md:hidden'} />
}
