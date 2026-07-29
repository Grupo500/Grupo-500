'use client'

import { useState } from 'react'
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

type Bloque = 'flujo' | 'ratio' | 'cierre'

interface Totales {
  ventasNuevas: number; valorVendido: number; facturacionCobrada: number
  netoRecibido: number; costes: number; clientesNuevos: number
}

/**
 * Los tres comportamientos que el modelo distingue. Es la regla que más se
 * incumple al leer el histórico: sumar una columna de ratios o de saldos da un
 * número que parece válido y no significa nada.
 */
const LEYENDA: { clave: Bloque; titulo: string; color: string; texto: string }[] = [
  { clave: 'flujo',  titulo: 'Flujo del mes',  color: '#1a7de0', texto: 'Ocurre dentro del mes. Sumar dos meses da el bimestre correcto.' },
  { clave: 'ratio',  titulo: 'Ratios del mes', color: '#16a34a', texto: 'Es una división. Para varios meses se divide el total, no se promedian los porcentajes de cada mes.' },
  { clave: 'cierre', titulo: 'Cierre',         color: '#d97706', texto: 'Es un saldo a una fecha. El del mes actual ya incluye lo que venía de antes, así que nunca se suma entre meses.' },
]

/** Columnas de cada bloque. `total` solo existe donde sumar tiene sentido. */
const COLUMNAS: Record<Bloque, {
  clave: string
  titulo: string
  valor: (f: FilaCierre) => string
  total?: (t: Totales) => string
}[]> = {
  flujo: [
    { clave: 'ventas',    titulo: 'Ventas nuevas',        valor: f => numero(f.ventasNuevas),        total: t => numero(t.ventasNuevas) },
    { clave: 'vendido',   titulo: 'Valor total vendido',  valor: f => formatCOP(f.valorVendido),     total: t => formatCOP(t.valorVendido) },
    { clave: 'cobrado',   titulo: 'Facturación cobrada',  valor: f => formatCOP(f.facturacionCobrada), total: t => formatCOP(t.facturacionCobrada) },
    { clave: 'neto',      titulo: 'Neto recibido',        valor: f => formatCOP(f.netoRecibido),     total: t => formatCOP(t.netoRecibido) },
    { clave: 'costes',    titulo: 'Costes Hotmart',       valor: f => formatCOP(f.costes),           total: t => formatCOP(t.costes) },
    { clave: 'clientes',  titulo: 'Clientes nuevos',      valor: f => numero(f.clientesNuevos),      total: t => numero(t.clientesNuevos) },
    { clave: 'cuotasCob', titulo: 'Cuotas cobradas',      valor: f => formatCOP(f.cuotasCobradas) },
  ],
  ratio: [
    { clave: 'pctCostes',  titulo: 'Costes sobre cobros',      valor: f => pct(f.porcentajeCostes, 2) },
    { clave: 'ticket',     titulo: 'Valor promedio por venta', valor: f => formatCOP(f.ticketPromedio ?? 0) },
    { clave: 'contado',    titulo: 'De contado',               valor: f => pct(f.porcentajeContado) },
    { clave: 'plazos',     titulo: 'A plazos',                 valor: f => pct(f.porcentajePlazos) },
  ],
  cierre: [
    { clave: 'originadas', titulo: 'Cuotas futuras originadas', valor: f => formatCOP(f.cuotasFuturasOriginadas) },
    { clave: 'inicial',    titulo: 'Saldo inicial',             valor: f => formatCOP(f.saldoInicial) },
    { clave: 'final',      titulo: 'Saldo al cierre',           valor: f => formatCOP(f.saldoFinal) },
  ],
}

export default function CierreMensualPage() {
  const [bloque, setBloque] = useState<Bloque>('flujo')

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

      {/* ── Selector de bloque ──────────────────────────────────────────────
          Quince columnas en una sola tabla obligan a desplazarse en horizontal
          y las franjas de color se leían como etiquetas sueltas, no como
          encabezados de grupo. Con pestañas cada bloque cabe en pantalla y su
          regla de lectura queda escrita al lado. */}
      <div className="card p-4">
        <div className="flex gap-2 flex-wrap">
          {LEYENDA.map(l => {
            const activa = bloque === l.clave
            return (
              <button
                key={l.clave}
                onClick={() => setBloque(l.clave)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer border"
                style={
                  activa
                    ? { background: `${l.color}14`, borderColor: l.color, color: l.color }
                    : { borderColor: 'var(--surface-high)', color: 'var(--on-surface-variant)' }
                }
              >
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: l.color }} />
                {l.titulo}
              </button>
            )
          })}
        </div>
        <p className="text-[11.5px] text-on-surface-variant leading-snug mt-3">
          {LEYENDA.find(l => l.clave === bloque)!.texto}
        </p>
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
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-surface-high">
                  <th className="px-3 py-2.5 text-[11.5px] font-semibold text-on-surface-variant text-left">Mes</th>
                  {COLUMNAS[bloque].map(c => (
                    <th key={c.clave} className={th}>{c.titulo}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map(f => (
                  <tr key={f.mes} className="border-b border-surface-high hover:bg-surface-low transition-colors">
                    <td className="px-3 py-2.5 text-[12.5px] font-semibold text-on-surface whitespace-nowrap text-left">
                      {nombreMes(f.mes)}
                      {f.enCurso && (
                        <span className="ml-2 text-[9.5px] px-1.5 py-0.5 rounded-full bg-[var(--primary-container)] text-primary font-medium">
                          En curso
                        </span>
                      )}
                    </td>
                    {COLUMNAS[bloque].map(c => (
                      <td key={c.clave} className={td}>{c.valor(f)}</td>
                    ))}
                  </tr>
                ))}

                {/* Solo el flujo se totaliza. En ratios y cierre va un guion con
                    su explicación al pasar el cursor. */}
                <tr className="bg-surface-low font-semibold">
                  <td className="px-3 py-2.5 text-[12.5px] text-on-surface whitespace-nowrap text-left">
                    Total del período ({filas.length} {filas.length === 1 ? 'mes' : 'meses'})
                  </td>
                  {COLUMNAS[bloque].map(c => (
                    <td
                      key={c.clave}
                      className={c.total ? td : `${td} text-on-surface-variant`}
                      title={c.total ? undefined : bloque === 'ratio'
                        ? 'Un porcentaje no se promedia entre meses'
                        : 'Un saldo no se suma entre meses'}
                    >
                      {c.total ? c.total(total) : '—'}
                    </td>
                  ))}
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
            {/* Una sola cuadrícula para los cuatro pasos, no una por fila: con
                una cuadrícula por fila la columna del monto se mide con su
                propio contenido y "$ 0" deja su barra arrancando corrida
                respecto a las demás. */}
            <div className="grid grid-cols-[minmax(110px,auto)_1fr_minmax(120px,auto)] items-center gap-x-3 gap-y-3">
              {pasos.map(p => (
                <div key={p.etiqueta} className="contents">
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
