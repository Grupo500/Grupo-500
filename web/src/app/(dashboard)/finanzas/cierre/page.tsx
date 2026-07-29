'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCOP } from '@/lib/utils'
import { nombreMes, pct, numero } from '@/components/finanzas/comunes'
import { Info } from 'lucide-react'

interface FilaCierre {
  mes: string
  ventasNuevas: number
  valorVendido: number
  facturacionCobrada: number
  netoRecibido: number
  costes: number
  porcentajeCostes: number | null
  clientesNuevos: number
  ticketPromedio: number | null
  porcentajeContado: number | null
  porcentajePlazos: number | null
  cuotasFuturasOriginadas: number
  cuotasCobradas: number
  saldoInicial: number
  saldoFinal: number
  enCurso: boolean
}

/**
 * Los tres comportamientos que el modelo distingue. Es la regla que más se
 * incumple al leer el histórico: sumar una columna de ratios o de saldos da un
 * número que parece válido y no significa nada.
 */
const LEYENDA = [
  { clave: 'flujo',  nombre: 'Flujo',  color: '#1a7de0', texto: 'Ocurre dentro del mes. Sumar dos meses da el bimestre correcto.' },
  { clave: 'ratio',  nombre: 'Ratio',  color: '#16a34a', texto: 'Es una división. Para varios meses se divide el total, no se promedian los porcentajes.' },
  { clave: 'cierre', nombre: 'Cierre', color: '#d97706', texto: 'Es un saldo a una fecha. Nunca se suma entre meses.' },
]

