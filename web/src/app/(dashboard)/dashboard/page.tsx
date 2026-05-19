import { apiFetch } from '@/lib/api.server'
import { currentUser } from '@clerk/nextjs/server'
import { formatCOP } from '@/lib/utils'
import { KpiCard } from '@/components/ui/KpiCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { Users, Wallet, AlertTriangle, BookOpen, Target, Bell } from 'lucide-react'
import { ProximosCobros } from '@/components/charts/ProximosCobros'
import { DashboardAnalytics } from '@/components/charts/DashboardAnalytics'
import { RefreshButton } from '@/components/ui/RefreshButton'
import Image from 'next/image'

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
  const role      = (user?.publicMetadata?.role as 'ADMIN' | 'VENDEDOR') ?? 'VENDEDOR'
  const isAdmin   = role === 'ADMIN'
  const firstName = user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] ?? ''
  const horaColombia = Number(new Intl.DateTimeFormat('es-CO', { hour: 'numeric', hour12: false, timeZone: 'America/Bogota' }).format(new Date()))
  const saludo = horaColombia < 12 ? 'Buenos días' : horaColombia < 18 ? 'Buenas tardes' : 'Buenas noches'

  const estudiantes = data?.estudiantes ?? { total: 0, nuevosMes: 0 }
  const cobranza    = data?.cobranza    ?? { porCobrar: { monto: 0, cantidad: 0 }, vencida: { monto: 0, cantidad: 0 }, cobrado: { monto: 0, cantidad: 0 }, pendiente: { monto: 0, cantidad: 0 } }

  // ── VISTA ADMINISTRADOR ──────────────────────────────────────────────────────
  if (isAdmin) {
    return (
      <div className="space-y-3 animate-fade-in">
        <div className="flex items-center justify-between gap-3">
          {/* Saludo izquierda */}
          <div className="flex items-center gap-3">
            {user?.imageUrl && (
              <Image
                src={user.imageUrl}
                alt={firstName}
                width={46}
                height={46}
                className="rounded-full md:hidden flex-shrink-0 ring-2 ring-[#2094ff]/25"
              />
            )}
            <h1 className="text-[22px] font-bold text-on-surface tracking-tight leading-tight">
              <span className="md:hidden">{saludo},<br />{firstName} 👋</span>
              <span className="hidden md:inline">{saludo}, {firstName} 👋</span>
            </h1>
          </div>
          {/* Acciones derecha */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="w-9 h-9 rounded-xl bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors relative">
              <Bell className="w-4 h-4" />
            </button>
            <RefreshButton />
          </div>
        </div>

        {/* Analytics con período global: tarjetas + gráficas sincronizadas */}
        <DashboardAnalytics />

        {/* KPIs fijos */}
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
      </div>
    )
  }

  // ── VISTA ASESOR ─────────────────────────────────────────────────────────────
  const metaVentas   = 20_000_000
  const ventasActual = 15_000_000
  const progreso     = Math.round((ventasActual / metaVentas) * 100)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Saludo asesor */}
      <div className="flex items-center gap-3 sm:block">
        {user?.imageUrl && (
          <Image
            src={user.imageUrl}
            alt={firstName}
            width={46}
            height={46}
            className="rounded-full sm:hidden flex-shrink-0 ring-2 ring-[#2094ff]/25"
          />
        )}
        <div>
          <h1 className="text-[22px] font-bold text-on-surface tracking-tight leading-tight">
            <span className="sm:hidden">{saludo},<br />{firstName} 👋</span>
            <span className="hidden sm:inline">{saludo}, {firstName} 👋</span>
          </h1>
          <p className="text-[13px] text-on-surface-variant mt-0.5 font-medium">Resumen de tu actividad y gestión</p>
        </div>
      </div>
      <RefreshButton />

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
        <div className="h-2.5 rounded-full bg-[var(--surface-high)] overflow-hidden mb-2">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progreso}%` }} />
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-on-surface-variant">
            <span className="font-semibold text-on-surface">{formatCOP(ventasActual)}</span>
            {' '}de {formatCOP(metaVentas)}
          </span>
          <span className="chip-info">{progreso >= 100 ? '¡Meta alcanzada!' : `Faltan ${formatCOP(metaVentas - ventasActual)}`}</span>
        </div>
      </div>

      {/* KPIs asesor */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard title="Estudiantes asignados" value={estudiantes.total.toString()} subtitle={`${estudiantes.nuevosMes} nuevos este mes`} icon={Users} variant="default" trend={{ value: 12, label: 'vs mes anterior' }} />
        <KpiCard title="Cobros pendientes" value={cobranza.pendiente.cantidad.toString()} subtitle={cobranza.pendiente.cantidad > 0 ? 'Requieren acción' : 'Todo al día'} icon={Wallet} variant="warning" />
        <KpiCard title="Cursos activos" value="—" subtitle="Productos vigentes" icon={BookOpen} variant="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProximosCobros />
      </div>
    </div>
  )
}
