'use client'

export const dynamic = 'force-dynamic'

import { useQuery } from '@tanstack/react-query'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { KpiCard } from '@/components/ui/KpiCard'
import { formatCOP, cn } from '@/lib/utils'
import { IngresosMensualesChart } from '@/components/charts/IngresosMensualesChart'
import { RankingAsesores } from '@/components/charts/RankingAsesores'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

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

// Paleta de colores para las barras
const COLORES = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6','#f97316']

// Etiquetas cortas para el gráfico
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
  const fetcher = async () => {
    const token = await getClientToken()
    return createClientFetcher(token ?? '')
  }

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['reportes-dashboard'],
    queryFn: async () => (await fetcher())<{ data: DashboardData }>('/reportes/dashboard'),
    staleTime: 60_000,
  })

  const { data: mktData, isLoading: mktLoading } = useQuery({
    queryKey: ['reportes-marketing'],
    queryFn: async () => (await fetcher())<{ data: MarketingData }>('/reportes/marketing'),
    staleTime: 60_000,
  })

  const d = dashData?.data
  const est      = d?.estudiantes ?? { total: 0, nuevosMes: 0 }
  const cobranza = d?.cobranza   ?? { porCobrar: { monto: 0, cantidad: 0 }, vencida: { monto: 0, cantidad: 0 }, cobrado: { monto: 0, cantidad: 0 }, pendiente: { monto: 0, cantidad: 0 } }

  const mkt     = mktData?.data
  const fuentes = mkt?.fuentes ?? []

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Reportes" subtitle="Estadísticas globales de la operación" />

      {/* ── Estudiantes ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Estudiantes</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard title="Total registrados" value={est.total.toLocaleString('es-CO')}
            rawValue={est.total} icon="Users" variant="default" isLoading={isLoading} />
          <KpiCard title="Nuevos este mes"   value={`+${est.nuevosMes}`}
            rawValue={est.nuevosMes} icon="UserPlus" variant="success" isLoading={isLoading} />
        </div>
      </section>

      {/* ── Cobranza ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Cobranza</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard title="Recaudado"  value={formatCOP(cobranza.cobrado.monto)}
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
        <IngresosMensualesChart />
        <RankingAsesores />
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
            {/* Gráfica de barras */}
            <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-4">
              <p className="text-[12px] font-semibold text-on-surface mb-4">Inscripciones por canal</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={fuentes.map((f, i) => ({ name: etiquetaCorta(f.fuente), cantidad: f.cantidad, color: COLORES[i % COLORES.length] }))}
                  margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(v: number) => [v, 'Estudiantes']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--outline-variant)' }}
                  />
                  <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>
                    {fuentes.map((_, i) => (
                      <Cell key={i} fill={COLORES[i % COLORES.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Lista detallada con porcentajes */}
            <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-4 space-y-2">
              <p className="text-[12px] font-semibold text-on-surface mb-3">Detalle por fuente</p>
              <div className="space-y-2.5">
                {fuentes.map((f, i) => (
                  <div key={f.fuente} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORES[i % COLORES.length] }} />
                        <span className="text-[11px] text-on-surface truncate">{f.fuente}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-[11px] font-bold text-on-surface">{f.cantidad}</span>
                        <span className="text-[10px] text-on-surface-variant w-8 text-right">{f.porcentaje}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-surface-high overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${f.porcentaje}%`, background: COLORES[i % COLORES.length] }} />
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
