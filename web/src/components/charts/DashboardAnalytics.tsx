'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { cn, formatCOP } from '@/lib/utils'
import { createClientFetcher } from '@/lib/api'
import { FinancieroSection } from './FinancieroSection'
import { ProximosCobros } from './ProximosCobros'
import { CursosVendidosChart } from './CursosVendidosChart'
import { KpiCard } from '@/components/ui/KpiCard'
import { Users, Wallet, AlertTriangle } from 'lucide-react'

type Periodo = 'diario' | 'semanal' | 'mensual'

const TABS: { key: Periodo; label: string }[] = [
  { key: 'diario',   label: 'Diario'   },
  { key: 'semanal',  label: 'Semanal'  },
  { key: 'mensual',  label: 'Mensual'  },
]

export function DashboardAnalytics() {
  const [periodo, setPeriodo] = useState<Periodo>('mensual')
  const { getToken } = useAuth()

  const { data: statsData } = useQuery({
    queryKey: ['dashboard-stats', periodo],
    queryFn: async () => {
      const token = await getToken()
      return createClientFetcher(token ?? '')(`/reportes/dashboard?periodo=${periodo}`) as Promise<{ data: any }>
    },
    staleTime: 60_000,
  })

  const estudiantes = statsData?.data?.estudiantes ?? { total: 0, nuevosMes: 0 }
  const cobranza    = statsData?.data?.cobranza    ?? { porCobrar: { monto: 0, cantidad: 0 }, vencida: { monto: 0, cantidad: 0 } }

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

      {/* ── Tarjetas financieras + gráfica del métrico ─────────────────── */}
      <FinancieroSection periodo={periodo} />

      {/* ── KPIs filtrados por período ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard
          title="Estudiantes activos"
          value={estudiantes.total.toString()}
          subtitle={`${estudiantes.nuevosMes} nuevos este mes`}
          icon={Users}
          variant="default"
          trend={{ value: 8, label: 'vs mes anterior' }}
        />
        <KpiCard
          title="Por cobrar"
          value={formatCOP(cobranza.porCobrar.monto)}
          subtitle={`${cobranza.porCobrar.cantidad} pendientes`}
          icon={Wallet}
          variant="warning"
        />
        <KpiCard
          title="En mora"
          value={formatCOP(cobranza.vencida.monto)}
          subtitle={`${cobranza.vencida.cantidad} vencidos`}
          icon={AlertTriangle}
          variant="error"
        />
      </div>

      {/* ── Próximos cobros + Cursos más vendidos ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProximosCobros />
        <CursosVendidosChart />
      </div>

    </div>
  )
}
