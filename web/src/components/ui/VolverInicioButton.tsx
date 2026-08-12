import Link from 'next/link'
import { Home } from 'lucide-react'

/**
 * Mismo botón que lleva el header del área al selector de módulos.
 *
 * Casa y no cuadrícula: la cuadrícula dibujaba el destino (el selector con sus
 * tarjetas) y se confundía con el ícono de Dashboard, que es el mismo trazo.
 * La casa dice "volver al principio", que es lo que hace.
 */
export function VolverInicioButton() {
  return (
    <Link
      href="/inicio"
      title="Volver al inicio"
      className="w-9 h-9 rounded-xl bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-highest transition-colors shrink-0"
    >
      <Home className="w-4 h-4" />
    </Link>
  )
}
