'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { MonthPicker, type DateRange } from '@/components/ui/MonthPicker'
import { formatCOP } from '@/lib/utils'
import { rangoDelMes, nombreMes, numero, pct } from '@/components/finanzas/comunes'
import { Info } from 'lucide-react'

interface PrecioData {
  productos: {
    id: string; nombre: string; ventasContado: number
    precioOficial: number | null; precioObservado: number | null
    desviacion: number | null; desviacionPct: number | null
  }[]
  fueraDePrecio: number
  trm: { promedio: number | null; minima: number | null; maxima: number | null; transacciones: number }
  preciosOficiales: { cursoId: string; nombre: string; historial: { precio: number; vigenteDesde: string | null }[] }[]
}

export default function PrecioYCambioPage() {
  const [mes, setMes] = useState<string | null>(null)
  const [rango, setRango] = useState<DateRange | null>(null)
  const { desde, hasta } = rangoDelMes(mes)
  const mesActual = new Date().toISOString().slice(0, 7)

  const { data, isLoading } = useQuery({
    queryKey: ['finanzas-precio', desde, hasta],
    queryFn: async () => apiFetch(`/finanzas/precio?desde=${desde}&hasta=${hasta}`) as Promise<{ data: PrecioData }>,
    staleTime: 60_000,
  })

  const d = data?.data

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Precio y tipo de cambio"
        subtitle={`Lo que se cobró frente al precio oficial · ${nombreMes((mes ?? desde).slice(0, 7))}`}
        actions={
          <MonthPicker
            value={mes} currentMonth={mesActual} dateRange={rango}
            onChange={(m, r) => { setMes(m); setRango(r) }}
            alignRight
          />
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            e: 'Productos fuera de precio',
            v: numero(d?.fueraDePrecio ?? 0),
            n: 'Diferencia mayor a mil pesos',
            alerta: (d?.fueraDePrecio ?? 0) > 0,
          },
          {
            e: 'Tasa de cambio promedio',
            v: d?.trm.promedio ? `$${numero(d.trm.promedio)}` : 'Sin dato',
            n: 'Pesos por dólar, de las propias transacciones',
          },
          { e: 'Tasa mínima observada', v: d?.trm.minima ? `$${numero(d.trm.minima)}` : '—' },
          { e: 'Tasa máxima observada', v: d?.trm.maxima ? `$${numero(d.trm.maxima)}` : '—' },
        ].map(k => (
          <div key={k.e} className="card p-4">
            <div className="flex items-center gap-1.5">
              {k.alerta && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#f59e0b' }} />}
              <p className="text-[11.5px] font-medium text-on-surface-variant">{k.e}</p>
            </div>
            <p className="text-[22px] font-bold tabular-nums text-on-surface mt-1">{isLoading ? '—' : k.v}</p>
            {k.n && <p className="text-[10.5px] text-on-surface-variant mt-1 leading-snug">{k.n}</p>}
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h3 className="text-[15px] font-semibold text-on-surface mb-1">Desviación frente al precio oficial</h3>
        <p className="text-[11.5px] text-on-surface-variant mb-4">
          El precio observado es la mediana de las ventas de contado. Las ventas a cuotas se excluyen:
          una cuota no es el precio del producto.
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-9 rounded bg-surface-high animate-pulse" />)}
          </div>
        ) : (d?.productos.length ?? 0) === 0 ? (
          <p className="text-[13px] text-on-surface-variant text-center py-8">Sin ventas de contado en este período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-surface-high">
                  <th className="px-2 py-2 text-left text-[11.5px] font-semibold text-on-surface-variant">Producto</th>
                  <th className="px-2 py-2 text-right text-[11.5px] font-semibold text-on-surface-variant whitespace-nowrap">Ventas de contado</th>
                  <th className="px-2 py-2 text-right text-[11.5px] font-semibold text-on-surface-variant">Precio oficial</th>
                  <th className="px-2 py-2 text-right text-[11.5px] font-semibold text-on-surface-variant">Precio observado</th>
                  <th className="px-2 py-2 text-right text-[11.5px] font-semibold text-on-surface-variant">Desviación</th>
                </tr>
              </thead>
              <tbody>
                {d!.productos.map(p => {
                  const desviado = p.desviacion !== null && Math.abs(p.desviacion) > 1000
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-surface-high last:border-0"
                      style={desviado ? { background: 'rgba(245,158,11,0.07)' } : undefined}
                    >
                      <td className="px-2 py-2.5 text-[12.5px] text-on-surface min-w-[220px]">{p.nombre}</td>
                      <td className="px-2 py-2.5 text-right text-[12.5px] tabular-nums text-on-surface-variant">{numero(p.ventasContado)}</td>
                      <td className="px-2 py-2.5 text-right text-[12.5px] tabular-nums text-on-surface-variant whitespace-nowrap">
                        {p.precioOficial !== null ? formatCOP(p.precioOficial) : '—'}
                      </td>
                      <td className="px-2 py-2.5 text-right text-[12.5px] tabular-nums text-on-surface whitespace-nowrap">
                        {p.precioObservado !== null ? formatCOP(p.precioObservado) : '—'}
                      </td>
                      <td
                        className="px-2 py-2.5 text-right text-[12.5px] tabular-nums font-semibold whitespace-nowrap"
                        style={{ color: desviado ? '#b45309' : 'var(--on-surface-variant)' }}
                      >
                        {p.desviacion === null || !desviado
                          ? '—'
                          : `${p.desviacion > 0 ? '+' : '−'}${formatCOP(Math.abs(p.desviacion))} (${pct(Math.abs(p.desviacionPct ?? 0))})`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-start gap-2 mt-4 pt-3 border-t border-surface-high">
          <Info className="w-3.5 h-3.5 text-on-surface-variant shrink-0 mt-0.5" />
          <p className="text-[10.5px] text-on-surface-variant">
            Las diferencias suelen venir de cupones o de un recargo por financiación. Si un producto
            aparece siempre desviado, probablemente su precio oficial está desactualizado: se corrige
            agregando una fila nueva en Parámetros, nunca editando la anterior.
          </p>
        </div>
      </div>

      {(d?.preciosOficiales.length ?? 0) > 0 && (
        <div className="card p-5">
          <h3 className="text-[15px] font-semibold text-on-surface mb-1">Historial de precios oficiales</h3>
          <p className="text-[11.5px] text-on-surface-variant mb-4">
            Cada venta se compara contra el precio que regía el día en que ocurrió.
          </p>
          <div className="space-y-3">
            {d!.preciosOficiales.map(c => (
              <div key={c.cursoId} className="flex items-start justify-between gap-4 py-2 border-b border-surface-high last:border-0">
                <span className="text-[12.5px] text-on-surface">{c.nombre}</span>
                <div className="text-right shrink-0">
                  {c.historial.map(h => (
                    <p key={h.vigenteDesde ?? ''} className="text-[12px] tabular-nums text-on-surface whitespace-nowrap">
                      {formatCOP(h.precio)}
                      <span className="text-[10.5px] text-on-surface-variant ml-2">desde {h.vigenteDesde}</span>
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
