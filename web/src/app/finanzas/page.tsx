'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { MonthPicker, type DateRange } from '@/components/ui/MonthPicker'
import { formatCOP } from '@/lib/utils'
import { TarjetaKPI, rangoDelMes, nombreMes, pct, numero } from '@/components/finanzas/comunes'
import { SerieDiaria } from '@/components/finanzas/SerieDiaria'
import { TablaIndicadores } from '@/components/finanzas/TablaIndicadores'
import { CircleDollarSign, Info } from 'lucide-react'

interface Totales {
  ventasNuevas: number
  valorVendido: number
  facturacionCobrada: number
  netoRecibido: number
  costes: number
  porcentajeCostes: number | null
  clientesNuevos: number
  ticketPromedio: number | null
  ventasContado: number
  ventasPlazos: number
  porcentajeContado: number | null
  porcentajePlazos: number | null
  cuotasFuturasOriginadas: number
  cuotasCobradas: number
}

interface ResumenData {
  desde: string
  hasta: string
  diasTranscurridos: number
  diasDelMes: number
  periodo: Totales
  anterior: Totales
  acumulado: Totales
  variaciones: Record<string, number | null>
  dias: { fecha: string; ventas: number; valor: number; cobrado: number; pm7: number }[]
  proyeccion: { ventasNuevas: number; valorVendido: number; facturacionCobrada: number }
  saldo: { cuotasProgramadas: number; porGestionar: number; estudiantesPorGestionar: number }
}

