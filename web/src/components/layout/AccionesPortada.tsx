'use client'

/**
 * Los tres botones de siempre —inicio, notificaciones y actualizar— parados
 * en el renglón del título de la portada.
 *
 * En celular ya no hay franja de marca donde vivir (ver `HeaderCondicional`):
 * el nombre de la app encima de una pantalla de la app no le decía nada a
 * quien ya entró, y se comía 52px de la parte de arriba, que es la que se ve
 * sin desplazar. Los botones bajan al título y la franja se va (Hotman,
 * 21-ago).
 *
 * Solo en celular: en escritorio la franja sigue arriba y estos botones serían
 * los mismos dos veces.
 */

import Link from 'next/link'
import { Home } from 'lucide-react'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { NotificacionesButton } from '@/components/ui/NotificacionesButton'
import { cn } from '@/lib/utils'

// Círculo blanco con borde: el mismo lenguaje de las tarjetas. Sobre el fondo
// celeste de la página se despegan y se leen como cosas que se pulsan; los
// estilos que traen por defecto estos botones son para el azul oscuro del
// header.
const BOTON =
  'w-9 h-9 rounded-full border border-outline-variant bg-surface-lowest ' +
  'text-on-surface-variant hover:bg-surface-low hover:text-on-surface'

export function AccionesPortada({ conInicio = true, className }: {
  /** En el selector de módulos sobra: ya se está en inicio. */
  conInicio?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex flex-shrink-0 items-center gap-2 md:hidden', className)}>
      {conInicio && (
        <Link
          href="/inicio"
          title="Volver al inicio"
          aria-label="Volver al inicio"
          className={cn('flex items-center justify-center transition-colors', BOTON)}
        >
          <Home className="w-4 h-4" />
        </Link>
      )}
      {/* El anillo del globo de no leídas iguala al fondo de la página, no al
          azul oscuro del header. */}
      <NotificacionesButton className={BOTON} anillo="border-surface-low" />
      <RefreshButton className={BOTON} />
    </div>
  )
}
