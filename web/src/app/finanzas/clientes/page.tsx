'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { formatCOP } from '@/lib/utils'
import { numero, pct } from '@/components/finanzas/comunes'
import { Search } from 'lucide-react'

interface Cliente {
  id: string; nombre: string; email: string | null
  primeraCompra: string | null; ultimaCompra: string | null
  recencia: number; compras: number
  valorVendido: number; neto: number
  recompra: boolean; ventaCruzada: boolean
  segmento: string
}

interface RfvData {
  corte: string
  totales: {
    clientes: number; conRecompra: number; tasaRecompra: number
    conVentaCruzada: number; tasaVentaCruzada: number
    medianaDiasSegundaCompra: number | null
  }
  segmentos: { nombre: string; clientes: number; neto: number; porcentaje: number; recenciaPromedio: number }[]
  tramosRecencia: { etiqueta: string; nombre: string; clientes: number }[]
  clientes: Cliente[]
  totalClientes: number
}

const COLOR_SEGMENTO: Record<string, string> = {
  'Nuevos': '#1a7de0',
  'Clientes con potencial de recompra': '#f59e0b',
  'Clientes con segunda compra': '#16a34a',
  'Clientes con venta cruzada': '#7c3aed',
  'Clientes inactivos': '#94a3b8',
}

/** Descripción de cada segmento: sin ella los nombres se prestan a interpretación. */
const QUE_SIGNIFICA: Record<string, string> = {
  'Nuevos': 'Una sola compra y poca antigüedad. Todavía no dan señales.',
  'Clientes con potencial de recompra': 'Una compra, pero ya con recorrido. Vale la pena volver a contactarlos.',
  'Clientes con segunda compra': 'Ya repitieron con el mismo producto.',
  'Clientes con venta cruzada': 'Repitieron con un producto distinto. Es la mejor señal.',
  'Clientes inactivos': 'Pasaron demasiados días desde su última compra.',
}

