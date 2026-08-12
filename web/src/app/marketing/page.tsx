'use client'

import { useState } from 'react'
import { VolverInicioButton } from '@/components/ui/VolverInicioButton'
import { NotificacionesButton } from '@/components/ui/NotificacionesButton'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { CalendarioMarketing } from '@/components/marketing/CalendarioMarketing'
import { CalendarioReui } from '@/components/marketing/CalendarioReui'
import { cn } from '@/lib/utils'

// El calendario nuevo (ReUI) es de consulta: trae vistas de mes, semana, día,
// agenda y por responsable. El clásico es el que tiene crear, editar, eliminar
// y entregables. Se conservan los dos hasta decidir si se migra el CRUD.
const VISTAS = [
  { id: 'reui', label: 'Calendario' },
  { id: 'clasico', label: 'Editar contenido' },
] as const

export default function MarketingPage() {
  const [vista, setVista] = useState<(typeof VISTAS)[number]['id']>('reui')

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl bg-surface-low p-1">
          {VISTAS.map(v => (
            <button
              key={v.id}
              onClick={() => setVista(v.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors cursor-pointer',
                vista === v.id
                  ? 'bg-surface-lowest text-on-surface font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <VolverInicioButton />
          <NotificacionesButton />
          <ThemeToggle />
          <RefreshButton />
        </div>
      </div>

      {vista === 'reui' ? <CalendarioReui /> : <CalendarioMarketing />}
    </div>
  )
}
