'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { MonthPicker, type DateRange } from '@/components/ui/MonthPicker'
import { formatCOP } from '@/lib/utils'
import { rangoDelMes, nombreMes, pct, numero, FilaParticipacion } from '@/components/finanzas/comunes'
import { cn } from '@/lib/utils'

interface MixData {
  totalValor: number
  totalVentas: number
  productos: { nombre: string; ventas: number; valor: number; participacion: number }[]
  asesores: { id: string; nombre: string; ventas: number; valor: number; participacion: number }[]
  concentracionProductos: { principal: number; tresPrincipales: number; conVentas: number }
  concentracionAsesores: { principal: number; tresPrincipales: number; conVentas: number }
  sinAtribucion: number
  porcentajeSinAtribucion: number
}

// Un color por línea de producto: con una paleta por curso los tonos se
// repiten y dos productos distintos terminan indistinguibles.
const COLOR: Record<string, string> = {
  'Intensivo':      '#1a7de0',
  'Año 500':        '#db2777',
  'Combo':          '#d97706',
  'Calendario':     '#2e9e6b',
  'Ruta 500':       '#7c3aed',
  'Premédico':      '#0891b2',
  'Otros':          '#64748b',
  'Sin clasificar': '#94a3b8',
}

function Concentracion({ datos, etiqueta }: {
  datos: { principal: number; tresPrincipales: number; conVentas: number }
  etiqueta: string
}) {
  return (
    <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-surface-high">
      {[
        { t: `${etiqueta} principal`, v: pct(datos.principal) },
        { t: 'Tres principales', v: pct(datos.tresPrincipales) },
        { t: 'Con ventas', v: numero(datos.conVentas) },
      ].map(x => (
        <div key={x.t}>
          <p className="text-[10.5px] text-on-surface-variant leading-tight">{x.t}</p>
          <p className="text-[13px] font-semibold tabular-nums text-on-surface mt-0.5">{x.v}</p>
        </div>
      ))}
    </div>
  )
}

export default function MixComercialPage() {
  const [mes, setMes] = useState<string | null>(null)
  const [rango, setRango] = useState<DateRange | null>(null)
  const [base, setBase] = useState<'valor' | 'ventas'>('valor')
  const { desde, hasta } = rangoDelMes(mes)
  const mesActual = new Date().toISOString().slice(0, 7)

  const { data, isLoading } = useQuery({
    queryKey: ['finanzas-mix', desde, hasta],
    queryFn: async () => apiFetch(`/finanzas/mix?desde=${desde}&hasta=${hasta}`) as Promise<{ data: MixData }>,
    staleTime: 60_000,
  })

  const d = data?.data
  const porBase = (x: { valor: number; ventas: number }) => (base === 'valor' ? x.valor : x.ventas)
  const totalBase = base === 'valor' ? (d?.totalValor ?? 0) : (d?.totalVentas ?? 0)
  const mostrar = (v: number) => (base === 'valor' ? formatCOP(v) : numero(v))

  // Las barras se escalan contra el líder de cada lista, no contra el total:
  // con participaciones bajas todas quedarían igual de cortas y no se
  // distinguiría al segundo del décimo.
  const mayorProducto = Math.max(...(d?.productos ?? []).map(porBase), 1)
  const mayorAsesor = Math.max(...(d?.asesores ?? []).map(porBase), 1)

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Mix comercial"
        subtitle={`Participación por producto y por asesor · ${nombreMes((mes ?? desde).slice(0, 7))}`}
        actions={
          <MonthPicker
            value={mes} currentMonth={mesActual} dateRange={rango}
            onChange={(m, r) => { setMes(m); setRango(r) }}
            alignRight
          />
        }
      />

      {/* Alternar la base cambia la lectura por completo: un producto barato
          puede liderar en unidades y ser marginal en dinero. */}
      <div className="inline-flex rounded-lg bg-surface-low p-0.5">
        {([['valor', 'Valor vendido'], ['ventas', 'Ventas nuevas']] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setBase(k)}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-[12.5px] font-medium transition-colors cursor-pointer',
              base === k ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Por producto ──────────────────────────────────────────────── */}
        <div className="card p-5">
          <h3 className="text-[15px] font-semibold text-on-surface mb-4">Participación por producto</h3>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-6 rounded bg-surface-high animate-pulse" />)}
            </div>
          ) : (d?.productos.length ?? 0) === 0 ? (
            <p className="text-[13px] text-on-surface-variant text-center py-8">Sin ventas en este período</p>
          ) : (
            <div className="divide-y divide-surface-high">
              {d!.productos.map(p => (
                <FilaParticipacion
                  key={p.nombre}
                  nombre={p.nombre}
                  monto={mostrar(porBase(p))}
                  participacion={totalBase > 0 ? porBase(p) / totalBase : 0}
                  proporcion={porBase(p) / mayorProducto}
                  color={COLOR[p.nombre] ?? COLOR['Otros']}
                  detalle={`${numero(p.ventas)} ${p.ventas === 1 ? 'venta' : 'ventas'}`}
                />
              ))}
            </div>
          )}

          {d && <Concentracion datos={d.concentracionProductos} etiqueta="Producto" />}
        </div>

        {/* ── Por asesor ────────────────────────────────────────────────── */}
        <div className="card p-5">
          <h3 className="text-[15px] font-semibold text-on-surface mb-4">Participación por asesor o canal</h3>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-6 rounded bg-surface-high animate-pulse" />)}
            </div>
          ) : (d?.asesores.length ?? 0) === 0 ? (
            <p className="text-[13px] text-on-surface-variant text-center py-8">Sin ventas en este período</p>
          ) : (
            <div className="divide-y divide-surface-high max-h-[440px] overflow-y-auto pr-1">
              {d!.asesores.map(a => (
                <FilaParticipacion
                  key={a.id}
                  nombre={a.nombre}
                  monto={mostrar(porBase(a))}
                  participacion={totalBase > 0 ? porBase(a) / totalBase : 0}
                  proporcion={porBase(a) / mayorAsesor}
                  detalle={`${numero(a.ventas)} ${a.ventas === 1 ? 'venta' : 'ventas'}`}
                />
              ))}
            </div>
          )}

          {d && <Concentracion datos={d.concentracionAsesores} etiqueta="Asesor" />}
        </div>
      </div>

      {/* ── Atribución ──────────────────────────────────────────────────── */}
      {d && (
        <div className="card p-5 flex items-center gap-4 flex-wrap">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: d.sinAtribucion === 0 ? '#16a34a' : '#f59e0b' }}
          />
          <div className="flex items-baseline gap-3">
            <span className="text-[26px] font-bold tabular-nums text-on-surface leading-none">
              {numero(d.sinAtribucion)}
            </span>
            <span className="text-[13px] text-on-surface">
              {pct(d.porcentajeSinAtribucion)} de las ventas del período sin asesor o canal asignado
            </span>
          </div>
          {d.sinAtribucion > 0 && (
            <p className="text-[11px] text-on-surface-variant w-full">
              Estas ventas no le suman a nadie en el ranking ni generan comisión. Suelen ser cargos que
              Hotmart no atribuyó al momento de la compra.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
