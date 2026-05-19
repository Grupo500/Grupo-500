'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCOP } from '@/lib/utils'
import { TrendingUp, Wallet, AlertTriangle, Users, CreditCard, Loader2 } from 'lucide-react'
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

function Kpi({
  label, value, sub, color, isLoading,
}: {
  label: string; value: string; sub?: string; color: string; isLoading?: boolean
}) {
  if (isLoading) {
    return (
      <div className="rounded-2xl p-4 border border-outline-variant bg-surface-lowest space-y-2">
        <div className="h-3 w-24 rounded bg-surface-high animate-pulse" />
        <div className="h-6 w-32 rounded bg-surface-high animate-pulse" />
        {sub && <div className="h-3 w-16 rounded bg-surface-high animate-pulse" />}
      </div>
    )
  }
  return (
    <div className="rounded-2xl p-4 border border-outline-variant bg-surface-lowest"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}>
      <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-1">{label}</p>
      <p className="text-[17px] sm:text-[20px] font-bold tabular-nums leading-tight" style={{ color }}>{value}</p>
      {sub && <p className="text-[11px] text-on-surface-variant mt-1">{sub}</p>}
    </div>
  )
}

export default function ReportesPage() {
  const { getToken } = useAuth()

  const fetcher = async <T,>(path: string) => {
    const token = await getToken()
    return createClientFetcher(token)<T>(path)
  }

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['reportes-dashboard'],
    queryFn: () => fetcher<{ data: DashboardData }>('/reportes/dashboard'),
    staleTime: 60_000,
  })

  const d = dashData?.data
  const estudiantes = d?.estudiantes ?? { total: 0, nuevosMes: 0 }
  const cobranza    = d?.cobranza   ?? { porCobrar: { monto: 0, cantidad: 0 }, vencida: { monto: 0, cantidad: 0 }, cobrado: { monto: 0, cantidad: 0 }, pendiente: { monto: 0, cantidad: 0 } }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Reportes" subtitle="Estadísticas globales de la operación" />

      {/* ── Estudiantes ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Estudiantes</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi label="Total registrados"   value={estudiantes.total.toLocaleString('es-CO')}  color="#1a7de0" isLoading={isLoading} />
          <Kpi label="Nuevos este mes"      value={`+${estudiantes.nuevosMes}`}                color="#16a34a" isLoading={isLoading} />
        </div>
      </section>

      {/* ── Cobranza ────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Cobranza</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi label="Recaudado"  value={formatCOP(cobranza.cobrado.monto)}   sub={`${cobranza.cobrado.cantidad} cobros`}   color="#16a34a" isLoading={isLoading} />
          <Kpi label="Por cobrar" value={formatCOP(cobranza.porCobrar.monto)} sub={`${cobranza.porCobrar.cantidad} pendientes`} color="#d97706" isLoading={isLoading} />
          <Kpi label="En mora"    value={formatCOP(cobranza.vencida.monto)}   sub={`${cobranza.vencida.cantidad} vencidos`}  color="#dc2626" isLoading={isLoading} />
        </div>
      </section>

      {/* ── Gráficas ─────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <IngresosMensualesChart />
        <RankingAsesores />
      </section>
    </div>
  )
}
