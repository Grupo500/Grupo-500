'use client'

import { VolverInicioButton } from '@/components/ui/VolverInicioButton'
import { NotificacionesButton } from '@/components/ui/NotificacionesButton'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { CalendarioReui } from '@/components/marketing/CalendarioReui'

export default function MarketingPage() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-end gap-2">
        <VolverInicioButton />
        <NotificacionesButton />
        <ThemeToggle />
        <RefreshButton />
      </div>
      <CalendarioReui />
    </div>
  )
}
