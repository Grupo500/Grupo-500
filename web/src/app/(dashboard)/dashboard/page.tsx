import { apiFetch } from '@/lib/api.server'
import { currentUser } from '@clerk/nextjs/server'
import { formatCOP } from '@/lib/utils'
import { KpiCard } from '@/components/ui/KpiCard'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Users, TrendingUp, Wallet, AlertTriangle,
  CreditCard, UserCheck, BookOpen, CalendarDays,
} from 'lucide-react'
import { IngresosMensualesChart } from '@/components/charts/IngresosMensualesChart'
import { RankingAsesores } from '@/components/charts/RankingAsesores'
import { ProximosCobros } from '@/components/charts/ProximosCobros'

async function getDashboardData() {
  try {
    const data = await apiFetch<any>('/reportes/dashboard')
    return data.data
  } catch {
    return null
  }
}

export default async function DashboardPage() {
  const [data, user] = await Promise.all([getDashboardData(), currentUser()])
  const role = (user?.publicMetadata?.role as 'ADMIN' | 'VENDEDOR') ?? 'VENDEDOR'
  const isAdmin = role === 'ADMIN'

  const ingresos    = data?.ingresos    ?? { hoy: 0, semana: 0, mes: 0 }
  const estudiantes = data?.estudiantes ?? { total: 0, nuevosMes: 0 }
  const cobranza    = data?.cobranza    ?? { pendiente: { monto: 0, cantidad: 0 }, vencida: { monto: 0, cantidad: 0 } }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dashboard"
        subtitle={isAdmin ? 'Resumen general de la operación' : 'Resumen de tu actividad'}
      />

      {/* KPIs principales — ventas solo ADMIN */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isAdmin && (
          <KpiCard
            title="Ingresos del mes"
            value={formatCOP(ingresos.mes)}
            subtitle={`Hoy: ${formatCOP(ingresos.hoy)}`}
            icon={TrendingUp}
            variant="success"
            trend={{ value: 12, label: 'vs mes anterior' }}
          />
        )}
        <KpiCard
          title="Estudiantes activos"
          value={estudiantes.total.toString()}
          subtitle={`${estudiantes.nuevosMes} nuevos este mes`}
          icon={Users}
          variant="default"
          trend={{ value: 8, label: 'vs mes anterior' }}
        />
        {isAdmin && (
          <KpiCard
            title="Por cobrar"
            value={formatCOP(cobranza.pendiente.monto)}
            subtitle={`${cobranza.pendiente.cantidad} cuotas`}
            icon={Wallet}
            variant="warning"
          />
        )}
        {isAdmin && (
          <KpiCard
            title="En mora"
            value={formatCOP(cobranza.vencida.monto)}
            subtitle={`${cobranza.vencida.cantidad} cuotas vencidas`}
            icon={AlertTriangle}
            variant="error"
          />
        )}
      </div>

      {/* KPIs secundarios */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isAdmin && (
          <KpiCard
            title="Ingresos esta semana"
            value={formatCOP(ingresos.semana)}
            icon={CreditCard}
            variant="default"
          />
        )}
        <KpiCard
          title="Asesores activos"
          value="—"
          icon={UserCheck}
          variant="default"
        />
        <KpiCard
          title="Cursos activos"
          value="—"
          icon={BookOpen}
          variant="default"
        />
        <KpiCard
          title="Cobros próx. 7 días"
          value="—"
          icon={CalendarDays}
          variant="warning"
        />
      </div>

      {/* Gráficas — ingresos solo ADMIN */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <IngresosMensualesChart />
          </div>
          <div>
            <ProximosCobros />
          </div>
        </div>
      )}

      {/* Próximos cobros visible para todos */}
      {!isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ProximosCobros />
        </div>
      )}

      {/* Ranking asesores — solo ADMIN */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RankingAsesores />
        </div>
      )}
    </div>
  )
}
