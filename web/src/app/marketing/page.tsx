'use client'

import { VolverInicioButton } from '@/components/ui/VolverInicioButton'
import { NotificacionesButton } from '@/components/ui/NotificacionesButton'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { TableroContenido } from '@/components/marketing/TableroContenido'

export default function MarketingPage() {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Solo en celular: en escritorio estos mismos botones ya viven en el
          header del área y salían dos veces. En celular el header es solo la
          franja de marca, así que aquí siguen siendo la única forma de volver
          al inicio, cambiar el tema o refrescar. */}
      <div className="flex items-center justify-end gap-2 md:hidden">
        <VolverInicioButton />
        <NotificacionesButton />
        <ThemeToggle />
        <RefreshButton />
      </div>
      <TableroContenido />
    </div>
  )
}
