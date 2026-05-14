import { apiFetch } from '@/lib/api.server'
import { currentUser } from '@clerk/nextjs/server'
import { formatCOP } from '@/lib/utils'
import { KpiCard } from '@/components/ui/KpiCard'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Users, TrendingUp, Wallet, AlertTriangle,
  BookOpen, CalendarDays, Target,
} from 'lucide-react'
import { VentasChart } from '@/components/charts/VentasChart'
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
  const role    = (user?.publicMetadata?.role as 'ADMIN' | 'VENDEDOR') ?? 'VENDEDOR'
  const isAdmin = role === 'ADMIN'

  const ingresos    = data?.ingresos    ?? { hoy: 0, semana: 0, mes: 0 }
  const estudiantes = data?.estudiantes ?? { total: 0, nuevosMes: 0 }
  const cobranza    = data?.cobranza    ?? { pendiente: { monto: 0, cantidad: 0 }, vencida: { monto: 0, cantidad: 0 } }

  // ── VISTA ADMINISTRADOR ──────────────────────────────────────────────────────
  if (isAdmin) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="Dashboard"
          subtitle="Resumen general de la operación"
        />

        {/* KPIs principales */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Ingresos del mes"
            value={formatCOP(ingresos.mes)}
            subtitle={`Hoy: ${formatCOP(ingresos.hoy)}`}
            icon={TrendingUp}
            variant="success"
            trend={{ value: 12, label: 'vs mes anterior' }}
          />
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
            value={formatCOP(cobranza.pendiente.monto)}
            subtitle={`${cobranza.pendiente.cantidad} cuotas`}
            icon={Wallet}
            variant="warning"
          />
          <KpiCard
            title="En mora"
            value={formatCOP(cobranza.vencida.monto)}
            subtitle={`${cobranza.vencida.cantidad} cuotas vencidas`}
            icon={AlertTriangle}
            variant="error"
          />
        </div>

        {/* Gráfica de ventas (tabs diario/semanal/mensual) + Próximos cobros */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <VentasChart />
          </div>
          <div>
            <ProximosCobros />
          </div>
        </div>

        {/* Ranking asesores — ancho completo */}
        <RankingAsesores />
      </div>
    )
  }

  // ── VISTA ASESOR/VENDEDOR ────────────────────────────────────────────────────
  const metaVentas    = 20_000_000
  const ventasActual  = 15_000_000
  const progreso      = Math.round((ventasActual / metaVentas) * 100)

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Mi Panel"
        subtitle="Resumen de tu actividad y gestión"
      />

      {/* Meta de ventas */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-[var(--primary-container)] flex items-center justify-center">
              <Target className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-on-surface">Meta de ventas</p>
              <p className="text-[12px] text-on-surface-variant">Trimestre actual</p>
            </div>
          </div>
          <span className="text-[22px] font-bold text-on-surface tabular">{progreso}%</span>
        </div>

        {/* Barra de progreso */}
        <div className="h-2.5 rounded-full bg-[var(--surface-high)] overflow-hidden mb-2">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progreso}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[12px]">
          <span className="text-on-surface-variant">
            <span className="font-semibold text-on-surface">{formatCOP(ventasActual)}</span>
            {' '}de {formatCOP(metaVentas)}
          </span>
          <span className="chip-info">{progreso >= 100 ? '¡Meta alcanzada!' : `Faltan ${formatCOP(metaVentas - ventasActual)}`}</span>
        </div>
      </div>

      {/* KPIs principales vendedor */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Estudiantes asignados"
          value={estudiantes.total.toString()}
          subtitle={`${estudiantes.nuevosMes} nuevos este mes`}
          icon={Users}
          variant="default"
          trend={{ value: 12, label: 'vs mes anterior' }}
        />
        <KpiCard
          title="Cobros pendientes"
          value={cobranza.pendiente.cantidad.toString()}
          subtitle={cobranza.pendiente.cantidad > 0 ? 'Requieren acción' : 'Todo al día'}
          icon={Wallet}
          variant="warning"
        />
        <KpiCard
          title="Cursos activos"
          value="—"
          subtitle="Productos vigentes"
          icon={BookOpen}
          variant="success"
        />
      </div>

      {/* Gráfica + próximos cobros */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProximosCobros />
      </div>
    </div>
  )
}
