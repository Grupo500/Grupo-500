'use client'

import { useState } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { KpiCard } from '@/components/ui/KpiCard'
import { formatCOP, cn } from '@/lib/utils'
import { IngresosMensualesChart } from '@/components/charts/IngresosMensualesChart'
import { RankingAsesores } from '@/components/charts/RankingAsesores'
import { MonthPicker, DateRange } from '@/components/ui/MonthPicker'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// ── Helpers fecha ─────────────────────────────────────────────────────────────
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
    <div className="space-y-6 animate-fade-in">
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

      {/* ── Estudiantes ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Estudiantes</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard title="Total registrados" value={est.total.toLocaleString('es-CO')}
            rawValue={est.total} icon="Users" variant="default" isLoading={isLoading} />
          <KpiCard title="Nuevos en el período" value={`+${est.nuevosMes}`}
            rawValue={est.nuevosMes} icon="UserPlus" variant="success" isLoading={isLoading} />
        </div>
      </section>

      {/* ── Cobranza ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Cobranza</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard title="Recaudado en el período" value={formatCOP(cobranza.cobrado.monto)}
            rawValue={cobranza.cobrado.monto}   formatValue={formatCOP}
            subtitle={`${cobranza.cobrado.cantidad} cobros`}
            icon="TrendingUp" variant="success" isLoading={isLoading} />
        </div>
      </section>

      {/* ── Desglose de comisiones ─────────────────────────────────── */}
      {desglose.bruto > 0 && (
        <section className="space-y-3">
          <p className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Desglose financiero</p>
          <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-5 max-w-md">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-on-surface">Facturación bruta</span>
                <span className="text-[14px] font-bold text-on-surface tabular-nums">{formatCOP(desglose.bruto)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-on-surface-variant">− Comisión Hotmart</span>
                <span className="text-[13px] font-semibold text-on-surface-variant tabular-nums">−{formatCOP(desglose.comisionHotmart)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-on-surface-variant">− Comisión asesores</span>
                <span className="text-[13px] font-semibold text-on-surface-variant tabular-nums">−{formatCOP(desglose.comisionAsesor)}</span>
              </div>
              <div className="border-t border-outline-variant pt-3 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-on-surface">Neto recibido</span>
                <span className="text-[18px] font-bold text-primary tabular-nums">{formatCOP(desglose.neto)}</span>
              </div>
            </div>
            <p className="text-[10px] text-on-surface-variant/70 mt-3">Neto estimado a TRM oficial; puede variar levemente del depósito real de Hotmart.</p>
          </div>
        </section>
      )}

      {/* ── Gráficas de ingresos y asesores ───────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <IngresosMensualesChart periodo="mensual" />
        <RankingAsesores desde={desde} hasta={hasta} periodoLabel={periodoLabel} />
      </section>

      {/* ── Medios de pago ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Medios de pago</p>
          {medios && (
            <span className="text-[11px] text-on-surface-variant">
              {medios.totalCantidad} transacción{medios.totalCantidad !== 1 ? 'es' : ''} · {formatCOP(medios.total)}
            </span>
          )}
        </div>

        {mediosLoading ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-6 animate-pulse h-40" />
        ) : metodos.length === 0 ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-8 flex items-center justify-center">
            <p className="text-sm text-on-surface-variant">Sin pagos registrados en este período</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-4">
              <p className="text-[12px] font-semibold text-on-surface mb-4">Recaudo por medio de pago</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={metodos.map((m, i) => ({ name: m.metodo, monto: m.monto, color: COLORES[i % COLORES.length] }))}
                  margin={{ top: 0, right: 8, left: 8, bottom: 0 }}
                >
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `$${(v / 1_000_000).toFixed(1)}M`} />
                  <Tooltip formatter={(v: number) => [formatCOP(v), 'Recaudo']}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--outline-variant)' }} />
                  <Bar dataKey="monto" radius={[4, 4, 0, 0]}>
                    {metodos.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-4 space-y-2">
              <p className="text-[12px] font-semibold text-on-surface mb-3">Detalle por medio</p>
              <div className="space-y-3">
                {metodos.map((m, i) => (
                  <div key={m.metodo} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORES[i % COLORES.length] }} />
                        <span className="text-[12px] font-medium text-on-surface">{m.metodo}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[12px] font-bold text-on-surface">{formatCOP(m.monto)}</span>
                        <span className="text-[10px] text-on-surface-variant ml-2">{m.cantidad} pago{m.cantidad !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-surface-high overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${m.porcentajeMonto}%`, background: COLORES[i % COLORES.length] }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

    </div>
  )
}
