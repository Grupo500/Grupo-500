'use client'

import { useState } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCOP } from '@/lib/utils'
import { IngresosMensualesChart } from '@/components/charts/IngresosMensualesChart'
import { RankingAsesores } from '@/components/charts/RankingAsesores'
import { CursosVendidosRanked } from '@/components/charts/CursosVendidosRanked'
import { MonthPicker, DateRange } from '@/components/ui/MonthPicker'
import { Users, UserPlus, TrendingUp, Receipt, Landmark, Wallet } from 'lucide-react'

function toISO(d: Date) { return format(d, 'yyyy-MM-dd') }
function getRangeFromMonth(month: string | null): { desde: string; hasta: string } {
  const base = month ? new Date(month + '-15') : new Date()
  return { desde: toISO(startOfMonth(base)), hasta: toISO(endOfMonth(base)) }
}

interface MedioPagoItem { metodo: string; cantidad: number; monto: number; porcentajeMonto: number; porcentajeCantidad: number }
interface MediosPagoData { total: number; totalCantidad: number; metodos: MedioPagoItem[]; periodo: string }
interface DashboardData {
  estudiantes: { total: number; nuevosMes: number }
  cobranza: { cobrado: { monto: number; cantidad: number } }
  desglose?: { bruto: number; comisionHotmart: number; comisionAsesor: number; neto: number }
}

const COLORES = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6','#f97316']

