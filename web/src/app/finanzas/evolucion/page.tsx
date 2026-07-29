'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { MonthPicker, type DateRange } from '@/components/ui/MonthPicker'
import { formatCOP } from '@/lib/utils'
import { rangoDelMes, nombreMes, numero } from '@/components/finanzas/comunes'
import { SerieDiaria } from '@/components/finanzas/SerieDiaria'

interface ResumenData {
  hasta: string
  diasTranscurridos: number
  diasDelMes: number
  periodo: { ventasNuevas: number; valorVendido: number; facturacionCobrada: number }
  anterior: { ventasNuevas: number; valorVendido: number; facturacionCobrada: number }
  dias: { fecha: string; ventas: number; valor: number; cobrado: number; pm7: number }[]
  proyeccion: { ventasNuevas: number; valorVendido: number; facturacionCobrada: number }
}

/**
 * Índice de ritmo: cuántas veces va el mes actual respecto al anterior al
 * mismo día. Es la comparación correcta mientras el mes está en curso; la
 * variación contra el mes completo siempre castiga al mes que va corriendo.
 */
function TarjetaRitmo({ etiqueta, actual, anterior, moneda, cargando }: {
  etiqueta: string; actual: number; anterior: number; moneda?: boolean; cargando?: boolean
}) {
  const indice = anterior > 0 ? actual / anterior : null
  const dar = (v: number) => (moneda ? formatCOP(v) : numero(v))

  if (cargando) {
    return (
      <div className="card p-4">
        <div className="h-3 w-24 rounded bg-surface-high animate-pulse mb-3" />
        <div className="h-7 w-32 rounded bg-surface-high animate-pulse" />
      </div>
    )
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11.5px] font-medium text-on-surface-variant">{etiqueta}</p>
        {indice !== null && (
          <span
            className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums shrink-0"
            style={
              indice >= 1
                ? { background: 'rgba(22,163,74,0.12)', color: '#15803d' }
                : { background: 'rgba(220,38,38,0.10)', color: '#b91c1c' }
            }
          >
            {indice.toFixed(2).replace('.', ',')}x
          </span>
        )}
      </div>
      <p className="text-[22px] font-bold tabular-nums leading-tight text-on-surface mt-1">{dar(actual)}</p>
      <p className="text-[11px] text-on-surface-variant mt-1 tabular-nums">
        Mes anterior a igual día {dar(anterior)}
      </p>
    </div>
  )
}

export default function EvolucionPage() {
  const [mes, setMes] = useState<string | null>(null)
  const [rango, setRango] = useState<DateRange | null>(null)
  const { desde, hasta } = rangoDelMes(mes)
  const mesActual = new Date().toISOString().slice(0, 7)

  const { data, isLoading } = useQuery({
    queryKey: ['finanzas-resumen', desde, hasta],
    queryFn: async () => apiFetch(`/finanzas/resumen?desde=${desde}&hasta=${hasta}`) as Promise<{ data: ResumenData }>,
    staleTime: 60_000,
  })

  const d = data?.data
  const etiquetaMes = nombreMes((mes ?? desde).slice(0, 7))
  const avance = d && d.diasDelMes > 0 ? d.diasTranscurridos / d.diasDelMes : 0

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Evolución y ritmo"
        subtitle={`Cómo va ${etiquetaMes} frente al mes anterior, al mismo día`}
        actions={
          <MonthPicker
            value={mes} currentMonth={mesActual} dateRange={rango}
            onChange={(m, r) => { setMes(m); setRango(r) }}
            alignRight
          />
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <TarjetaRitmo
          etiqueta="Ventas nuevas" cargando={isLoading}
          actual={d?.periodo.ventasNuevas ?? 0} anterior={d?.anterior.ventasNuevas ?? 0}
        />
        <TarjetaRitmo
          etiqueta="Valor vendido" moneda cargando={isLoading}
          actual={d?.periodo.valorVendido ?? 0} anterior={d?.anterior.valorVendido ?? 0}
        />
        <TarjetaRitmo
          etiqueta="Facturación cobrada" moneda cargando={isLoading}
          actual={d?.periodo.facturacionCobrada ?? 0} anterior={d?.anterior.facturacionCobrada ?? 0}
        />
      </div>

      {/* ── Serie diaria ────────────────────────────────────────────────── */}
      <div className="card p-5">
        <h3 className="text-[15px] font-semibold text-on-surface mb-1">Serie diaria</h3>
        <p className="text-[11.5px] text-on-surface-variant mb-4">
          Ventas por día con promedio móvil de siete días
        </p>

        {isLoading ? (
          <div className="h-64 rounded-xl bg-surface-high animate-pulse" />
        ) : (
          <SerieDiaria dias={d?.dias ?? []} altura={300} />
        )}
      </div>

      {/* ── Proyección ──────────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <h3 className="text-[15px] font-semibold text-on-surface">Proyección de cierre de {etiquetaMes}</h3>
            <p className="text-[11.5px] text-on-surface-variant mt-0.5">
              Estimación lineal sobre lo que va del mes
            </p>
          </div>
          {d && (
            <div className="min-w-[180px]">
              <div className="flex items-center justify-between text-[10.5px] text-on-surface-variant mb-1">
                <span>Avance del mes</span>
                <span className="tabular-nums">{d.diasTranscurridos} de {d.diasDelMes} días</span>
              </div>
              <div className="h-2 rounded-full bg-surface-high overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${avance * 100}%`, background: 'var(--primary)' }}
                />
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-8 rounded bg-surface-high animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-2.5">
            {[
              { t: 'Ventas nuevas', a: d?.periodo.ventasNuevas ?? 0, p: d?.proyeccion.ventasNuevas ?? 0, m: false },
              { t: 'Valor vendido', a: d?.periodo.valorVendido ?? 0, p: d?.proyeccion.valorVendido ?? 0, m: true },
              { t: 'Facturación cobrada', a: d?.periodo.facturacionCobrada ?? 0, p: d?.proyeccion.facturacionCobrada ?? 0, m: true },
            ].map(x => (
              <div key={x.t} className="flex items-center justify-between gap-3 py-2 border-b border-surface-high last:border-0">
                <span className="text-[13px] text-on-surface">{x.t}</span>
                <span className="flex items-center gap-2 tabular-nums whitespace-nowrap">
                  <span className="text-[13px] font-semibold text-on-surface">
                    {x.m ? formatCOP(x.a) : numero(x.a)}
                  </span>
                  <span className="text-on-surface-variant">→</span>
                  <span className="text-[13px] text-on-surface-variant">
                    {x.m ? formatCOP(x.p) : numero(x.p)}
                  </span>
                  <span className="text-[10px] text-on-surface-variant/70">estimado</span>
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10.5px] text-on-surface-variant mt-3">
          Es una estimación lineal: acumulado dividido por los días transcurridos, por los días del mes.
          No considera estacionalidad ni campañas.
        </p>
      </div>
    </div>
  )
}
