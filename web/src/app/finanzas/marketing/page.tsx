'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { MonthPicker, type DateRange } from '@/components/ui/MonthPicker'
import { formatCOP } from '@/lib/utils'
import { rangoDelMes, nombreMes, numero, pct } from '@/components/finanzas/comunes'
import { Info, Megaphone } from 'lucide-react'

interface MarketingData {
  hayInversionCargada: boolean
  inversion: number
  plataformas: { plataforma: string; gasto: number }[]
  clientesNuevos: number
  valorVendido: number
  netoRecibido: number
  cac: number | null
  mer: number | null
  campanias: {
    id: string; plataforma: string; campania: string; estado: string | null
    desde: string; hasta: string; gastoCOP: number
    impresiones: number; clics: number; ctr: number | null; cpc: number | null
    conversiones: number
  }[]
  cohortes: { cohorte: string; clientes: number; neto: number; ltv: number; enFormacion: boolean }[]
}

const COLOR_PLATAFORMA: Record<string, string> = {
  GOOGLE: '#4285f4', META: '#0866ff', TIKTOK: '#ee1d52',
}
const NOMBRE_PLATAFORMA: Record<string, string> = {
  GOOGLE: 'Google Ads', META: 'Meta Ads', TIKTOK: 'TikTok Ads',
}

