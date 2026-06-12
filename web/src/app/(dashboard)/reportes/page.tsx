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
import { ColombiaMap } from '@/components/charts/ColombiaMap'
import { MonthPicker, DateRange } from '@/components/ui/MonthPicker'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// ── Helpers fecha ─────────────────────────────────────────────────────────────
function toISO(d: Date) { return format(d, 'yyyy-MM-dd') }
function getRangeFromMonth(month: string | null): { desde: string; hasta: string } {
  const base = month ? new Date(month + '-15') : new Date()
  return { desde: toISO(startOfMonth(base)), hasta: toISO(endOfMonth(base)) }
}

interface FuenteItem { fuente: string; cantidad: number; porcentaje: number }
interface MarketingData { total: number; fuentes: FuenteItem[] }
interface MedioPagoItem { metodo: string; cantidad: number; monto: number; porcentajeMonto: number; porcentajeCantidad: number }
interface MediosPagoData { total: number; totalCantidad: number; metodos: MedioPagoItem[]; periodo: string }
interface DemografiaItem { nombre: string; departamento?: string | null; cantidad: number; porcentaje: number }
interface DemografiaData { departamentos: DemografiaItem[]; ciudades: DemografiaItem[]; totalDep: number; totalCiu: number }
interface DashboardData {
  estudiantes: { total: number; nuevosMes: number }
  cobranza: { porCobrar: { monto: number; cantidad: number }; vencida: { monto: number; cantidad: number }; cobrado: { monto: number; cantidad: number }; pendiente: { monto: number; cantidad: number } }
}

const COLORES      = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6','#f97316']
const COLORES_MKT  = ['#e11d48','#7c3aed','#0ea5e9','#16a34a','#f59e0b','#0d9488','#db2777','#65a30d','#ea580c']

const COLOR_CANAL: Array<{ match: string; color: string }> = [
  { match: 'Instagram', color: '#C13584' },
  { match: 'TikTok',    color: '#010101' },
  { match: 'YouTube',   color: '#FF0000' },
  { match: 'Facebook',  color: '#1877F2' },
  { match: 'Google',    color: '#4285F4' },
  { match: 'Referido',  color: '#16a34a' },
]
function colorCanal(fuente: string, idx: number): string {
  const match = COLOR_CANAL.find(c => fuente.includes(c.match))
  return match?.color ?? COLORES_MKT[idx % COLORES_MKT.length]
}

