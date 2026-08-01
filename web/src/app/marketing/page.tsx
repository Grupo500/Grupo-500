'use client'

import { PageHeader } from '@/components/ui/PageHeader'
import { VolverInicioButton } from '@/components/ui/VolverInicioButton'
import { CalendarioMarketing } from '@/components/marketing/CalendarioMarketing'

export default function MarketingPage() {
  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Marketing" subtitle="Calendario de contenido del equipo" actions={<VolverInicioButton />} />
      <CalendarioMarketing />
    </div>
  )
}
