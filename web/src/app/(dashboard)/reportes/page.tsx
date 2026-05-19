'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { KpiCard } from '@/components/ui/KpiCard'
import { formatCOP } from '@/lib/utils'
import { TrendingUp, Wallet, AlertTriangle, Users, UserPlus } from 'lucide-react'
import { IngresosMensualesChart } from '@/components/charts/IngresosMensualesChart'
import { RankingAsesores } from '@/components/charts/RankingAsesores'

interface DashboardData {
  estudiantes: { total: number; nuevosMes: number }
  cobranza: {
    porCobrar: { monto: number; cantidad: number }
    vencida:   { monto: number; cantidad: number }
    cobrado:   { monto: number; cantidad: number }
    pendiente: { monto: number; cantidad: number }
  }
}

export default function ReportesPage() {
  const { getToken } = useAuth()

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['reportes-dashboard'],
    queryFn: async () => {
      const token = await getToken()
      return createClientFetcher(token)<{ data: DashboardData }>('/reportes/dashboard')
    },
    staleTime: 60_000,
  })

  const d = dashData?.data
  const est      = d?.estudiantes ?? { total: 0, nuevosMes: 0 }
  const cobranza = d?.cobranza   ?? { porCobrar: { monto: 0, cantidad: 0 }, vencida: { monto: 0, cantidad: 0 }, cobrado: { monto: 0, cantidad: 0 }, pendiente: { monto: 0, cantidad: 0 } }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Reportes" subtitle="Estadísticas globales de la operación" />

      {/* ── Estudiantes ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Estudiantes</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard title="Total registrados" value={est.total.toLocaleString('es-CO')}
            rawValue={est.total} icon={Users} variant="default" isLoading={isLoading} />
          <KpiCard title="Nuevos este mes"   value={`+${est.nuevosMes}`}
            rawValue={est.nuevosMes} icon={UserPlus} variant="success" isLoading={isLoading} />
        </div>
      </section>

      {/* ── Cobranza ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Cobranza</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard title="Recaudado"  value={formatCOP(cobranza.cobrado.monto)}
            rawValue={cobranza.cobrado.monto}   formatValue={formatCOP}
            subtitle={`${cobranza.cobrado.cantidad} cobros`}
            icon={TrendingUp} variant="success" isLoading={isLoading} />
          <KpiCard title="Por cobrar" value={formatCOP(cobranza.porCobrar.monto)}
            rawValue={cobranza.porCobrar.monto} formatValue={formatCOP}
            subtitle={`${cobranza.porCobrar.cantidad} pendientes`}
            icon={Wallet} variant="warning" isLoading={isLoading} />
          <KpiCard title="En mora"    value={formatCOP(cobranza.vencida.monto)}
            rawValue={cobranza.vencida.monto}   formatValue={formatCOP}
            subtitle={`${cobranza.vencida.cantidad} vencidos`}
            icon={AlertTriangle} variant="error" isLoading={isLoading} />
        </div>
      </section>

      {/* ── Gráficas ───────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <IngresosMensualesChart />
        <RankingAsesores />
      </section>
    </div>
  )
}
