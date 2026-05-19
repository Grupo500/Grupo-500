'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { FinancieroSection } from './FinancieroSection'
import { ProximosCobros } from './ProximosCobros'
import { CursosVendidosChart } from './CursosVendidosChart'

type Periodo = 'diario' | 'semanal' | 'mensual'

const TABS: { key: Periodo; label: string }[] = [
  { key: 'diario',   label: 'Diario'   },
  { key: 'semanal',  label: 'Semanal'  },
  { key: 'mensual',  label: 'Mensual'  },
]

export function DashboardAnalytics() {
  const [periodo, setPeriodo] = useState<Periodo>('mensual')

  return (
    <div className="space-y-5">

      {/* ── Selector de período global ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-on-surface-variant">Período de análisis</p>
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-surface-high border border-outline-variant/40">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setPeriodo(t.key)}
              className={cn(
                'px-4 py-1.5 rounded-md text-[12px] font-medium transition-all duration-200',
                periodo === t.key
                  ? 'bg-surface-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Financiero: Total facturado · Recaudado · Por cobrar · En mora */}
      <FinancieroSection periodo={periodo} />

      {/* ── Próximos cobros + Cursos más vendidos ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProximosCobros periodo={periodo} />
        <CursosVendidosChart periodo={periodo} />
      </div>

    </div>
  )
}
