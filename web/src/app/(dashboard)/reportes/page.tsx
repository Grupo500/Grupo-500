'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCOP } from '@/lib/utils'
import { IngresosMensualesChart } from '@/components/charts/IngresosMensualesChart'
import { RankingAsesores } from '@/components/charts/RankingAsesores'
import { CursosVendidosRanked } from '@/components/charts/CursosVendidosRanked'
import { MonthPicker, DateRange } from '@/components/ui/MonthPicker'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'
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

// ── Hook count-up (mismo que EstudiantesMes) ──────────────────────────────────
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0)
  const rafRef   = useRef<number | null>(null)
  const prevRef  = useRef(0)

  useEffect(() => {
    if (target === 0) { setValue(0); return }
    const start     = prevRef.current
    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed  = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased    = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(start + (target - start) * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
      else prevRef.current = target
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return value
}


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

  const { data: session } = useSession()
  const isAsesor = (session?.user as { role?: string } | undefined)?.role === 'VENDEDOR'

  const fetcher = async () => {
    const token = await getClientToken()
    return createClientFetcher(token ?? '')
  }

  const queryClient = useQueryClient()
  const sincronizarHubspotMutation = useMutation({
    mutationFn: async () => (await fetcher())<any>('/hubspot/sincronizar', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ranking-asesores'] }),
    onError: () => {}, // sincronización silenciosa en segundo plano — no interrumpe al usuario
  })

  // Sincronización automática de leads de HubSpot al entrar (solo admin, sin botón visible)
  useEffect(() => {
    if (!isAsesor) sincronizarHubspotMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAsesor])

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

  // Count-up para cada métrica
  const animTotal      = useCountUp(isLoading ? 0 : est.total)
  const animNuevos     = useCountUp(isLoading ? 0 : est.nuevosMes)
  const animMonto      = useCountUp(isLoading ? 0 : cobranza.cobrado.monto)
  const animTxs        = useCountUp(isLoading ? 0 : cobranza.cobrado.cantidad)
  const animBruto      = useCountUp(isLoading ? 0 : desglose.bruto)
  const animHotmart    = useCountUp(isLoading ? 0 : desglose.comisionHotmart)
  const animAsesor     = useCountUp(isLoading ? 0 : desglose.comisionAsesor)
  const animNeto       = useCountUp(isLoading ? 0 : desglose.neto)

  const medios  = mediosData?.data
  const metodos = medios?.metodos ?? []

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader
          title={isAsesor ? 'Mis analíticas' : 'Analíticas'}
          subtitle={isAsesor ? 'Estadísticas de tu gestión' : 'Estadísticas globales de la operación'}
        />
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
              <p className="text-[11px] text-on-surface-variant mb-1">{isAsesor ? 'Mis estudiantes' : 'Total registrados'}</p>
              {isLoading
                ? <div className="h-8 w-16 rounded bg-surface-high animate-pulse" />
                : <p className="text-[26px] font-bold text-on-surface tabular-nums leading-none animate-fade-in">
                    {animTotal.toLocaleString('es-CO')}
                  </p>}
            </div>
            <div className="bg-outline-variant h-12" />
            <div>
              <p className="text-[11px] text-on-surface-variant mb-1 flex items-center gap-1">
                <UserPlus className="w-3 h-3" /> Nuevos en el período
              </p>
              {isLoading
                ? <div className="h-8 w-12 rounded bg-surface-high animate-pulse" />
                : <p className="text-[26px] font-bold tabular-nums leading-none animate-fade-in" style={{ color: '#16a34a' }}>
                    +{animNuevos}
                  </p>}
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
              {isLoading
                ? <div className="h-7 w-36 rounded bg-surface-high animate-pulse" />
                : <p className="text-[22px] font-bold tabular-nums leading-none animate-fade-in" style={{ color: '#16a34a' }}>
                    {formatCOP(animMonto)}
                  </p>}
            </div>
            <div className="bg-outline-variant h-12" />
            <div>
              <p className="text-[11px] text-on-surface-variant mb-1 flex items-center gap-1">
                <Receipt className="w-3 h-3" /> Transacciones
              </p>
              {isLoading
                ? <div className="h-8 w-10 rounded bg-surface-high animate-pulse" />
                : <p className="text-[26px] font-bold text-on-surface tabular-nums leading-none animate-fade-in">
                    {animTxs}
                  </p>}
            </div>
          </div>
        </div>
      </div>

      {/* ── FILA 2: Ingresos mensuales (70%) + Desglose financiero (30%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 lg:items-stretch">
        <div className="lg:col-span-7">
          <IngresosMensualesChart desde={desde} hasta={hasta} periodoLabel={periodoLabel} />
        </div>
        <div className="lg:col-span-3">
          <div className="card p-5 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'var(--primary-container)' }}>
                <Wallet className="w-3.5 h-3.5 text-primary" />
              </div>
              <h3 className="text-[13px] font-semibold text-on-surface">{isAsesor ? 'Mi comisión' : 'Desglose del mes'}</h3>
            </div>
            {isLoading
              ? <div className="space-y-3 flex-1">
                  {[1,2,3,4].map(i => <div key={i} className="h-5 rounded bg-surface-high animate-pulse" />)}
                </div>
              : isAsesor
                ? <div className="space-y-3 flex-1 flex flex-col justify-center animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-on-surface-variant">Mis ventas brutas</span>
                      <span className="text-[13px] font-bold text-on-surface tabular-nums">{formatCOP(animBruto)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-on-surface-variant">% de comisión</span>
                      <span className="text-[12px] font-semibold tabular-nums text-on-surface">
                        {desglose.bruto > 0 ? Math.round((desglose.comisionAsesor / desglose.bruto) * 100) : 0}%
                      </span>
                    </div>
                    <div className="border-t border-outline-variant pt-3 flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-on-surface">Mi comisión ganada</span>
                      <span className="text-[18px] font-bold tabular-nums" style={{ color: '#16a34a' }}>
                        {formatCOP(animAsesor)}
                      </span>
                    </div>
                  </div>
                : <div className="space-y-3 flex-1 flex flex-col justify-center animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-on-surface-variant">Facturación bruta</span>
                      <span className="text-[13px] font-bold text-on-surface tabular-nums">{formatCOP(animBruto)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-on-surface-variant flex items-center gap-1">
                        <Landmark className="w-3 h-3" /> Comisión Hotmart
                      </span>
                      <span className="text-[12px] font-semibold tabular-nums" style={{ color: '#d97706' }}>
                        −{formatCOP(animHotmart)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-on-surface-variant flex items-center gap-1">
                        <Users className="w-3 h-3" /> Comisión asesores
                      </span>
                      <span className="text-[12px] font-semibold tabular-nums" style={{ color: '#dc2626' }}>
                        −{formatCOP(animAsesor)}
                      </span>
                    </div>
                    <div className="border-t border-outline-variant pt-3 flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-on-surface">Neto recibido</span>
                      <span className="text-[18px] font-bold tabular-nums" style={{ color: '#16a34a' }}>
                        {formatCOP(animNeto)}
                      </span>
                    </div>
                  </div>}
            {!isAsesor && (
              <p className="text-[9px] text-on-surface-variant/70 mt-3 leading-tight">
                Neto estimado a TRM oficial; puede variar levemente del depósito real de Hotmart.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── FILA 3: Cursos más vendidos (ancho completo) ────────────── */}
      <CursosVendidosRanked desde={desde} hasta={hasta} />

      {/* ── FILA 4: Medios de pago (ancho completo) ─────────────────── */}
      <div className="card p-5">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <p className="text-[13px] font-semibold text-on-surface">Medios de pago</p>
            {medios && (
              <span className="text-[11px] text-on-surface-variant">
                {medios.totalCantidad} transacción{medios.totalCantidad !== 1 ? 'es' : ''}
              </span>
            )}
          </div>
          {medios && (
            <p className="text-[11px] text-on-surface-variant mb-4">{formatCOP(medios.total)}</p>
          )}

          {mediosLoading ? (
            <div className="h-52 rounded-xl bg-surface-high animate-pulse" />
          ) : metodos.length === 0 ? (
            <p className="text-[13px] text-on-surface-variant text-center py-6">Sin pagos registrados en este período</p>
          ) : (
            <div className="animate-fade-in">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={metodos.map(m => ({ ...m, pct: Math.round(m.porcentajeMonto) }))}
                  margin={{ top: 6, right: 4, left: -16, bottom: 4 }}
                  barSize={22}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--outline-variant)" />
                  <XAxis dataKey="metodo" tick={false} axisLine={false} tickLine={false} height={4} />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => `${v}%`}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--primary)', fillOpacity: 0.08, radius: 6 }}
                    formatter={(v: number) => [`${v}%`, 'Participación']}
                    labelStyle={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface)' }}
                    contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid var(--outline-variant)', background: 'var(--surface-lowest)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    itemStyle={{ color: 'var(--on-surface)' }}
                  />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Bar dataKey="pct" radius={[6, 6, 0, 0]} background={{ radius: 6, fill: 'var(--surface-high)' } as any}>
                    {metodos.map((m, i) => (
                      <Cell key={m.metodo} fill={COLORES[i % COLORES.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Leyenda vertical */}
              <div className="flex flex-col gap-1.5 mt-5 pt-4 border-t border-outline-variant">
                {metodos.map((m, i) => (
                  <div key={m.metodo} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: COLORES[i % COLORES.length] }} />
                    <span className="text-[11px] text-on-surface flex-1">{m.metodo}</span>
                    <span className="text-[11px] font-semibold text-on-surface tabular-nums">{Math.round(m.porcentajeMonto)}%</span>
                    <span className="text-[10px] text-on-surface-variant tabular-nums">{m.cantidad} pago{m.cantidad !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>

      {/* ── FILA 5: Ranking asesores (ancho completo) ─────────────── */}
      <RankingAsesores desde={desde} hasta={hasta} periodoLabel={periodoLabel} />
    </div>
  )
}
