'use client'

import { formatCOP } from '@/lib/utils'
import { numero, pct } from '@/components/finanzas/comunes'
import { ArrowUp, ArrowDown } from 'lucide-react'

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

type Unidad = 'moneda' | 'entero' | 'porcentaje'
type Lectura = 'subir' | 'bajar' | 'informativo'

interface Indicador {
  n: number
  nombre: string
  unidad: Unidad
  lectura: Lectura
  valor: (t: Totales) => number | null
  nota?: string
}

/**
 * Los indicadores del cuadro, en el mismo orden y con la misma lectura que
 * dirección ya usaba. "Lectura" no es decorativa: en los costes y en el CAC
 * bajar es la buena noticia, y sin decirlo la flecha roja se interpreta al
 * revés.
 */
const INDICADORES: Indicador[] = [
  { n: 1,  nombre: 'Ventas nuevas',                 unidad: 'entero',     lectura: 'subir', valor: t => t.ventasNuevas, nota: 'Las cuotas posteriores no cuentan' },
  { n: 2,  nombre: 'Valor total vendido',           unidad: 'moneda',     lectura: 'subir', valor: t => t.valorVendido, nota: 'Compromiso total, no dinero cobrado' },
  { n: 3,  nombre: 'Facturación cobrada',           unidad: 'moneda',     lectura: 'subir', valor: t => t.facturacionCobrada, nota: 'Incluye cuotas de meses anteriores' },
  { n: 4,  nombre: 'Neto recibido',                 unidad: 'moneda',     lectura: 'subir', valor: t => t.netoRecibido },
  { n: 5,  nombre: 'Costes Hotmart y comisiones',   unidad: 'moneda',     lectura: 'bajar', valor: t => t.costes },
  { n: 6,  nombre: 'Costes sobre cobros',           unidad: 'porcentaje', lectura: 'bajar', valor: t => t.porcentajeCostes },
  { n: 7,  nombre: 'Clientes nuevos únicos',        unidad: 'entero',     lectura: 'subir', valor: t => t.clientesNuevos },
  { n: 8,  nombre: 'Valor promedio por venta',      unidad: 'moneda',     lectura: 'subir', valor: t => t.ticketPromedio },
  { n: 9,  nombre: 'Ventas de contado',             unidad: 'entero',     lectura: 'informativo', valor: t => t.ventasContado },
  { n: 10, nombre: 'Ventas a plazos',               unidad: 'entero',     lectura: 'informativo', valor: t => t.ventasPlazos },
  { n: 11, nombre: 'Porcentaje de contado',         unidad: 'porcentaje', lectura: 'informativo', valor: t => t.porcentajeContado },
  { n: 12, nombre: 'Porcentaje a plazos',           unidad: 'porcentaje', lectura: 'informativo', valor: t => t.porcentajePlazos },
  { n: 13, nombre: 'Cuotas futuras originadas',     unidad: 'moneda',     lectura: 'informativo', valor: t => t.cuotasFuturasOriginadas, nota: 'Compromiso que Hotmart cobrará después' },
  { n: 14, nombre: 'Cuotas cobradas en el período', unidad: 'moneda',     lectura: 'informativo', valor: t => t.cuotasCobradas },
]

function dar(v: number | null, u: Unidad): string {
  if (v === null) return '—'
  if (u === 'moneda') return formatCOP(v)
  if (u === 'entero') return numero(v)
  return pct(v, 2)
}

export function TablaIndicadores({ periodo, anterior, acumulado, etiquetaAnterior }: {
  periodo: Totales
  anterior: Totales
  acumulado: Totales
  etiquetaAnterior: string
}) {
  const th = 'px-3 py-2 text-[11.5px] font-semibold text-on-surface-variant whitespace-nowrap text-right'
  const td = 'px-3 py-2.5 text-[12.5px] tabular-nums text-on-surface whitespace-nowrap text-right'

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-[15px] font-semibold text-on-surface">Tabla de indicadores</h3>
        <p className="text-[11.5px] text-on-surface-variant mt-0.5">
          El mes en curso contra {etiquetaAnterior}, comparable porque ambos van hasta el mismo día.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-surface-high bg-surface-low">
              <th className="px-3 py-2 text-left text-[11.5px] font-semibold text-on-surface-variant">Indicador</th>
              <th className={th}>Mes en curso</th>
              <th className={th}>{etiquetaAnterior}</th>
              <th className={th}>Variación</th>
              <th className={th}>Variación %</th>
              <th className={th}>Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {INDICADORES.map(ind => {
              const actual = ind.valor(periodo)
              const previo = ind.valor(anterior)
              const acum = ind.valor(acumulado)

              const absoluta = actual !== null && previo !== null ? actual - previo : null
              const relativa = actual !== null && previo !== null && previo !== 0 ? actual / previo - 1 : null

              // El color depende de si el movimiento es bueno, no de su signo.
              const sube = (absoluta ?? 0) > 0
              const bueno = ind.lectura === 'informativo' ? null : ind.lectura === 'subir' ? sube : !sube
              const color = absoluta === null || absoluta === 0 || bueno === null
                ? 'var(--on-surface-variant)'
                : bueno ? '#16a34a' : '#dc2626'
              const Icono = sube ? ArrowUp : ArrowDown

              return (
                <tr key={ind.n} className="border-b border-surface-high last:border-0 hover:bg-surface-low transition-colors">
                  <td className="px-3 py-2.5 min-w-[220px]">
                    <p className="text-[12.5px] text-on-surface">
                      <span className="text-on-surface-variant tabular-nums mr-1.5">{ind.n}.</span>
                      {ind.nombre}
                    </p>
                    {ind.nota && <p className="text-[10.5px] text-on-surface-variant mt-0.5 ml-5">{ind.nota}</p>}
                  </td>
                  <td className={`${td} font-semibold`}>{dar(actual, ind.unidad)}</td>
                  <td className={`${td} text-on-surface-variant`}>{dar(previo, ind.unidad)}</td>
                  <td className={td} style={{ color }}>
                    {absoluta === null ? '—' : `${absoluta > 0 ? '+' : absoluta < 0 ? '−' : ''}${dar(Math.abs(absoluta), ind.unidad)}`}
                  </td>
                  <td className={td} style={{ color }}>
                    {relativa === null ? (
                      <span className="text-on-surface-variant" title="El mes anterior no tuvo movimiento en este indicador">—</span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 justify-end">
                        <Icono className="w-3 h-3 shrink-0" />
                        {pct(Math.abs(relativa))}
                      </span>
                    )}
                  </td>
                  <td className={`${td} text-on-surface-variant`}>{dar(acum, ind.unidad)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="px-5 py-3 text-[10.5px] text-on-surface-variant border-t border-surface-high">
        Los porcentajes acumulados se recalculan sobre los totales del período, no se promedian
        los de cada mes.
      </p>
    </div>
  )
}
