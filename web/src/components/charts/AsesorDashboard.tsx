'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useSSE } from '@/hooks/useSSE'
import { apiFetch } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { KpiCard } from '@/components/ui/KpiCard'
import { Target, RefreshCw } from 'lucide-react'

interface DashboardData {
  estudiantes:   { total: number; nuevosMes: number }
  cobranza: {
    porCobrar: { monto: number; cantidad: number }
    vencida:   { monto: number; cantidad: number }
    pendiente: { monto: number; cantidad: number }
  }
  cursosActivos: number
  cobradoMes:    number
}

export function AsesorDashboard() {
  const { data: session } = useSession()
  const firstName = (session?.user?.name ?? session?.user?.email?.split('@')[0] ?? '').split(' ')[0]
  const horaColombia = Number(
    new Intl.DateTimeFormat('es-CO', { hour: 'numeric', hour12: false, timeZone: 'America/Bogota' }).format(new Date())
  )
  const saludo = horaColombia < 12 ? 'Buenos días' : horaColombia < 18 ? 'Buenas tardes' : 'Buenas noches'

  // SSE: se reconecta sola y llama invalidateQueries cuando hay cambios
  useSSE()

  const { data, isLoading, dataUpdatedAt } = useQuery<{ data: DashboardData }>({
    queryKey: ['reportes-dashboard'],
    queryFn:  () => apiFetch('/reportes/dashboard'),
    staleTime: 60_000,       // 1 min — SSE invalida antes si hay cambio real
    refetchOnWindowFocus: true,
  })

  const d          = data?.data
  const estudiantes   = d?.estudiantes   ?? { total: 0, nuevosMes: 0 }
  const cobranza      = d?.cobranza      ?? { porCobrar: { monto: 0, cantidad: 0 }, vencida: { monto: 0, cantidad: 0 }, pendiente: { monto: 0, cantidad: 0 } }
  const cursosActivos = d?.cursosActivos ?? 0
  const cobradoMes    = d?.cobradoMes    ?? 0

  const ultimaActualizacion = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Saludo asesor */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {session?.user?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt={firstName}
              width={46}
              height={46}
              className="rounded-full sm:hidden flex-shrink-0 ring-2 ring-[#2094ff]/25 w-[46px] h-[46px] object-cover"
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
        {ultimaActualizacion && (
          <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant flex-shrink-0">
            <RefreshCw className="w-3 h-3" />
            {ultimaActualizacion}
          </div>
        )}
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
              <p className="text-[12px] text-on-surface-variant">
                Pagos registrados en {new Date().toLocaleDateString('es-CO', { month: 'long' })}
              </p>
            </div>
          </div>
          {isLoading
            ? <div className="h-7 w-24 bg-surface-high rounded-lg animate-pulse" />
            : <span className="text-[20px] font-bold text-on-surface tabular">{formatCOP(cobradoMes)}</span>
          }
        </div>
        <div className="flex items-center justify-between text-[12px] pt-2 border-t border-outline-variant/40">
          <span className="text-on-surface-variant">Por cobrar este mes</span>
          {isLoading
            ? <div className="h-4 w-20 bg-surface-high rounded animate-pulse" />
            : <span className={cobranza.vencida.monto > 0 ? 'font-semibold text-[#dc2626]' : 'font-semibold text-on-surface'}>
                {formatCOP(cobranza.porCobrar.monto)}
              </span>
          }
        </div>
      </div>

      {/* KPIs asesor */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard
          title="Estudiantes asignados"
          value={estudiantes.total.toString()}
          subtitle={`${estudiantes.nuevosMes} nuevos este mes`}
          icon="Users"
          variant="default"
          isLoading={isLoading}
        />
        <KpiCard
          title="Cobros pendientes"
          value={cobranza.pendiente.cantidad.toString()}
          subtitle={cobranza.vencida.cantidad > 0 ? `${cobranza.vencida.cantidad} vencidos` : 'Todo al día'}
          icon="Wallet"
          variant={cobranza.vencida.cantidad > 0 ? 'warning' : 'default'}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}
