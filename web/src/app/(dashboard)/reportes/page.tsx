'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { KpiCard } from '@/components/ui/KpiCard'
import { formatCOP, cn } from '@/lib/utils'
import { IngresosMensualesChart } from '@/components/charts/IngresosMensualesChart'
import { RankingAsesores } from '@/components/charts/RankingAsesores'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'

type Periodo = 'diario' | 'semanal' | 'mensual'

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'diario',   label: 'Diario'   },
  { key: 'semanal',  label: 'Semanal'  },
  { key: 'mensual',  label: 'Mensual'  },
]

interface DashboardData {
  estudiantes: { total: number; nuevosMes: number }
  cobranza: {
    porCobrar: { monto: number; cantidad: number }
    vencida:   { monto: number; cantidad: number }
    cobrado:   { monto: number; cantidad: number }
    pendiente: { monto: number; cantidad: number }
  }
}

interface FuenteItem {
  fuente:     string
  cantidad:   number
  porcentaje: number
}

interface MarketingData {
  total:   number
  fuentes: FuenteItem[]
}

interface MedioPagoItem {
  metodo:             string
  cantidad:           number
  monto:              number
  porcentajeMonto:    number
  porcentajeCantidad: number
}

interface MediosPagoData {
  total:         number
  totalCantidad: number
  metodos:       MedioPagoItem[]
  periodo:       string
}

interface DemografiaItem {
  nombre:     string
  cantidad:   number
  porcentaje: number
}

interface DemografiaData {
  departamentos: DemografiaItem[]
  ciudades:      DemografiaItem[]
  totalDep:      number
  totalCiu:      number
}

const COLORES      = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6','#f97316']
// Paleta cálida/terrosa para Marketing — fuentes de contacto
const COLORES_MKT  = ['#f97316','#f59e0b','#eab308','#ef4444','#fb923c','#fbbf24','#dc2626','#d97706','#c2410c']
// Paleta fría/teal-azul para Demografía — departamentos y ciudades
const COLORES_DEMO = ['#0ea5e9','#06b6d4','#14b8a6','#10b981','#22c55e','#3b82f6','#6366f1','#0284c7','#0891b2']

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

// Etiquetas dinámicas según período
const labelNuevos: Record<Periodo, string> = {
  diario:  'Nuevos hoy',
  semanal: 'Nuevos esta semana',
  mensual: 'Nuevos este mes',
}
const labelRecaudado: Record<Periodo, string> = {
  diario:  'Recaudado hoy',
  semanal: 'Recaudado esta semana',
  mensual: 'Recaudado este mes',
}

