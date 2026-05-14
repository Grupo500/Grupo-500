import { apiFetch } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { KpiCard } from '@/components/ui/KpiCard'
import { formatCOP } from '@/lib/utils'
import { TrendingUp, Wallet, CreditCard, Users, BarChart3, AlertTriangle } from 'lucide-react'
import { IngresosMensualesChart } from '@/components/charts/IngresosMensualesChart'
import { RankingAsesores } from '@/components/charts/RankingAsesores'

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
  const topAsesores = dashboard?.topAsesores ?? []

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Reportes" subtitle="Estadísticas globales de la operación" />

      {/* KPIs de ingresos */}
      <div>
        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Ingresos</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Hoy" value={formatCOP(ingresos.hoy)} icon={TrendingUp} variant="success" />
          <KpiCard title="Esta semana" value={formatCOP(ingresos.semana)} icon={CreditCard} variant="default" />
          <KpiCard title="Este mes" value={formatCOP(ingresos.mes)} icon={TrendingUp} variant="success" trend={{ value: 0, label: 'en curso' }} />
          <KpiCard title="Estudiantes activos" value={estudiantes.total.toString()} subtitle={`+${estudiantes.nuevosMes} este mes`} icon={Users} variant="default" />
        </div>
      </div>

      {/* KPIs de cobranza */}
      <div>
        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Cobranza</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Por cobrar" value={formatCOP(cobranza.pendiente.monto)} subtitle={`${cobranza.pendiente.cantidad} cuotas`} icon={Wallet} variant="warning" />
          <KpiCard title="En mora" value={formatCOP(cobranza.vencida.monto)} subtitle={`${cobranza.vencida.cantidad} vencidas`} icon={AlertTriangle} variant="error" />
        </div>
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <IngresosMensualesChart />
        <RankingAsesores />
      </div>

      {/* Top asesores detallado */}
      {topAsesores.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Ranking de asesores</p>
          <div className="bg-surface-lowest border border-outline-variant rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-low">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Asesor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden md:table-cell">Ventas (mes)</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">Recaudado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40">
                {topAsesores.map((a: any, i: number) => (
                  <tr key={a.id} className="hover:bg-surface-low/40 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`text-sm font-bold ${i === 0 ? 'text-tertiary' : i === 1 ? 'text-on-surface-variant' : 'text-on-surface-variant'}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">{a.nombre[0]?.toUpperCase()}</span>
                        </div>
                        <span className="text-sm font-medium text-on-surface">{a.nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-on-surface">{a.ventasMes ?? 0} ventas</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-sm font-semibold text-secondary">{formatCOP(a.recaudadoMes ?? 0)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