export default function FinanzasResumenPage() {
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
  const p = d?.periodo
  const v = d?.variaciones ?? {}

  const etiquetaMes = nombreMes((mes ?? desde).slice(0, 7))
  // Mes anterior al seleccionado, para rotular la columna de comparación.
  const mesAnterior = (() => {
    const [a, m] = (mes ?? desde).slice(0, 7).split('-').map(Number)
    const d = new Date(a, m - 2, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Resumen financiero"
        subtitle={
          d
            ? `Corte al ${Number(d.hasta.slice(8, 10))} de ${etiquetaMes} · ${numero(d.acumulado.ventasNuevas)} ventas acumuladas`
            : 'Indicadores de dirección'
        }
        actions={
          <>
            <MonthPicker
              value={mes}
              currentMonth={mesActual}
              dateRange={rango}
              onChange={(m, r) => { setMes(m); setRango(r) }}
              alignRight
            />
          </>
        }
      />

      {/* ── Indicadores principales ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <TarjetaKPI
          etiqueta="Valor total vendido" cargando={isLoading}
          valor={p?.valorVendido ?? 0} acumulado={d?.acumulado.valorVendido}
          variacion={v.valorVendido}
          nota="Compromiso total de las ventas del mes"
        />
        <TarjetaKPI
          etiqueta="Facturación cobrada" cargando={isLoading}
          valor={p?.facturacionCobrada ?? 0} acumulado={d?.acumulado.facturacionCobrada}
          variacion={v.facturacionCobrada}
          nota="Dinero que entró, incluidas cuotas"
        />
        <TarjetaKPI
          etiqueta="Neto recibido" cargando={isLoading}
          valor={p?.netoRecibido ?? 0} acumulado={d?.acumulado.netoRecibido}
          variacion={v.netoRecibido}
        />
        <TarjetaKPI
          etiqueta="Ventas nuevas" formato="entero" cargando={isLoading}
          valor={p?.ventasNuevas ?? 0} acumulado={d?.acumulado.ventasNuevas}
          variacion={v.ventasNuevas}
          nota="Las cuotas posteriores no cuentan"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <TarjetaKPI
          etiqueta="Clientes nuevos" formato="entero" cargando={isLoading}
          valor={p?.clientesNuevos ?? 0} acumulado={d?.acumulado.clientesNuevos}
          variacion={v.clientesNuevos}
        />
        <TarjetaKPI
          etiqueta="Ticket promedio" cargando={isLoading}
          valor={p?.ticketPromedio ?? 0} acumulado={d?.acumulado.ticketPromedio ?? 0}
          variacion={v.ticketPromedio}
        />
        <TarjetaKPI
          etiqueta="Costes Hotmart y comisiones" cargando={isLoading}
          valor={p?.costes ?? 0} acumulado={d?.acumulado.costes}
          variacion={v.costes} bajarEsBueno
        />
        <TarjetaKPI
          etiqueta="Costes sobre cobros" formato="porcentaje" cargando={isLoading}
          valor={p?.porcentajeCostes ?? 0}
          nota="Peso de la plataforma sobre lo cobrado"
        />
      </div>

      {/* ── Ritmo del mes ───────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <h3 className="text-[15px] font-semibold text-on-surface">Ritmo de {etiquetaMes}</h3>
            <p className="text-[11.5px] text-on-surface-variant mt-0.5">
              Ventas por día y promedio móvil de siete días
            </p>
          </div>
          {d && (
            <div className="flex items-center gap-4 text-right">
              <div>
                <p className="text-[10.5px] text-on-surface-variant">Mes anterior a igual día</p>
                <p className="text-[14px] font-semibold tabular-nums text-on-surface">{numero(d.anterior.ventasNuevas)}</p>
              </div>
              <div>
                <p className="text-[10.5px] text-on-surface-variant">Proyección de cierre</p>
                <p className="text-[14px] font-semibold tabular-nums text-on-surface">
                  {numero(d.proyeccion.ventasNuevas)}
                </p>
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="h-80 rounded-xl bg-surface-high animate-pulse" />
        ) : (
          <SerieDiaria dias={d?.dias ?? []} altura={320} />
        )}

        {d && (
          <p className="text-[10.5px] text-on-surface-variant mt-1">
            La proyección es una estimación lineal sobre {d.diasTranscurridos} de {d.diasDelMes} días.
            No considera estacionalidad ni campañas.
          </p>
        )}
      </div>

      {/* ── Saldo y modalidad ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-md bg-[var(--primary-container)] flex items-center justify-center">
              <CircleDollarSign className="w-3.5 h-3.5 text-primary" />
            </div>
            <h3 className="text-[15px] font-semibold text-on-surface">Saldo por cobrar</h3>
          </div>

          {/* Son dos cifras distintas y deben leerse como tales: una es el
              compromiso futuro que Hotmart cobra solo, la otra es lo que
              alguien tiene que ir a perseguir. */}
          <div className="rounded-xl bg-surface-low p-4">
            <p className="text-[12px] text-on-surface-variant">Cuotas futuras programadas</p>
            <p className="text-[22px] font-bold tabular-nums text-on-surface mt-0.5">
              {isLoading ? '—' : formatCOP(d?.saldo.cuotasProgramadas ?? 0)}
            </p>
            <p className="text-[11px] text-on-surface-variant mt-1">
              Hotmart las cobra automáticamente. Nunca se suma entre meses.
            </p>
          </div>

          <div className="rounded-xl p-4 mt-2.5" style={{ background: 'rgba(245,158,11,0.12)' }}>
            <p className="text-[12px]" style={{ color: '#b45309' }}>Saldo por gestionar</p>
            <p className="text-[22px] font-bold tabular-nums mt-0.5" style={{ color: '#b45309' }}>
              {isLoading ? '—' : formatCOP(d?.saldo.porGestionar ?? 0)}
            </p>
            <p className="text-[11px] mt-1" style={{ color: '#b45309', opacity: 0.85 }}>
              {numero(d?.saldo.estudiantesPorGestionar ?? 0)} estudiantes sin plan de cuotas automático
            </p>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-[15px] font-semibold text-on-surface mb-1">Contado frente a plazos</h3>
          <p className="text-[11.5px] text-on-surface-variant mb-4">
            Sobre las {numero(p?.ventasNuevas ?? 0)} ventas nuevas del mes
          </p>

          <div className="flex gap-[3px] mb-4">
            <div
              className="h-3 rounded-l"
              style={{ width: `${(p?.porcentajeContado ?? 0) * 100}%`, background: 'var(--primary)' }}
            />
            <div className="h-3 rounded-r flex-1" style={{ background: '#f59e0b' }} />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-on-surface flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--primary)' }} />
                De contado
              </span>
              <span className="text-[14px] font-semibold tabular-nums text-on-surface">
                {numero(p?.ventasContado ?? 0)}
                <span className="text-[11px] font-normal text-on-surface-variant ml-1.5">
                  {pct(p?.porcentajeContado ?? null)}
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-on-surface flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} />
                A plazos
              </span>
              <span className="text-[14px] font-semibold tabular-nums text-on-surface">
                {numero(p?.ventasPlazos ?? 0)}
                <span className="text-[11px] font-normal text-on-surface-variant ml-1.5">
                  {pct(p?.porcentajePlazos ?? null)}
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 mt-4 pt-3 border-t border-surface-high">
            <Info className="w-3.5 h-3.5 text-on-surface-variant shrink-0 mt-0.5" />
            <p className="text-[10.5px] text-on-surface-variant">
              Una venta a plazos se cuenta una sola vez, en el mes en que se originó.
              Las cuotas que se cobran después suman a la facturación, no a las ventas.
            </p>
          </div>
        </div>
      </div>

      {/* ── Cuadro completo de indicadores ──────────────────────────────── */}
      {d && (
        <TablaIndicadores
          periodo={d.periodo}
          anterior={d.anterior}
          acumulado={d.acumulado}
          etiquetaAnterior={`${nombreMes(mesAnterior)} a igual día`}
        />
      )}
    </div>
  )
}