export default function CierreMensualPage() {
  // El histórico arranca en el primer pago registrado; el backend lo acota.
  const desde = '2020-01-01'
  const hasta = new Date().toISOString().slice(0, 10)

  const { data, isLoading } = useQuery({
    queryKey: ['finanzas-cierre', desde, hasta],
    queryFn: async () => apiFetch(`/finanzas/cierre?desde=${desde}&hasta=${hasta}`) as Promise<{ data: { filas: FilaCierre[] } }>,
    staleTime: 60_000,
  })

  const filas = data?.data.filas ?? []

  // Solo las columnas de flujo se pueden totalizar.
  const total = filas.reduce(
    (a, f) => ({
      ventasNuevas: a.ventasNuevas + f.ventasNuevas,
      valorVendido: a.valorVendido + f.valorVendido,
      facturacionCobrada: a.facturacionCobrada + f.facturacionCobrada,
      netoRecibido: a.netoRecibido + f.netoRecibido,
      costes: a.costes + f.costes,
      clientesNuevos: a.clientesNuevos + f.clientesNuevos,
    }),
    { ventasNuevas: 0, valorVendido: 0, facturacionCobrada: 0, netoRecibido: 0, costes: 0, clientesNuevos: 0 },
  )

  const th = 'px-3 py-2 text-[11.5px] font-semibold text-on-surface-variant whitespace-nowrap text-right'
  const td = 'px-3 py-2.5 text-[12.5px] tabular-nums text-on-surface whitespace-nowrap text-right'

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Cierre mensual"
        subtitle="Cada fila es un mes. No es una foto guardada: se recalcula con los datos actuales."
      />

      {/* ── Cómo se lee cada bloque ─────────────────────────────────────── */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {LEYENDA.map((l, i) => (
            <div key={l.clave} className={i > 0 ? 'sm:border-l sm:border-surface-high sm:pl-4' : ''}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: l.color }} />
                <span className="text-[13px] font-semibold text-on-surface">{l.nombre}</span>
              </div>
              <p className="text-[11.5px] text-on-surface-variant leading-snug">{l.texto}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabla de cierres ────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-8 rounded bg-surface-high animate-pulse" />)}
          </div>
        ) : filas.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant text-center py-10">Sin meses cerrados todavía</p>
        ) : (
          // El desbordamiento vive en su propio contenedor: la página nunca se
          // desplaza en horizontal, solo la tabla.
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="px-3 py-1.5 text-left sticky left-0 bg-surface-container-lowest z-10" />
                  <th colSpan={7} className="px-3 py-1.5 text-[11px] font-semibold text-left" style={{ background: 'rgba(26,125,224,0.08)', color: '#1a7de0' }}>
                    Flujo del mes
                  </th>
                  <th colSpan={4} className="px-3 py-1.5 text-[11px] font-semibold text-left" style={{ background: 'rgba(22,163,74,0.08)', color: '#15803d' }}>
                    Ratios del mes
                  </th>
                  <th colSpan={3} className="px-3 py-1.5 text-[11px] font-semibold text-left" style={{ background: 'rgba(217,119,6,0.08)', color: '#b45309' }}>
                    Cierre
                  </th>
                </tr>
                <tr className="border-b border-surface-high">
                  <th className="px-3 py-2 text-[11.5px] font-semibold text-on-surface-variant text-left sticky left-0 bg-surface-container-lowest z-10">Mes</th>
                  <th className={th}>Ventas nuevas</th>
                  <th className={th}>Valor total vendido</th>
                  <th className={th}>Facturación cobrada</th>
                  <th className={th}>Neto recibido</th>
                  <th className={th}>Costes Hotmart</th>
                  <th className={th}>Clientes nuevos</th>
                  <th className={th}>Cuotas cobradas</th>
                  <th className={th}>Costes sobre cobros</th>
                  <th className={th}>Valor promedio por venta</th>
                  <th className={th}>De contado</th>
                  <th className={th}>A plazos</th>
                  <th className={th}>Cuotas futuras originadas</th>
                  <th className={th}>Saldo inicial</th>
                  <th className={th}>Saldo al cierre</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(f => (
                  <tr key={f.mes} className="border-b border-surface-high hover:bg-surface-low transition-colors">
                    <td className="px-3 py-2.5 text-[12.5px] font-semibold text-on-surface whitespace-nowrap text-left sticky left-0 bg-surface-container-lowest z-10">
                      {nombreMes(f.mes)}
                      {f.enCurso && (
                        <span className="ml-2 text-[9.5px] px-1.5 py-0.5 rounded-full bg-[var(--primary-container)] text-primary font-medium">
                          En curso
                        </span>
                      )}
                    </td>
                    <td className={td}>{numero(f.ventasNuevas)}</td>
                    <td className={td}>{formatCOP(f.valorVendido)}</td>
                    <td className={td}>{formatCOP(f.facturacionCobrada)}</td>
                    <td className={td}>{formatCOP(f.netoRecibido)}</td>
                    <td className={td}>{formatCOP(f.costes)}</td>
                    <td className={td}>{numero(f.clientesNuevos)}</td>
                    <td className={td}>{formatCOP(f.cuotasCobradas)}</td>
                    <td className={td}>{pct(f.porcentajeCostes, 2)}</td>
                    <td className={td}>{formatCOP(f.ticketPromedio ?? 0)}</td>
                    <td className={td}>{pct(f.porcentajeContado)}</td>
                    <td className={td}>{pct(f.porcentajePlazos)}</td>
                    <td className={td}>{formatCOP(f.cuotasFuturasOriginadas)}</td>
                    <td className={td}>{formatCOP(f.saldoInicial)}</td>
                    <td className={td}>{formatCOP(f.saldoFinal)}</td>
                  </tr>
                ))}

                {/* Los ratios y los saldos van con guion: no son sumables */}
                <tr className="bg-surface-low font-semibold">
                  <td className="px-3 py-2.5 text-[12.5px] text-on-surface whitespace-nowrap text-left sticky left-0 bg-surface-low z-10">
                    Total del período ({filas.length} {filas.length === 1 ? 'mes' : 'meses'})
                  </td>
                  <td className={td}>{numero(total.ventasNuevas)}</td>
                  <td className={td}>{formatCOP(total.valorVendido)}</td>
                  <td className={td}>{formatCOP(total.facturacionCobrada)}</td>
                  <td className={td}>{formatCOP(total.netoRecibido)}</td>
                  <td className={td}>{formatCOP(total.costes)}</td>
                  <td className={td}>{numero(total.clientesNuevos)}</td>
                  <td className={td}>—</td>
                  <td className={`${td} text-on-surface-variant`} title="No se promedian los porcentajes">—</td>
                  <td className={`${td} text-on-surface-variant`} title="No se promedian los porcentajes">—</td>
                  <td className={`${td} text-on-surface-variant`} title="No se promedian los porcentajes">—</td>
                  <td className={`${td} text-on-surface-variant`} title="No se promedian los porcentajes">—</td>
                  <td className={td}>—</td>
                  <td className={`${td} text-on-surface-variant`} title="Un saldo no se suma entre meses">—</td>
                  <td className={`${td} text-on-surface-variant`} title="Un saldo no se suma entre meses">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Movimiento del saldo del último mes ─────────────────────────── */}
      {filas.length > 0 && (() => {
        const ultima = filas[filas.length - 1]
        const pasos = [
          { etiqueta: 'Saldo inicial', valor: ultima.saldoInicial, color: '#94a3b8' },
          { etiqueta: 'Más cuotas futuras originadas', valor: ultima.cuotasFuturasOriginadas, color: '#1a7de0', signo: '+' },
          { etiqueta: 'Menos cuotas cobradas', valor: -ultima.cuotasCobradas, color: '#dc2626', signo: '−' },
          { etiqueta: 'Saldo final', valor: ultima.saldoFinal, color: '#d97706' },
        ]
        const mayor = Math.max(...pasos.map(p => Math.abs(p.valor)), 1)

        return (
          <div className="card p-5">
            <h3 className="text-[15px] font-semibold text-on-surface mb-4">
              Movimiento del saldo pendiente · {nombreMes(ultima.mes)}
            </h3>
            <div className="space-y-3">
              {pasos.map(p => (
                <div key={p.etiqueta} className="grid grid-cols-[minmax(120px,1fr)_2fr_auto] items-center gap-3">
                  <span className="text-[12.5px] text-on-surface-variant">{p.etiqueta}</span>
                  <span className="h-5 rounded bg-surface-high overflow-hidden block">
                    <span
                      className="block h-full rounded transition-all duration-500"
                      style={{ width: `${Math.max(2, (Math.abs(p.valor) / mayor) * 100)}%`, background: p.color }}
                    />
                  </span>
                  <span className="text-[13px] font-semibold tabular-nums text-right whitespace-nowrap" style={{ color: p.color }}>
                    {p.signo ?? ''}{formatCOP(Math.abs(p.valor))}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-2 mt-4 pt-3 border-t border-surface-high">
              <Info className="w-3.5 h-3.5 text-on-surface-variant shrink-0 mt-0.5" />
              <p className="text-[10.5px] text-on-surface-variant">
                El saldo es un cierre: nunca se suma entre meses.
              </p>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