export default function ReportesPage() {
  const now = new Date()
  const currentMonth = format(now, 'yyyy-MM')

  const [month,     setMonth]     = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | null>(null)

  function handleChange(m: string | null, r: DateRange | null) {
    setMonth(m)
    setDateRange(r)
  }

  const { desde, hasta } = dateRange
    ? { desde: toISO(dateRange.start), hasta: toISO(dateRange.end) }
    : getRangeFromMonth(month)

  const fmt = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
  const fmtShort = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
  const periodoLabel = desde === hasta
    ? fmt(desde)
    : desde.slice(0, 4) === hasta.slice(0, 4)
      ? `${fmtShort(desde)} – ${fmt(hasta)}`
      : `${fmt(desde)} – ${fmt(hasta)}`

  const fetcher = async () => {
    const token = await getClientToken()
    return createClientFetcher(token ?? '')
  }

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['reportes-dashboard', desde, hasta],
    queryFn: async () => (await fetcher())<{ data: DashboardData }>(`/reportes/dashboard?desde=${desde}&hasta=${hasta}`),
    staleTime: 30_000,
  })

  const { data: mediosData, isLoading: mediosLoading } = useQuery({
    queryKey: ['reportes-medios-pago', desde, hasta],
    queryFn: async () => (await fetcher())<{ data: MediosPagoData }>(`/reportes/medios-pago?desde=${desde}&hasta=${hasta}`),
    staleTime: 30_000,
  })

  const d = dashData?.data
  const est      = d?.estudiantes ?? { total: 0, nuevosMes: 0 }
  const cobranza = d?.cobranza   ?? { cobrado: { monto: 0, cantidad: 0 } }
  const desglose = d?.desglose   ?? { bruto: 0, comisionHotmart: 0, comisionAsesor: 0, neto: 0 }

  const medios  = mediosData?.data
  const metodos = medios?.metodos ?? []

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader title="Reportes" subtitle="Estadísticas globales de la operación" />
        <div className="flex flex-col items-start md:items-end gap-1 flex-shrink-0 w-full md:w-auto">
          <MonthPicker
            value={month}
            currentMonth={currentMonth}
            dateRange={dateRange}
            onChange={handleChange}
            alignRight
          />
          <p className="text-[11px] text-on-surface-variant capitalize">{periodoLabel}</p>
        </div>
      </div>

      {/* ── FILA 1: Estudiantes + Cobranza unificados ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Estudiantes */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-md bg-[var(--primary-container)] flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-primary" />
            </div>
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant">Estudiantes</h3>
          </div>
          <div className="grid grid-cols-[1fr_1px_1fr] gap-4 items-center">
            <div>
              <p className="text-[11px] text-on-surface-variant mb-1">Total registrados</p>
              <p className="text-[26px] font-bold text-on-surface tabular-nums leading-none">
                {isLoading ? '—' : est.total.toLocaleString('es-CO')}
              </p>
            </div>
            <div className="bg-outline-variant h-12" />
            <div>
              <p className="text-[11px] text-on-surface-variant mb-1 flex items-center gap-1">
                <UserPlus className="w-3 h-3" /> Nuevos en el período
              </p>
              <p className="text-[26px] font-bold tabular-nums leading-none" style={{ color: '#16a34a' }}>
                {isLoading ? '—' : `+${est.nuevosMes}`}
              </p>
            </div>
          </div>
        </div>

        {/* Cobranza */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: '#edfdf4' }}>
              <TrendingUp className="w-3.5 h-3.5" style={{ color: '#16a34a' }} />
            </div>
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant">Cobranza</h3>
          </div>
          <div className="grid grid-cols-[1fr_1px_auto] gap-4 items-center">
            <div>
              <p className="text-[11px] text-on-surface-variant mb-1">Recaudado en el período</p>
              <p className="text-[22px] font-bold tabular-nums leading-none" style={{ color: '#16a34a' }}>
                {isLoading ? '—' : formatCOP(cobranza.cobrado.monto)}
              </p>
            </div>
            <div className="bg-outline-variant h-12" />
            <div>
              <p className="text-[11px] text-on-surface-variant mb-1 flex items-center gap-1">
                <Receipt className="w-3 h-3" /> Transacciones
              </p>
              <p className="text-[26px] font-bold text-on-surface tabular-nums leading-none">
                {isLoading ? '—' : cobranza.cobrado.cantidad}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── FILA 2: Ingresos mensuales (70%) + Desglose financiero (30%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 lg:items-stretch">
        <div className="lg:col-span-7">
          <IngresosMensualesChart periodo="mensual" />
        </div>
        <div className="lg:col-span-3">
          <div className="card p-5 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'var(--primary-container)' }}>
                <Wallet className="w-3.5 h-3.5 text-primary" />
              </div>
              <h3 className="text-[13px] font-semibold text-on-surface">Desglose del mes</h3>
            </div>
            <div className="space-y-3 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-on-surface-variant">Facturación bruta</span>
                <span className="text-[13px] font-bold text-on-surface tabular-nums">{formatCOP(desglose.bruto)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-on-surface-variant flex items-center gap-1">
                  <Landmark className="w-3 h-3" /> Comisión Hotmart
                </span>
                <span className="text-[12px] font-semibold tabular-nums" style={{ color: '#d97706' }}>
                  −{formatCOP(desglose.comisionHotmart)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-on-surface-variant flex items-center gap-1">
                  <Users className="w-3 h-3" /> Comisión asesores
                </span>
                <span className="text-[12px] font-semibold tabular-nums" style={{ color: '#dc2626' }}>
                  −{formatCOP(desglose.comisionAsesor)}
                </span>
              </div>
              <div className="border-t border-outline-variant pt-3 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-on-surface">Neto recibido</span>
                <span className="text-[18px] font-bold tabular-nums" style={{ color: '#16a34a' }}>
                  {formatCOP(desglose.neto)}
                </span>
              </div>
            </div>
            <p className="text-[9px] text-on-surface-variant/70 mt-3 leading-tight">
              Neto estimado a TRM oficial; puede variar levemente del depósito real de Hotmart.
            </p>
          </div>
        </div>
      </div>

      {/* ── FILA 3: Cursos más vendidos (grid ranked) ─────────────── */}
      <CursosVendidosRanked desde={desde} hasta={hasta} />

      {/* ── FILA 4: Medios de pago unificados ─────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <p className="text-[13px] font-semibold text-on-surface">Medios de pago</p>
          {medios && (
            <span className="text-[11px] text-on-surface-variant">
              {medios.totalCantidad} transacción{medios.totalCantidad !== 1 ? 'es' : ''} · {formatCOP(medios.total)}
            </span>
          )}
        </div>

        {mediosLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-8 rounded-lg bg-surface-high animate-pulse" />)}
          </div>
        ) : metodos.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant text-center py-6">Sin pagos registrados en este período</p>
        ) : (
          <div className="space-y-2.5">
            {metodos.map((m, i) => {
              const color = COLORES[i % COLORES.length]
              return (
                <div key={m.metodo} className="grid grid-cols-[120px_1fr_auto_50px] gap-3 items-center">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-[12px] font-medium text-on-surface truncate">{m.metodo}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-high overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${m.porcentajeMonto}%`, background: color }}
                    />
                  </div>
                  <span className="text-[12px] font-bold text-on-surface tabular-nums">{formatCOP(m.monto)}</span>
                  <span className="text-[11px] text-on-surface-variant tabular-nums text-right">
                    {m.cantidad} pago{m.cantidad !== 1 ? 's' : ''}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── FILA 5: Ranking completo de asesores ──────────────────── */}
      <RankingAsesores desde={desde} hasta={hasta} periodoLabel={periodoLabel} />
    </div>
  )
}