export default function ReportesPage() {
  const [periodo, setPeriodo] = useState<Periodo>('mensual')

  const fetcher = async () => {
    const token = await getClientToken()
    return createClientFetcher(token ?? '')
  }

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['reportes-dashboard', periodo],
    queryFn: async () => (await fetcher())<{ data: DashboardData }>(`/reportes/dashboard?periodo=${periodo}`),
    staleTime: 30_000,
  })

  const { data: mktData, isLoading: mktLoading } = useQuery({
    queryKey: ['reportes-marketing'],
    queryFn: async () => (await fetcher())<{ data: MarketingData }>('/reportes/marketing'),
    staleTime: 60_000,
  })

  const { data: mediosData, isLoading: mediosLoading } = useQuery({
    queryKey: ['reportes-medios-pago', periodo],
    queryFn: async () => (await fetcher())<{ data: MediosPagoData }>(`/reportes/medios-pago?periodo=${periodo}`),
    staleTime: 30_000,
  })

  const { data: demografiaData, isLoading: demografiaLoading } = useQuery({
    queryKey: ['reportes-demografia'],
    queryFn: async () => (await fetcher())<{ data: DemografiaData }>('/reportes/demografia'),
    staleTime: 5 * 60_000,
  })

  const d = dashData?.data
  const est      = d?.estudiantes ?? { total: 0, nuevosMes: 0 }
  const cobranza = d?.cobranza   ?? { porCobrar: { monto: 0, cantidad: 0 }, vencida: { monto: 0, cantidad: 0 }, cobrado: { monto: 0, cantidad: 0 }, pendiente: { monto: 0, cantidad: 0 } }

  const mkt     = mktData?.data
  const fuentes = mkt?.fuentes ?? []

  const medios  = mediosData?.data
  const metodos = medios?.metodos ?? []

  // metodo es String libre desde la migración del enum → String
  // Los valores reales son: 'Bancolombia', 'Bre-B', 'Nequi', 'Tarjeta', 'Otro'
  // Se muestra directamente m.metodo sin mapeo

  const demografia    = demografiaData?.data
  const departamentos = demografia?.departamentos ?? []
  const ciudades      = demografia?.ciudades      ?? []

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Reportes" subtitle="Estadísticas globales de la operación" />

      {/* ── Tabs de período ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-0.5 rounded-xl bg-surface-high border border-outline-variant/40 w-fit">
        {PERIODOS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriodo(p.key)}
            className={cn(
              'px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer',
              periodo === p.key
                ? 'bg-surface-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Estudiantes ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Estudiantes</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard title="Total registrados" value={est.total.toLocaleString('es-CO')}
            rawValue={est.total} icon="Users" variant="default" isLoading={isLoading} />
          <KpiCard title={labelNuevos[periodo]} value={`+${est.nuevosMes}`}
            rawValue={est.nuevosMes} icon="UserPlus" variant="success" isLoading={isLoading} />
        </div>
      </section>

      {/* ── Cobranza ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Cobranza</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard title={labelRecaudado[periodo]} value={formatCOP(cobranza.cobrado.monto)}
            rawValue={cobranza.cobrado.monto}   formatValue={formatCOP}
            subtitle={`${cobranza.cobrado.cantidad} cobros`}
            icon="TrendingUp" variant="success" isLoading={isLoading} />
          <KpiCard title="Por cobrar" value={formatCOP(cobranza.porCobrar.monto)}
            rawValue={cobranza.porCobrar.monto} formatValue={formatCOP}
            subtitle={`${cobranza.porCobrar.cantidad} pendientes`}
            icon="Wallet" variant="warning" isLoading={isLoading} />
          <KpiCard title="En mora"    value={formatCOP(cobranza.vencida.monto)}
            rawValue={cobranza.vencida.monto}   formatValue={formatCOP}
            subtitle={`${cobranza.vencida.cantidad} vencidos`}
            icon="AlertTriangle" variant="error" isLoading={isLoading} />
        </div>
      </section>

      {/* ── Gráficas de ingresos y asesores ───────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <IngresosMensualesChart periodo={periodo} />
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
            {/* Gráfica de barras por monto */}
            <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-4">
              <p className="text-[12px] font-semibold text-on-surface mb-4">Recaudo por medio de pago</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={metodos.map((m, i) => ({
                    name:  m.metodo,
                    monto: m.monto,
                    color: COLORES[i % COLORES.length],
                  }))}
                  margin={{ top: 0, right: 8, left: 8, bottom: 0 }}
                >
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `$${(v / 1_000_000).toFixed(1)}M`} />
                  <Tooltip
                    formatter={(v: number) => [formatCOP(v), 'Recaudo']}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--outline-variant)' }}
                  />
                  <Bar dataKey="monto" radius={[4, 4, 0, 0]}>
                    {metodos.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Lista detallada */}
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
            <p className="text-xs mt-1 opacity-60">Se registran automáticamente al completar el formulario Typeform</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-4">
              <p className="text-[12px] font-semibold text-on-surface mb-4">Inscripciones por canal</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={fuentes.map((f, i) => ({ name: etiquetaCorta(f.fuente), cantidad: f.cantidad, color: COLORES_MKT[i % COLORES_MKT.length] }))}
                  margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(v: number) => [v, 'Estudiantes']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--outline-variant)' }}
                  />
                  <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>
                    {fuentes.map((_, i) => <Cell key={i} fill={COLORES_MKT[i % COLORES_MKT.length]} />)}
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
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORES_MKT[i % COLORES_MKT.length] }} />
                        <span className="text-[11px] text-on-surface truncate">{f.fuente}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-[11px] font-bold text-on-surface">{f.cantidad}</span>
                        <span className="text-[10px] text-on-surface-variant w-8 text-right">{f.porcentaje}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-surface-high overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${f.porcentaje}%`, background: COLORES_MKT[i % COLORES_MKT.length] }} />
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

            {/* Donut — Departamentos */}
            <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-4">
              <p className="text-[12px] font-semibold text-on-surface mb-4">Por departamento</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={departamentos}
                    dataKey="cantidad"
                    nameKey="nombre"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {departamentos.map((_, i) => (
                      <Cell key={i} fill={COLORES_DEMO[i % COLORES_DEMO.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, name: string) => [`${v} estudiantes`, name]}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--outline-variant)' }}
                  />
                  <Legend
                    formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>}
                    iconSize={8}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Horizontal bar — Top 10 ciudades */}
            <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-4">
              <p className="text-[12px] font-semibold text-on-surface mb-4">Top 10 ciudades</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  layout="vertical"
                  data={ciudades}
                  margin={{ left: 8, right: 24, top: 0, bottom: 0 }}
                >
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="nombre"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={90}
                  />
                  <Tooltip
                    formatter={(v: number) => [`${v} estudiantes`, 'Cantidad']}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--outline-variant)' }}
                  />
                  <Bar dataKey="cantidad" radius={[0, 4, 4, 0]}>
                    {ciudades.map((_, i) => (
                      <Cell key={i} fill={COLORES_DEMO[i % COLORES_DEMO.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

          </div>
        )}
      </section>
    </div>
  )
}
