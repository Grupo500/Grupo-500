import { apiFetch } from '@/lib/api.server'
import { PageHeader } from '@/components/ui/PageHeader'
import { KpiCard } from '@/components/ui/KpiCard'
import { formatCOP } from '@/lib/utils'
import { TrendingUp, Wallet, CreditCard, Users, AlertTriangle } from 'lucide-react'
import { IngresosMensualesChart } from '@/components/charts/IngresosMensualesChart'

async function getReporteData() {
  try {
    const [dashboard, ingresos] = await Promise.allSettled([
      apiFetch<any>('/reportes/dashboard'),
      apiFetch<any>('/reportes/ingresos?periodo=mes'),
    ])
    return {
      dashboard: dashboard.status === 'fulfilled' ? dashboard.value?.data : null,
      ingresos: ingresos.status === 'fulfilled' ? ingresos.value?.data : null,
    }
  } catch {
    return { dashboard: null, ingresos: null }
  }
}

export default async function ReportesPage() {
  const { dashboard } = await getReporteData()

  const ingresos = dashboard?.ingresos ?? { hoy: 0, semana: 0, mes: 0 }
  const estudiantes = dashboard?.estudiantes ?? { total: 0, nuevosMes: 0 }
  const cobranza = dashboard?.cobranza ?? { pendiente: { monto: 0, cantidad: 0 }, vencida: { monto: 0, cantidad: 0 } }
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Reportes" subtitle="Estadísticas globales de la operación" />

      {/* KPIs de ingresos */}
      <div>
        <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">Ingresos</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <KpiCard title="Hoy" value={formatCOP(ingresos.hoy)} icon={TrendingUp} variant="success" />
          <KpiCard title="Esta semana" value={formatCOP(ingresos.semana)} icon={CreditCard} variant="default" />
          <KpiCard title="Este mes" value={formatCOP(ingresos.mes)} icon={TrendingUp} variant="success" trend={{ value: 0, label: 'en curso' }} />
          <KpiCard title="Estudiantes activos" value={estudiantes.total.toString()} subtitle={`+${estudiantes.nuevosMes} este mes`} icon={Users} variant="default" />
        </div>
      </div>

      {/* KPIs de cobranza */}
      <div>
        <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">Cobranza</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <KpiCard title="Por cobrar" value={formatCOP(cobranza.pendiente.monto)} subtitle={`${cobranza.pendiente.cantidad} cuotas`} icon={Wallet} variant="warning" />
          <KpiCard title="En mora" value={formatCOP(cobranza.vencida.monto)} subtitle={`${cobranza.vencida.cantidad} vencidas`} icon={AlertTriangle} variant="error" />
        </div>
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 gap-4">
        <IngresosMensualesChart />
      </div>
    </div>
  )
}
