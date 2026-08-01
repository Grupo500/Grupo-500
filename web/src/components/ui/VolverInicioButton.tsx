import Link from 'next/link'
import { LayoutGrid } from 'lucide-react'

/** Mismo botón que usa Ventas (DashboardWrapper) para volver al selector de módulos. */
export function VolverInicioButton() {
  return (
    <Link
      href="/inicio"
      title="Volver al inicio"
      className="w-9 h-9 rounded-xl bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-highest transition-colors shrink-0"
    >
      <LayoutGrid className="w-4 h-4" />
    </Link>
  )
}
