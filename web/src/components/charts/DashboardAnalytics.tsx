'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { VentasChart } from './VentasChart'
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
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--surface-high)]">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setPeriodo(t.key)}
              className={cn(
                'px-4 py-1.5 rounded-md text-[12px] font-medium transition-all duration-200',
                periodo === t.key
                  ? 'bg-[var(--surface-lowest)] text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tarjetas financieras + gráfica del métrico ─────────────────── */}
      <FinancieroSection periodo={periodo} />

      {/* ── Ventas (área) + Próximos cobros ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <VentasChart periodo={periodo} />
        </div>
        <div>
          <ProximosCobros />
        </div>
      </div>

      {/* ── Cursos más vendidos ─────────────────────────────────────────── */}
      <CursosVendidosChart />

    </div>
  )
}