export default function MarketingPage() {
  const [mes, setMes] = useState<string | null>(null)
  const [rango, setRango] = useState<DateRange | null>(null)
  const [plataforma, setPlataforma] = useState<string | null>(null)
  const { desde, hasta } = rangoDelMes(mes)
  const mesActual = new Date().toISOString().slice(0, 7)

  const { data, isLoading } = useQuery({
    queryKey: ['finanzas-marketing', desde, hasta],
    queryFn: async () => apiFetch(`/finanzas/marketing?desde=${desde}&hasta=${hasta}`) as Promise<{ data: MarketingData }>,
    staleTime: 60_000,
  })

  const d = data?.data
  const plataformasConGasto = d?.plataformas ?? []
  const activa = plataforma ?? plataformasConGasto[0]?.plataforma ?? null
  const campanias = (d?.campanias ?? []).filter(c => !activa || c.plataforma === activa)
  const maxGasto = Math.max(...plataformasConGasto.map(p => p.gasto), 1)

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Marketing, CAC y LTV"
        subtitle={`Inversión publicitaria y su relación con las ventas · ${nombreMes((mes ?? desde).slice(0, 7))}`}
        actions={
          <MonthPicker
            value={mes} currentMonth={mesActual} dateRange={rango}
            onChange={(m, r) => { setMes(m); setRango(r) }}
            alignRight
          />
        }
      />

      {/* Advertencia permanente: el gasto se prorratea, no viene por día */}
      <div className="flex items-start gap-2.5 rounded-xl bg-surface-low p-3.5">
        <Info className="w-4 h-4 text-on-surface-variant shrink-0 mt-0.5" />
        <p className="text-[12px] text-on-surface-variant leading-relaxed">
          El gasto mensual es una estimación: los reportes de las plataformas no traen gasto por día,
          así que se reparte entre los días del período declarado. Las conversiones que declaran las
          plataformas no se usan para el CAC — no hay atribución real entre el clic y la venta.
        </p>
      </div>

      {!isLoading && d && !d.hayInversionCargada ? (
        <div className="card p-8 text-center">
          <div className="w-11 h-11 rounded-xl bg-[var(--primary-container)] flex items-center justify-center mx-auto mb-3">
            <Megaphone className="w-5 h-5 text-primary" />
          </div>
          <p className="text-[15px] font-semibold text-on-surface">Todavía no hay inversión cargada</p>
          <p className="text-[13px] text-on-surface-variant mt-1 max-w-md mx-auto">
            Sin el gasto de Google, Meta y TikTok no se pueden calcular el CAC ni el MER.
            Se cargan desde Parámetros, o llegarán solas cuando conectemos las APIs.
          </p>
          <Link
            href="/finanzas/parametros"
            className="inline-block mt-4 px-4 py-2 rounded-lg bg-primary text-white text-[13px] font-semibold hover:opacity-90 transition-opacity"
          >
            Cargar inversión
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { e: 'Inversión publicitaria', v: formatCOP(d?.inversion ?? 0) },
              {
                e: 'CAC blended',
                v: d?.cac !== null && d?.cac !== undefined ? formatCOP(d.cac) : 'Sin dato',
                n: 'Coste de adquirir un cliente',
              },
              {
                e: 'MER',
                v: d?.mer !== null && d?.mer !== undefined ? `${d.mer.toFixed(2).replace('.', ',')}x` : 'Sin dato',
                n: 'Valor vendido sobre inversión. No es retorno atribuido.',
              },
              { e: 'Clientes nuevos', v: numero(d?.clientesNuevos ?? 0) },
            ].map(k => (
              <div key={k.e} className="card p-4">
                <p className="text-[11.5px] font-medium text-on-surface-variant">{k.e}</p>
                <p className="text-[22px] font-bold tabular-nums text-on-surface mt-1">{isLoading ? '—' : k.v}</p>
                {k.n && <p className="text-[10.5px] text-on-surface-variant mt-1 leading-snug">{k.n}</p>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Inversión por plataforma */}
            <div className="card p-5">
              <h3 className="text-[15px] font-semibold text-on-surface mb-4">Inversión por plataforma</h3>
              {plataformasConGasto.length === 0 ? (
                <p className="text-[13px] text-on-surface-variant text-center py-6">Sin gasto en este período</p>
              ) : (
                <div className="space-y-3">
                  {plataformasConGasto.map(p => (
                    <div key={p.plataforma} className="grid grid-cols-[96px_1fr_auto] items-center gap-3">
                      <span className="text-[12.5px] font-medium text-on-surface truncate">
                        {NOMBRE_PLATAFORMA[p.plataforma] ?? p.plataforma}
                      </span>
                      <span className="h-[20px] rounded bg-surface-high overflow-hidden block">
                        <span
                          className="block h-full rounded transition-all duration-500"
                          style={{ width: `${(p.gasto / maxGasto) * 100}%`, background: COLOR_PLATAFORMA[p.plataforma] ?? '#64748b' }}
                        />
                      </span>
                      <span className="text-[12.5px] font-semibold tabular-nums text-on-surface whitespace-nowrap">
                        {formatCOP(p.gasto)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cohortes */}
            <div className="card p-5">
              <h3 className="text-[15px] font-semibold text-on-surface mb-1">Cohortes de clientes</h3>
              <p className="text-[11.5px] text-on-surface-variant mb-3">
                Neto que genera cada grupo según el mes de su primera compra
              </p>
              {(d?.cohortes.length ?? 0) === 0 ? (
                <p className="text-[13px] text-on-surface-variant text-center py-6">Sin cohortes todavía</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-surface-high">
                        <th className="px-2 py-2 text-left text-[11.5px] font-semibold text-on-surface-variant">Cohorte</th>
                        <th className="px-2 py-2 text-right text-[11.5px] font-semibold text-on-surface-variant">Clientes</th>
                        <th className="px-2 py-2 text-right text-[11.5px] font-semibold text-on-surface-variant">Neto</th>
                        <th className="px-2 py-2 text-right text-[11.5px] font-semibold text-on-surface-variant">Valor de vida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d!.cohortes.map(c => (
                        <tr key={c.cohorte} className="border-b border-surface-high last:border-0">
                          <td className="px-2 py-2.5 text-[12.5px] text-on-surface whitespace-nowrap">
                            {nombreMes(c.cohorte)}
                            {c.enFormacion && (
                              <span className="ml-2 text-[9.5px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.14)', color: '#b45309' }}>
                                En formación
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-right text-[12.5px] tabular-nums text-on-surface">{numero(c.clientes)}</td>
                          <td className="px-2 py-2.5 text-right text-[12.5px] tabular-nums text-on-surface whitespace-nowrap">{formatCOP(c.neto)}</td>
                          <td className="px-2 py-2.5 text-right text-[12.5px] tabular-nums font-semibold text-on-surface whitespace-nowrap">{formatCOP(c.ltv)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[10.5px] text-on-surface-variant mt-2">
                    Una cohorte con menos de tres meses todavía está formando su valor: compararla con
                    una madura lleva a conclusiones equivocadas.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Campañas */}
          {(d?.campanias.length ?? 0) > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <h3 className="text-[15px] font-semibold text-on-surface">Detalle por campaña</h3>
                <div className="flex gap-1.5">
                  {plataformasConGasto.map(p => (
                    <button
                      key={p.plataforma}
                      onClick={() => setPlataforma(p.plataforma)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                        activa === p.plataforma ? 'bg-surface-high text-on-surface' : 'text-on-surface-variant hover:bg-surface-low'
                      }`}
                    >
                      {NOMBRE_PLATAFORMA[p.plataforma] ?? p.plataforma}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-surface-high">
                      <th className="px-2 py-2 text-left text-[11.5px] font-semibold text-on-surface-variant">Campaña</th>
                      <th className="px-2 py-2 text-right text-[11.5px] font-semibold text-on-surface-variant">Inversión</th>
                      <th className="px-2 py-2 text-right text-[11.5px] font-semibold text-on-surface-variant">Impresiones</th>
                      <th className="px-2 py-2 text-right text-[11.5px] font-semibold text-on-surface-variant">Clics</th>
                      <th className="px-2 py-2 text-right text-[11.5px] font-semibold text-on-surface-variant">Interacción</th>
                      <th className="px-2 py-2 text-right text-[11.5px] font-semibold text-on-surface-variant">Coste por clic</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campanias.map(c => (
                      <tr key={c.id} className="border-b border-surface-high last:border-0 hover:bg-surface-low transition-colors">
                        <td className="px-2 py-2.5 text-[12.5px] text-on-surface min-w-[200px]">{c.campania}</td>
                        <td className="px-2 py-2.5 text-right text-[12.5px] tabular-nums text-on-surface whitespace-nowrap">{formatCOP(c.gastoCOP)}</td>
                        <td className="px-2 py-2.5 text-right text-[12.5px] tabular-nums text-on-surface-variant">{numero(c.impresiones)}</td>
                        <td className="px-2 py-2.5 text-right text-[12.5px] tabular-nums text-on-surface-variant">{numero(c.clics)}</td>
                        <td className="px-2 py-2.5 text-right text-[12.5px] tabular-nums text-on-surface-variant">{pct(c.ctr, 2)}</td>
                        <td className="px-2 py-2.5 text-right text-[12.5px] tabular-nums text-on-surface-variant whitespace-nowrap">
                          {c.cpc !== null ? formatCOP(c.cpc) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