export default function ClientesRfvPage() {
  const [busqueda, setBusqueda] = useState('')
  const [segmento, setSegmento] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['finanzas-clientes'],
    queryFn: async () => apiFetch('/finanzas/clientes') as Promise<{ data: RfvData }>,
    staleTime: 120_000,
  })

  const d = data?.data
  const t = d?.totales

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return (d?.clientes ?? []).filter(c =>
      (!segmento || c.segmento === segmento) &&
      (!texto || c.nombre.toLowerCase().includes(texto) || (c.email ?? '').toLowerCase().includes(texto))
    )
  }, [d?.clientes, busqueda, segmento])

  const maxTramo = Math.max(...(d?.tramosRecencia ?? []).map(t => t.clientes), 1)

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Clientes y segmentación RFV"
        subtitle={
          d
            ? `Recencia, frecuencia y valor. Es una foto al ${Number(d.corte.slice(8, 10))} de este mes, no un acumulado.`
            : 'Recencia, frecuencia y valor'
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { e: 'Clientes únicos', v: numero(t?.clientes ?? 0) },
          { e: 'Tasa de recompra', v: pct(t?.tasaRecompra ?? null), n: `${numero(t?.conRecompra ?? 0)} clientes` },
          { e: 'Venta cruzada', v: pct(t?.tasaVentaCruzada ?? null), n: 'sobre quienes recompraron' },
          {
            e: 'Días hasta la segunda compra',
            v: t?.medianaDiasSegundaCompra !== null && t?.medianaDiasSegundaCompra !== undefined
              ? numero(t.medianaDiasSegundaCompra) : '—',
            n: 'mediana',
          },
        ].map(k => (
          <div key={k.e} className="card p-4">
            <p className="text-[11.5px] font-medium text-on-surface-variant">{k.e}</p>
            <p className="text-[22px] font-bold tabular-nums text-on-surface mt-1">{isLoading ? '—' : k.v}</p>
            {k.n && <p className="text-[10.5px] text-on-surface-variant mt-0.5">{k.n}</p>}
          </div>
        ))}
      </div>

      {/* ── Distribución por segmento ───────────────────────────────────── */}
      <div className="card p-5">
        <h3 className="text-[15px] font-semibold text-on-surface mb-4">Distribución por segmento</h3>

        {isLoading ? (
          <div className="h-32 rounded-xl bg-surface-high animate-pulse" />
        ) : (
          <>
            <div className="flex gap-[3px] mb-5">
              {d!.segmentos.map(s => (
                <div
                  key={s.nombre}
                  className="h-3 first:rounded-l last:rounded-r"
                  style={{ width: `${s.porcentaje * 100}%`, background: COLOR_SEGMENTO[s.nombre] ?? '#94a3b8' }}
                  title={`${s.nombre} · ${numero(s.clientes)}`}
                />
              ))}
            </div>

            <div className="space-y-3">
              {d!.segmentos.map(s => (
                <div key={s.nombre} className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                      style={{ background: COLOR_SEGMENTO[s.nombre] ?? '#94a3b8' }}
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-on-surface">{s.nombre}</p>
                      <p className="text-[11px] text-on-surface-variant">{QUE_SIGNIFICA[s.nombre] ?? ''}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <p className="text-[13px] font-semibold text-on-surface">
                      {numero(s.clientes)}
                      <span className="text-[10.5px] font-normal text-on-surface-variant ml-1.5">{pct(s.porcentaje)}</span>
                    </p>
                    <p className="text-[10.5px] text-on-surface-variant">{formatCOP(s.neto)} neto</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Recencia ────────────────────────────────────────────────────── */}
      <div className="card p-5">
        <h3 className="text-[15px] font-semibold text-on-surface mb-1">Distribución de recencia</h3>
        <p className="text-[11.5px] text-on-surface-variant mb-4">Días desde la última compra. Menos es mejor.</p>

        <div className="grid grid-cols-4 gap-3 items-end h-36">
          {(d?.tramosRecencia ?? []).map(tr => (
            <div key={tr.etiqueta} className="flex flex-col items-center justify-end h-full gap-2">
              <span className="text-[12px] font-semibold tabular-nums text-on-surface">{numero(tr.clientes)}</span>
              <div
                className="w-full rounded-t transition-all duration-500"
                style={{
                  height: `${Math.max(4, (tr.clientes / maxTramo) * 100)}%`,
                  background: tr.nombre === 'Inactivo' ? '#94a3b8' : tr.nombre === 'En riesgo' ? '#f59e0b' : 'var(--primary)',
                }}
              />
              <div className="text-center">
                <p className="text-[11px] font-medium text-on-surface">{tr.nombre}</p>
                <p className="text-[10px] text-on-surface-variant">{tr.etiqueta}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Base de clientes ────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h3 className="text-[15px] font-semibold text-on-surface">Base de clientes</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={segmento}
              onValueChange={setSegmento}
              options={[
                { value: '', label: 'Todos los segmentos' },
                ...(d?.segmentos ?? []).map(s => ({ value: s.nombre, label: s.nombre })),
              ]}
              anchoAuto
            />
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant pointer-events-none" />
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o correo"
                className="h-9 pl-8 pr-3 rounded-lg border border-surface-high bg-surface-container-lowest text-[12.5px] text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:border-primary w-[220px]"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-9 rounded bg-surface-high animate-pulse" />)}
          </div>
        ) : filtrados.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant text-center py-8">Ningún cliente coincide con el filtro</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-surface-high">
                  <th className="px-2 py-2 text-left text-[11.5px] font-semibold text-on-surface-variant">Cliente</th>
                  <th className="px-2 py-2 text-right text-[11.5px] font-semibold text-on-surface-variant whitespace-nowrap">Primera compra</th>
                  <th className="px-2 py-2 text-right text-[11.5px] font-semibold text-on-surface-variant whitespace-nowrap">Recencia</th>
                  <th className="px-2 py-2 text-right text-[11.5px] font-semibold text-on-surface-variant">Compras</th>
                  <th className="px-2 py-2 text-right text-[11.5px] font-semibold text-on-surface-variant">Neto</th>
                  <th className="px-2 py-2 text-left text-[11.5px] font-semibold text-on-surface-variant">Segmento</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.slice(0, 100).map(c => (
                  <tr key={c.id} className="border-b border-surface-high hover:bg-surface-low transition-colors">
                    <td className="px-2 py-2.5 min-w-[180px]">
                      <p className="text-[12.5px] font-medium text-on-surface truncate">{c.nombre}</p>
                      {c.email && <p className="text-[10.5px] text-on-surface-variant truncate">{c.email}</p>}
                    </td>
                    <td className="px-2 py-2.5 text-right text-[12px] tabular-nums text-on-surface-variant whitespace-nowrap">
                      {c.primeraCompra ?? '—'}
                    </td>
                    <td className="px-2 py-2.5 text-right text-[12px] tabular-nums text-on-surface whitespace-nowrap">
                      {numero(c.recencia)} días
                    </td>
                    <td className="px-2 py-2.5 text-right text-[12px] tabular-nums text-on-surface">{numero(c.compras)}</td>
                    <td className="px-2 py-2.5 text-right text-[12px] tabular-nums text-on-surface whitespace-nowrap">{formatCOP(c.neto)}</td>
                    <td className="px-2 py-2.5">
                      <span
                        className="text-[10.5px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{
                          background: `${COLOR_SEGMENTO[c.segmento] ?? '#94a3b8'}1f`,
                          color: COLOR_SEGMENTO[c.segmento] ?? '#64748b',
                        }}
                      >
                        {c.segmento}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-[11px] text-on-surface-variant mt-3">
              Mostrando {numero(Math.min(filtrados.length, 100))} de {numero(filtrados.length)} filtrados
              {d && d.totalClientes > d.clientes.length && ` · base total ${numero(d.totalClientes)} clientes`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
