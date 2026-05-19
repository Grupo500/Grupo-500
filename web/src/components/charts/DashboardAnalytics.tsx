'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { cn } from '@/lib/utils'
import { createClientFetcher } from '@/lib/api'
import { FinancieroSection } from './FinancieroSection'
import { ProximosCobros } from './ProximosCobros'
import { CursosVendidosChart } from './CursosVendidosChart'
import { KpiCard } from '@/components/ui/KpiCard'
import { Users } from 'lucide-react'

type Periodo = 'diario' | 'semanal' | 'mensual'

const TABS: { key: Periodo; label: string }[] = [
  { key: 'diario',   label: 'Diario'   },
  { key: 'semanal',  label: 'Semanal'  },
  { key: 'mensual',  label: 'Mensual'  },
]

export function DashboardAnalytics() {
  const [periodo, setPeriodo] = useState<Periodo>('mensual')
  const { getToken } = useAuth()

  const { data: statsData, isLoading } = useQuery({
    queryKey: ['dashboard-stats', periodo],
    queryFn: async () => {
      const token = await getToken()
      return createClientFetcher(token ?? '')(`/reportes/dashboard?periodo=${periodo}`) as Promise<{ data: any }>
    },
    staleTime: 60_000,
  })

  const estudiantes = statsData?.data?.estudiantes ?? { total: 0, nuevosMes: 0 }

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

      {/* ── KPI Estudiantes ────────────────────────────────────────────── */}
      <KpiCard
        title="Estudiantes activos"
        value={estudiantes.total.toString()}
        rawValue={estudiantes.total}
        subtitle={`${estudiantes.nuevosMes} nuevos este mes`}
        icon={Users}
        variant="default"
        isLoading={isLoading}
        trend={{ value: 8, label: 'vs mes anterior' }}
        className="max-w-xs"
      />

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
