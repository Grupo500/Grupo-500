'use client'

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { formatCOP } from '@/lib/utils'
import { numero } from '@/components/finanzas/comunes'

export interface DiaSerie {
  fecha: string
  ventas: number
  valor: number
  cobrado: number
  pm7: number
}

/** ¿Es sábado o domingo? Se calcula al mediodía UTC para no cruzar de día. */
function esFinDeSemana(iso: string): boolean {
  const d = new Date(`${iso}T12:00:00.000Z`).getUTCDay()
  return d === 0 || d === 6
}

function diaConMes(iso: string): string {
  const f = new Date(`${iso}T12:00:00.000Z`)
  const mes = new Intl.DateTimeFormat('es-CO', { month: 'long', timeZone: 'UTC' }).format(f)
  const semana = new Intl.DateTimeFormat('es-CO', { weekday: 'long', timeZone: 'UTC' }).format(f)
  const texto = `${semana}, ${f.getUTCDate()} de ${mes}`
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * Tooltip propio.
 *
 * El de Recharts se configuraba con `contentStyle` y quedaba translúcido: el
 * texto se mezclaba con las barras de abajo y el valor de ventas no se leía.
 * Con un componente propio el fondo es sólido y el contenido se ordena como
 * conviene, no como salga del formateador.
 */
function Globo({ active, payload, label }: {
  active?: boolean
  payload?: { payload: DiaSerie }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload

  return (
    <div className="rounded-xl border border-surface-high bg-surface-container-lowest shadow-lg px-3 py-2.5 min-w-[190px]">
      <p className="text-[11.5px] font-semibold text-on-surface mb-1.5">{diaConMes(String(label))}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[11.5px] text-on-surface-variant">
            <span className="w-2 h-2 rounded-sm" style={{ background: 'var(--primary)' }} />
            Ventas nuevas
          </span>
          <span className="text-[12px] font-semibold tabular-nums text-on-surface">{numero(d.ventas)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[11.5px] text-on-surface-variant pl-3.5">Valor vendido</span>
          <span className="text-[12px] tabular-nums text-on-surface">{formatCOP(d.valor)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 pt-1 mt-1 border-t border-surface-high">
          <span className="flex items-center gap-1.5 text-[11.5px] text-on-surface-variant">
            <span className="w-2 h-[2px] rounded-full" style={{ background: '#7c3aed' }} />
            Promedio de 7 días
          </span>
          <span className="text-[12px] tabular-nums text-on-surface">
            {d.pm7.toFixed(1).replace('.', ',')}
          </span>
        </div>
      </div>
    </div>
  )
}

export function SerieDiaria({ dias, altura = 320 }: { dias: DiaSerie[]; altura?: number }) {
  const promedio = dias.length > 0 ? dias.reduce((s, d) => s + d.ventas, 0) / dias.length : 0

  return (
    <>
      {/* Leyenda propia: la de Recharts no permite explicar qué es cada serie */}
      <div className="flex items-center gap-4 flex-wrap mb-3">
        <span className="flex items-center gap-1.5 text-[11.5px] text-on-surface-variant">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--primary)' }} />
          Ventas del día
        </span>
        <span className="flex items-center gap-1.5 text-[11.5px] text-on-surface-variant">
          <span className="w-4 h-[2px] rounded-full" style={{ background: '#7c3aed' }} />
          Promedio de 7 días
        </span>
        <span className="flex items-center gap-1.5 text-[11.5px] text-on-surface-variant">
          <span className="w-2.5 h-2.5 rounded-sm bg-surface-high" />
          Fin de semana
        </span>
      </div>

      <ResponsiveContainer width="100%" height={altura}>
        <ComposedChart data={dias} margin={{ top: 8, right: 8, left: -16, bottom: 4 }}>
          <defs>
            <linearGradient id="barraVentas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.55} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="2 4" stroke="var(--surface-high)" vertical={false} />
          <XAxis
            dataKey="fecha" tickLine={false}
            axisLine={{ stroke: 'var(--surface-high)' }}
            tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }}
            tickFormatter={f => String(f).slice(8, 10)}
            interval="preserveStartEnd"
            minTickGap={8}
            padding={{ left: 4, right: 4 }}
          />
          <YAxis
            tickLine={false} axisLine={false}
            tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }}
            width={44}
          />
          <Tooltip
            content={<Globo />}
            // El resaltado por defecto es un rectángulo gris opaco que tapa la
            // barra justo cuando se la quiere mirar.
            cursor={{ fill: 'var(--surface-high)', fillOpacity: 0.45 }}
          />

          <Bar dataKey="ventas" radius={[4, 4, 0, 0]} maxBarSize={30}>
            {dias.map(d => (
              // Los fines de semana van atenuados: sin eso, un domingo flojo se
              // lee como una caída del ritmo y no lo es.
              <Cell
                key={d.fecha}
                fill={esFinDeSemana(d.fecha) ? 'var(--surface-high)' : 'url(#barraVentas)'}
              />
            ))}
          </Bar>

          <Line
            type="monotone" dataKey="pm7"
            stroke="#7c3aed" strokeWidth={2.5} dot={false}
            activeDot={{ r: 4, fill: '#7c3aed', stroke: 'var(--surface-container-lowest)', strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {dias.length > 0 && (
        <p className="text-[10.5px] text-on-surface-variant mt-2 tabular-nums">
          Promedio del período {promedio.toFixed(1).replace('.', ',')} ventas por día ·
          los primeros seis días tienen el promedio móvil subestimado porque no hay siete días detrás.
        </p>
      )}
    </>
  )
}
