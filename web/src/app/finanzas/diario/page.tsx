'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCOP } from '@/lib/utils'
import { numero, pct } from '@/components/finanzas/comunes'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

interface DiarioData {
  dia: string
  disponible: { desde: string | null; hasta: string | null }
  totales: {
    ventasNuevas: number; valorVendido: number; cobrado: number; neto: number
    clientes: number; contado: number; plazos: number
    cuotasPosteriores: number; valorCuotasPosteriores: number
  }
  productos: { nombre: string; ventas: number; valor: number; participacion: number }[]
  asesores: { id: string; nombre: string; ventas: number; valor: number; participacion: number }[]
}

/** Suma días a una fecha ISO sin cruzar husos: se opera al mediodía UTC. */
function correrDia(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function enLetras(iso: string): string {
  const t = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${iso}T12:00:00.000Z`))
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function Tabla({ titulo, filas, etiquetaPrimera }: {
  titulo: string
  filas: { nombre: string; ventas: number; valor: number; participacion: number }[]
  etiquetaPrimera: string
}) {
  return (
    <div className="card p-5">
      <h3 className="text-[15px] font-semibold text-on-surface mb-3">{titulo}</h3>
      {filas.length === 0 ? (
        <p className="text-[13px] text-on-surface-variant text-center py-6">Sin ventas este día</p>
      ) : (
        <div className="space-y-0.5">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 pb-1.5 border-b border-surface-high">
            <span className="text-[11px] font-semibold text-on-surface-variant">{etiquetaPrimera}</span>
            <span className="text-[11px] font-semibold text-on-surface-variant text-right w-14">Ventas</span>
            <span className="text-[11px] font-semibold text-on-surface-variant text-right w-28">Valor</span>
          </div>
          {filas.map(f => (
            <div key={f.nombre} className="relative grid grid-cols-[1fr_auto_auto] gap-3 items-center py-2 px-1 rounded-md overflow-hidden">
              <span
                className="absolute inset-y-0 left-0 rounded-md pointer-events-none"
                style={{ width: `${f.participacion * 100}%`, background: 'rgba(26,125,224,0.10)' }}
              />
              <span className="relative text-[12.5px] text-on-surface truncate">{f.nombre}</span>
              <span className="relative text-[12.5px] tabular-nums text-on-surface-variant text-right w-14">{numero(f.ventas)}</span>
              <span className="relative text-right tabular-nums w-28 whitespace-nowrap">
                <span className="text-[12.5px] font-semibold text-on-surface">{formatCOP(f.valor)}</span>
                <span className="block text-[10px] font-normal text-on-surface-variant">{pct(f.participacion)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ReporteDiarioPage() {
  const [dia, setDia] = useState(() => new Date().toLocaleDateString('en-CA'))

  const { data, isLoading } = useQuery({
    queryKey: ['finanzas-diario', dia],
    queryFn: async () => apiFetch(`/finanzas/diario?dia=${dia}`) as Promise<{ data: DiarioData }>,
    staleTime: 60_000,
  })

  const d = data?.data
  const t = d?.totales
  const tope = d?.disponible.hasta ?? dia
  const piso = d?.disponible.desde ?? dia

  const kpis = [
    { etiqueta: 'Ventas nuevas', valor: numero(t?.ventasNuevas ?? 0) },
    { etiqueta: 'Valor vendido', valor: formatCOP(t?.valorVendido ?? 0) },
    { etiqueta: 'Cobrado', valor: formatCOP(t?.cobrado ?? 0) },
    { etiqueta: 'Neto recibido', valor: formatCOP(t?.neto ?? 0) },
    { etiqueta: 'Clientes', valor: numero(t?.clientes ?? 0) },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Reporte diario"
        subtitle="Solo depende del día elegido. No lo afecta el mes seleccionado en el resto del área."
        actions={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setDia(correrDia(dia, -1))}
              disabled={dia <= piso}
              className="w-8 h-8 rounded-lg border border-surface-high flex items-center justify-center text-on-surface-variant hover:bg-surface-high disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              aria-label="Día anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <label className="relative flex items-center gap-2 px-3 h-8 rounded-lg border border-surface-high cursor-pointer hover:bg-surface-high transition-colors">
              <CalendarDays className="w-3.5 h-3.5 text-on-surface-variant" />
              <span className="text-[12.5px] text-on-surface whitespace-nowrap">{enLetras(dia)}</span>
              {/* El campo nativo va encima e invisible: aporta el calendario del
                  sistema sin heredar su estética, que no encaja con la app. */}
              <input
                type="date" value={dia} min={piso} max={tope}
                onChange={e => e.target.value && setDia(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
            <button
              onClick={() => setDia(correrDia(dia, 1))}
              disabled={dia >= tope}
              className="w-8 h-8 rounded-lg border border-surface-high flex items-center justify-center text-on-surface-variant hover:bg-surface-high disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              aria-label="Día siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map(k => (
          <div key={k.etiqueta} className="card p-4">
            <p className="text-[11.5px] font-medium text-on-surface-variant">{k.etiqueta}</p>
            <p className="text-[20px] font-bold tabular-nums text-on-surface mt-1">
              {isLoading ? '—' : k.valor}
            </p>
          </div>
        ))}
      </div>

      {/* Modalidad del día, en otro tono para que no compita con lo anterior */}
      <div className="card p-4">
        <p className="text-[11.5px] font-semibold text-on-surface-variant mb-3">Modalidad del día</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { t: 'De contado', v: numero(t?.contado ?? 0) },
            { t: 'A plazos', v: numero(t?.plazos ?? 0) },
            {
              t: 'Cuotas posteriores cobradas',
              v: numero(t?.cuotasPosteriores ?? 0),
              extra: formatCOP(t?.valorCuotasPosteriores ?? 0),
            },
          ].map((x, i) => (
            <div key={x.t} className={i > 0 ? 'border-l border-surface-high pl-4' : ''}>
              <p className="text-[11px] text-on-surface-variant leading-tight">{x.t}</p>
              <p className="text-[17px] font-semibold tabular-nums text-on-surface mt-0.5">{isLoading ? '—' : x.v}</p>
              {x.extra && <p className="text-[10.5px] text-on-surface-variant tabular-nums">{x.extra}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Tabla titulo="Desglose por producto" filas={d?.productos ?? []} etiquetaPrimera="Producto" />
        <Tabla titulo="Desglose por asesor o canal" filas={d?.asesores ?? []} etiquetaPrimera="Asesor o canal" />
      </div>
    </div>
  )
}
