import Link from 'next/link'
import { LayoutDashboard } from 'lucide-react'

/**
 * Mismo botón que lleva el header del área al selector de módulos.
 *
 * Cuadrícula y no casa: dibuja el destino, que es el selector con sus tarjetas.
 * Antes era una casa para no chocar con el ícono del Dashboard —el mismo
 * trazo—, pero ese ítem se llama ahora Inicio y lleva la casa, así que cada
 * uno se queda con el dibujo que le corresponde (Hotman, 21-ago).
 */
export function VolverInicioButton() {
  return (
    <Link
      href="/inicio"
      title="Panel de módulos"
      className="w-9 h-9 rounded-xl bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-highest transition-colors shrink-0"
    >
      <LayoutDashboard className="w-4 h-4" />
    </Link>
  )
}
