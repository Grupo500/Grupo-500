export const dynamic = 'force-dynamic'

import { apiFetch } from '@/lib/api.server'
import { auth } from '@/auth'
import { formatCOP } from '@/lib/utils'
import { KpiCard } from '@/components/ui/KpiCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProximosCobros } from '@/components/charts/ProximosCobros'
import { DashboardAnalytics } from '@/components/charts/DashboardAnalytics'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { Bell, Target } from 'lucide-react'
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
  const [data, session] = await Promise.all([
    getDashboardData(),
    auth().catch(() => null),
  ])
  const role      = (session?.user?.role as 'ADMIN' | 'VENDEDOR') ?? 'VENDEDOR'
  const isAdmin   = role === 'ADMIN'
  const fullName  = session?.user?.name ?? session?.user?.email?.split('@')[0] ?? ''
  const firstName = fullName.split(' ')[0]
  const horaColombia = Number(new Intl.DateTimeFormat('es-CO', { hour: 'numeric', hour12: false, timeZone: 'America/Bogota' }).format(new Date()))
  const saludo = horaColombia < 12 ? 'Buenos días' : horaColombia < 18 ? 'Buenas tardes' : 'Buenas noches'

  const estudiantes   = data?.estudiantes   ?? { total: 0, nuevosMes: 0 }
  const cobranza      = data?.cobranza      ?? { porCobrar: { monto: 0, cantidad: 0 }, vencida: { monto: 0, cantidad: 0 }, cobrado: { monto: 0, cantidad: 0 }, pendiente: { monto: 0, cantidad: 0 } }
  const cursosActivos = data?.cursosActivos ?? 0
  const cobradoMes    = data?.cobradoMes    ?? 0

  // ── VISTA ADMINISTRADOR ──────────────────────────────────────────────────────
  if (isAdmin) {
    return (
      <div className="space-y-3 animate-fade-in">
        <div className="flex items-center justify-between gap-3">
          {/* Saludo izquierda */}
          <div className="flex items-center gap-3">
            {session?.user?.image && (
              <Image
                src={session!.user.image!}
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

        {/* Analytics con período global: tarjetas + gráficas + KPIs sincronizados */}
        <DashboardAnalytics />
      </div>
    )
  }

  // ── VISTA ASESOR ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Saludo asesor */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {session?.user?.image && (
            <Image
              src={session!.user.image!}
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
      </div>

      {/* Cobrado este mes */}
      <div className="card p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-[var(--primary-container)] flex items-center justify-center">
              <Target className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-on-surface">Cobrado este mes</p>
              <p className="text-[12px] text-on-surface-variant">Pagos registrados en {new Date().toLocaleDateString('es-CO', { month: 'long' })}</p>
            </div>
          </div>
          <span className="text-[20px] font-bold text-on-surface tabular">{formatCOP(cobradoMes)}</span>
        </div>
        <div className="flex items-center justify-between text-[12px] pt-2 border-t border-outline-variant/40">
          <span className="text-on-surface-variant">Por cobrar este mes</span>
          <span className={cobranza.vencida.monto > 0 ? 'font-semibold text-[#dc2626]' : 'font-semibold text-on-surface'}>
            {formatCOP(cobranza.porCobrar.monto)}
          </span>
        </div>
      </div>

      {/* KPIs asesor */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard title="Estudiantes asignados" value={estudiantes.total.toString()} subtitle={`${estudiantes.nuevosMes} nuevos este mes`} icon="Users" variant="default" />
        <KpiCard title="Cobros pendientes"     value={cobranza.pendiente.cantidad.toString()} subtitle={cobranza.vencida.cantidad > 0 ? `${cobranza.vencida.cantidad} vencidos` : 'Todo al día'} icon="Wallet" variant={cobranza.vencida.cantidad > 0 ? 'warning' : 'default'} />
        <KpiCard title="Cursos disponibles"    value={cursosActivos.toString()} subtitle="Cursos activos en plataforma" icon="BookOpen" variant="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProximosCobros />
      </div>
    </div>
  )
}