function etiquetaCorta(fuente: string): string {
  const m: Record<string, string> = {
    'Vi un video con link a WhatsApp en Instagram':              'IG Link',
    'Vi un video en Instagram y escribí al perfil o número del video': 'IG Perfil',
    'Vi un video con link a WhatsApp en TikTok':                'TikTok Link',
    'Vi un video en TikTok y escribí al perfil o número del video':    'TikTok Perfil',
    'Vi un video con link a WhatsApp en Facebook':              'FB Link',
    'Vi un video en Facebook y escribí al perfil o número del video':  'FB Perfil',
    'Vi un anuncio en YouTube y le di clic':                    'YouTube',
    'Los encontré en el buscador de Google':                    'Google',
    'Me lo recomendó un amigo, familiar o conocido':            'Referido',
  }
  return m[fuente] ?? fuente.slice(0, 14)
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

  const fetcher = async () => {
    const token = await getClientToken()
    return createClientFetcher(token ?? '')
  }

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['reportes-dashboard', desde, hasta],
    queryFn: async () => (await fetcher())<{ data: DashboardData }>(`/reportes/dashboard?desde=${desde}&hasta=${hasta}`),
    staleTime: 30_000,
  })

  const { data: mktData, isLoading: mktLoading } = useQuery({
    queryKey: ['reportes-marketing'],
    queryFn: async () => (await fetcher())<{ data: MarketingData }>('/reportes/marketing'),
    staleTime: 30_000,
  })

  const { data: mediosData, isLoading: mediosLoading } = useQuery({
    queryKey: ['reportes-medios-pago', desde, hasta],
    queryFn: async () => (await fetcher())<{ data: MediosPagoData }>(`/reportes/medios-pago?desde=${desde}&hasta=${hasta}`),
    staleTime: 30_000,
  })

  const { data: demografiaData, isLoading: demografiaLoading } = useQuery({
    queryKey: ['reportes-demografia'],
    queryFn: async () => (await fetcher())<{ data: DemografiaData }>('/reportes/demografia'),
    staleTime: 30_000,
  })

  const d = dashData?.data
  const est      = d?.estudiantes ?? { total: 0, nuevosMes: 0 }
  const cobranza = d?.cobranza   ?? { porCobrar: { monto: 0, cantidad: 0 }, vencida: { monto: 0, cantidad: 0 }, cobrado: { monto: 0, cantidad: 0 }, pendiente: { monto: 0, cantidad: 0 } }

  const mkt     = mktData?.data
  const fuentes = mkt?.fuentes ?? []

  const medios  = mediosData?.data
  const metodos = medios?.metodos ?? []

  const demografia    = demografiaData?.data
  const departamentos = demografia?.departamentos ?? []
  const ciudades      = demografia?.ciudades      ?? []

  const COLOR_DEPT: Record<string, string> = {
    'Antioquia':'#16a34a','Cundinamarca':'#2563eb','Valle del Cauca':'#9333ea','Atlántico':'#f97316',
    'Santander':'#FFCC00','Bolívar':'#be185d','Tolima':'#92400e','Cauca':'#0891b2','Boyacá':'#e11d48',
    'Norte de Santander':'#0d9488','Nariño':'#7c3aed','Córdoba':'#ea580c','Huila':'#65a30d',
    'Meta':'#0284c7','Risaralda':'#d97706','Caldas':'#dc2626','Quindío':'#059669','Magdalena':'#7e22ce',
    'Cesar':'#b45309','Sucre':'#0369a1','Chocó':'#15803d','La Guajira':'#c2410c','Putumayo':'#4f46e5',
    'Caquetá':'#a21caf','Arauca':'#84cc16','Vichada':'#06b6d4','Guainía':'#f43f5e','Vaupés':'#8b5cf6',
    'Amazonas':'#10b981','San Andrés':'#fb923c','Casanare':'#6366f1','Guaviare':'#84cc16',
  }
  const COLORES_DEMO = ['#2563eb','#dc2626','#16a34a','#9333ea','#f97316','#0891b2','#ca8a04','#be185d','#047857']
  function colorDept(nombre: string, idx: number): string {
    return COLOR_DEPT[nombre] ?? COLORES_DEMO[idx % COLORES_DEMO.length]
  }

  const deptColorMap = Object.fromEntries(departamentos.map((dep, i) => [dep.nombre, colorDept(dep.nombre, i)]))
  function colorCiudad(departamento: string | null | undefined, idx: number): string {
    if (departamento && deptColorMap[departamento]) return deptColorMap[departamento]
    return COLORES_DEMO[idx % COLORES_DEMO.length]
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader title="Reportes" subtitle="Estadísticas globales de la operación" />
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
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
          <KpiCard title="Por cobrar" value={formatCOP(cobranza.porCobrar.monto)}
            rawValue={cobranza.porCobrar.monto} formatValue={formatCOP}
            subtitle={`${cobranza.porCobrar.cantidad} pendientes`}
            icon="Wallet" variant="warning" isLoading={isLoading} />
          <KpiCard title="En mora" value={formatCOP(cobranza.vencida.monto)}
            rawValue={cobranza.vencida.monto}   formatValue={formatCOP}
            subtitle={`${cobranza.vencida.cantidad} vencidos`}
            icon="AlertTriangle" variant="error" isLoading={isLoading} />
        </div>
      </section>

      {/* ── Gráficas de ingresos y asesores ───────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <IngresosMensualesChart periodo="mensual" />
        <RankingAsesores />
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

      {/* ── Marketing — Fuentes de contacto ───────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Marketing — Fuentes de contacto</p>
          {mkt && (
            <span className="text-[11px] text-on-surface-variant">
              {mkt.total} estudiante{mkt.total !== 1 ? 's' : ''} con fuente registrada
            </span>
          )}
        </div>

        {mktLoading ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-6 animate-pulse h-56" />
        ) : fuentes.length === 0 ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-8 flex flex-col items-center justify-center text-on-surface-variant">
            <p className="text-sm">Sin datos de fuentes de contacto aún</p>
            <p className="text-xs mt-1 opacity-60">Se registran automáticamente con cada compra en Hotmart</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-4">
              <p className="text-[12px] font-semibold text-on-surface mb-4">Inscripciones por canal</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={fuentes.map((f, i) => ({ name: etiquetaCorta(f.fuente), cantidad: f.cantidad, color: colorCanal(f.fuente, i) }))}
                  margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [v, 'Estudiantes']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--outline-variant)' }} />
                  <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>
                    {fuentes.map((f, i) => <Cell key={i} fill={colorCanal(f.fuente, i)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-4 space-y-2">
              <p className="text-[12px] font-semibold text-on-surface mb-3">Detalle por fuente</p>
              <div className="space-y-2.5">
                {fuentes.map((f, i) => (
                  <div key={f.fuente} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colorCanal(f.fuente, i) }} />
                        <span className="text-[11px] text-on-surface truncate">{f.fuente}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-[11px] font-bold text-on-surface">{f.cantidad}</span>
                        <span className="text-[10px] text-on-surface-variant w-8 text-right">{f.porcentaje}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-surface-high overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${f.porcentaje}%`, background: colorCanal(f.fuente, i) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Demografía — Origen de clientes ───────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Demografía — Origen de clientes</p>
          {demografia && (
            <span className="text-[11px] text-on-surface-variant">
              {demografia.totalDep} estudiantes con ubicación registrada
            </span>
          )}
        </div>

        {demografiaLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-6 animate-pulse h-64" />
            <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-6 animate-pulse h-64" />
          </div>
        ) : departamentos.length === 0 ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-8 flex flex-col items-center justify-center text-on-surface-variant">
            <p className="text-sm">Sin datos de ubicación aún</p>
            <p className="text-xs mt-1 opacity-60">Se registran al crear o importar estudiantes con ciudad/departamento</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Mapa coroplético de Colombia */}
            <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-4">
              <p className="text-[12px] font-semibold text-on-surface mb-3">Por departamento</p>
              <ColombiaMap departamentos={departamentos} totalDep={demografia?.totalDep ?? 0} />
            </div>

            {/* Top 10 ciudades — ranking con barras de progreso */}
            <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-4 flex flex-col">
              <p className="text-[12px] font-semibold text-on-surface mb-4">Top 10 ciudades</p>
              <div className="flex-1 flex flex-col justify-end space-y-3">
                {(() => {
                  const maxCiudad = Math.max(...ciudades.map(c => c.cantidad), 1)
                  return ciudades.map((c, i) => {
                    const color = colorCiudad(c.departamento, i)
                    return (
                      <div key={c.nombre} className="flex items-center gap-3">
                        <span className="text-[11px] font-bold tabular-nums text-on-surface-variant w-5 text-right flex-shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[12px] font-medium text-on-surface truncate">{c.nombre}</span>
                            <span className="text-[11px] text-on-surface-variant flex-shrink-0">
                              <span className="font-bold text-on-surface">{c.cantidad}</span>
                              {' '}estudiante{c.cantidad !== 1 ? 's' : ''} · {c.porcentaje}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-surface-high overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max((c.cantidad / maxCiudad) * 100, 4)}%`, background: color }} />
                          </div>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
              {ciudades.length > 0 && ciudades[0].departamento !== undefined && (
                <p className="text-[10px] text-on-surface-variant/60 mt-4">
                  El color de cada ciudad corresponde a su departamento
                </p>
              )}
            </div>

          </div>
        )}
      </section>
    </div>
  )
}
