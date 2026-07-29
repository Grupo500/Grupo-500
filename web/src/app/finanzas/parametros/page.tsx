'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { formatCOP } from '@/lib/utils'
import { numero } from '@/components/finanzas/comunes'
import { cn } from '@/lib/utils'
import { Plus, Trash2, Info } from 'lucide-react'

interface Umbrales {
  rReciente: number; rIntermedio: number; rInactivo: number
  fRecurrente: number; vAlto: number; vMedio: number; nuevoDias: number
}
interface ParametrosData {
  umbrales: Umbrales
  fechaInicioModelo: string
  datos: { primerPago: string | null; ultimoPago: string | null }
  cursos: { id: string; nombre: string; familia: string | null; precioActual: number; historial: { id: string; precio: number; vigenteDesde: string | null; nota: string | null }[] }[]
  inversion: { id: string; plataforma: string; campania: string; desde: string | null; hasta: string | null; gastoCOP: number; impresiones: number; clics: number; conversiones: number }[]
}

const PESTANAS = [
  { id: 'general', label: 'General' },
  { id: 'precios', label: 'Precios oficiales' },
  { id: 'rfv', label: 'Umbrales RFV' },
  { id: 'inversion', label: 'Inversión publicitaria' },
] as const

const CAMPOS_RFV: { clave: keyof Umbrales; label: string; ayuda: string; moneda?: boolean }[] = [
  { clave: 'rReciente',   label: 'Recencia máxima para "reciente"', ayuda: 'Días. Por debajo de este valor el cliente puntúa 3 en recencia.' },
  { clave: 'rIntermedio', label: 'Recencia máxima para "intermedio"', ayuda: 'Días. Más allá, el cliente puntúa 1.' },
  { clave: 'rInactivo',   label: 'Recencia para considerar inactivo', ayuda: 'Días sin comprar tras los cuales el cliente se marca como inactivo.' },
  { clave: 'fRecurrente', label: 'Compras para "recurrente"', ayuda: 'Número de compras independientes desde el cual se considera recurrente.' },
  { clave: 'vAlto',       label: 'Valor neto para "alto valor"', ayuda: 'Neto acumulado por cliente desde el cual puntúa 3 en valor.', moneda: true },
  { clave: 'vMedio',      label: 'Valor neto para "valor medio"', ayuda: 'Neto acumulado desde el cual puntúa 2. Por debajo, puntúa 1.', moneda: true },
  { clave: 'nuevoDias',   label: 'Antigüedad máxima para "nuevo"', ayuda: 'Días desde la primera compra para seguir contando como cliente nuevo.' },
]

export default function ParametrosPage() {
  const qc = useQueryClient()
  const [pestana, setPestana] = useState<typeof PESTANAS[number]['id']>('general')
  const [umbrales, setUmbrales] = useState<Umbrales | null>(null)
  const [guardado, setGuardado] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['finanzas-parametros'],
    queryFn: async () => apiFetch('/finanzas/parametros') as Promise<{ data: ParametrosData }>,
    staleTime: 60_000,
  })
  const d = data?.data

  // El formulario arranca desde lo guardado, pero no se pisa mientras se edita.
  useEffect(() => { if (d?.umbrales && !umbrales) setUmbrales(d.umbrales) }, [d?.umbrales, umbrales])

  const guardarUmbrales = useMutation({
    mutationFn: async (valores: Umbrales) =>
      apiFetch('/finanzas/parametros/umbrales', { method: 'PUT', body: JSON.stringify(valores) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finanzas-parametros'] })
      qc.invalidateQueries({ queryKey: ['finanzas-clientes'] })
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
    },
  })

  // ── Alta de precio oficial ──────────────────────────────────────────────
  const [nuevoPrecio, setNuevoPrecio] = useState({ cursoId: '', precio: '', vigenteDesde: '', nota: '' })
  const crearPrecio = useMutation({
    mutationFn: async () =>
      apiFetch('/finanzas/precios-oficiales', { method: 'POST', body: JSON.stringify(nuevoPrecio) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finanzas-parametros'] })
      qc.invalidateQueries({ queryKey: ['finanzas-precio'] })
      setNuevoPrecio({ cursoId: '', precio: '', vigenteDesde: '', nota: '' })
    },
  })
  const borrarPrecio = useMutation({
    mutationFn: async (id: string) => apiFetch(`/finanzas/precios-oficiales/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finanzas-parametros'] }),
  })

  // ── Alta de inversión ───────────────────────────────────────────────────
  const [nuevaInv, setNuevaInv] = useState({
    plataforma: 'GOOGLE', campania: '', desde: '', hasta: '',
    gastoCOP: '', impresiones: '', clics: '', conversiones: '',
  })
  const crearInv = useMutation({
    mutationFn: async () => apiFetch('/finanzas/inversion', { method: 'POST', body: JSON.stringify(nuevaInv) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finanzas-parametros'] })
      qc.invalidateQueries({ queryKey: ['finanzas-marketing'] })
      setNuevaInv({ plataforma: 'GOOGLE', campania: '', desde: '', hasta: '', gastoCOP: '', impresiones: '', clics: '', conversiones: '' })
    },
  })
  const borrarInv = useMutation({
    mutationFn: async (id: string) => apiFetch(`/finanzas/inversion/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finanzas-parametros'] })
      qc.invalidateQueries({ queryKey: ['finanzas-marketing'] })
    },
  })

  const campo = 'h-9 px-3 rounded-lg border border-surface-high bg-surface-container-lowest text-[12.5px] text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:border-primary w-full'

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Parámetros del modelo"
        subtitle="Lo que se configura aquí cambia cómo se calculan todos los indicadores del área."
      />

      <div className="flex gap-1 border-b border-surface-high overflow-x-auto">
        {PESTANAS.map(p => (
          <button
            key={p.id}
            onClick={() => setPestana(p.id)}
            className={cn(
              'px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors cursor-pointer border-b-2 -mb-px',
              pestana === p.id ? 'border-primary text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── General ─────────────────────────────────────────────────────── */}
      {pestana === 'general' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-[15px] font-semibold text-on-surface">Inicio del modelo</h3>
            <p className="text-[12px] text-on-surface-variant mt-1 mb-3">
              Desde qué fecha se considera que hay historia comparable. Los pagos anteriores quedan
              fuera del acumulado.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[17px] font-semibold tabular-nums text-on-surface">
                {d?.fechaInicioModelo ?? '—'}
              </span>
              <span className="text-[11px] text-on-surface-variant">
                Se cambia con la variable de entorno FINANZAS_FECHA_INICIO
              </span>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-[15px] font-semibold text-on-surface mb-3">Datos cargados</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] text-on-surface-variant">Primer pago registrado</p>
                <p className="text-[15px] font-semibold tabular-nums text-on-surface mt-0.5">{d?.datos.primerPago ?? '—'}</p>
              </div>
              <div className="border-l border-surface-high pl-4">
                <p className="text-[11px] text-on-surface-variant">Último pago registrado</p>
                <p className="text-[15px] font-semibold tabular-nums text-on-surface mt-0.5">{d?.datos.ultimoPago ?? '—'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Precios oficiales ───────────────────────────────────────────── */}
      {pestana === 'precios' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl bg-surface-low p-3.5">
            <Info className="w-4 h-4 text-on-surface-variant shrink-0 mt-0.5" />
            <p className="text-[12px] text-on-surface-variant leading-relaxed">
              Para cambiar un precio se agrega una fila nueva con su fecha de vigencia. Nunca se edita
              la anterior: cada venta se compara contra el precio que regía el día en que ocurrió, y
              borrar la historia haría que los meses pasados se recalcularan mal.
            </p>
          </div>

          <div className="card p-5">
            <h3 className="text-[15px] font-semibold text-on-surface mb-3">Agregar precio</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Select
                value={nuevoPrecio.cursoId}
                onValueChange={v => setNuevoPrecio(s => ({ ...s, cursoId: v }))}
                options={[
                  { value: '', label: 'Elige un curso' },
                  ...(d?.cursos ?? []).map(c => ({ value: c.id, label: c.nombre })),
                ]}
                multilinea
              />
              <input
                type="number" placeholder="Precio" value={nuevoPrecio.precio}
                onChange={e => setNuevoPrecio(s => ({ ...s, precio: e.target.value }))}
                className={campo}
              />
              <input
                type="date" value={nuevoPrecio.vigenteDesde}
                onChange={e => setNuevoPrecio(s => ({ ...s, vigenteDesde: e.target.value }))}
                className={campo}
              />
              <button
                onClick={() => crearPrecio.mutate()}
                disabled={!nuevoPrecio.cursoId || !nuevoPrecio.precio || !nuevoPrecio.vigenteDesde || crearPrecio.isPending}
                className="h-9 px-4 rounded-lg bg-primary text-white text-[12.5px] font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                {crearPrecio.isPending ? 'Guardando…' : 'Agregar'}
              </button>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-[15px] font-semibold text-on-surface mb-3">Precios registrados</h3>
            {isLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-9 rounded bg-surface-high animate-pulse" />)}</div>
            ) : (
              <div className="space-y-1">
                {(d?.cursos ?? []).map(c => (
                  <div key={c.id} className="py-2.5 border-b border-surface-high last:border-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-medium text-on-surface truncate">{c.nombre}</p>
                        <p className="text-[10.5px] text-on-surface-variant">
                          Precio actual del curso {formatCOP(c.precioActual)}
                          {c.historial.length === 0 && ' · sin historial oficial cargado'}
                        </p>
                      </div>
                      <div className="shrink-0 space-y-1">
                        {c.historial.map(h => (
                          <div key={h.id} className="flex items-center gap-2 justify-end">
                            <span className="text-[12px] tabular-nums text-on-surface whitespace-nowrap">
                              {formatCOP(h.precio)}
                              <span className="text-[10.5px] text-on-surface-variant ml-2">desde {h.vigenteDesde}</span>
                            </span>
                            <button
                              onClick={() => borrarPrecio.mutate(h.id)}
                              className="w-6 h-6 rounded flex items-center justify-center text-on-surface-variant hover:text-[#dc2626] hover:bg-surface-high transition-colors cursor-pointer"
                              aria-label="Eliminar precio"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Umbrales RFV ────────────────────────────────────────────────── */}
      {pestana === 'rfv' && umbrales && (
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div>
              <h3 className="text-[15px] font-semibold text-on-surface">Umbrales de segmentación</h3>
              <p className="text-[12px] text-on-surface-variant mt-0.5">
                Definen desde cuándo un cliente es reciente, recurrente o de alto valor.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {guardado && <span className="text-[12px] font-medium" style={{ color: '#15803d' }}>Guardado</span>}
              <button
                onClick={() => guardarUmbrales.mutate(umbrales)}
                disabled={guardarUmbrales.isPending}
                className="h-9 px-4 rounded-lg bg-primary text-white text-[12.5px] font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity cursor-pointer"
              >
                {guardarUmbrales.isPending ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {CAMPOS_RFV.map(c => (
              <div key={c.clave} className="flex items-center justify-between gap-4 py-2.5 border-b border-surface-high last:border-0">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-on-surface">{c.label}</p>
                  <p className="text-[10.5px] text-on-surface-variant mt-0.5">{c.ayuda}</p>
                </div>
                <div className="shrink-0 w-[150px]">
                  <input
                    type="number"
                    value={umbrales[c.clave]}
                    onChange={e => setUmbrales(u => (u ? { ...u, [c.clave]: Number(e.target.value) } : u))}
                    className={`${campo} text-right tabular-nums`}
                  />
                  {c.moneda && (
                    <p className="text-[10px] text-on-surface-variant text-right mt-0.5">{formatCOP(umbrales[c.clave])}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Inversión publicitaria ──────────────────────────────────────── */}
      {pestana === 'inversion' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl bg-surface-low p-3.5">
            <Info className="w-4 h-4 text-on-surface-variant shrink-0 mt-0.5" />
            <p className="text-[12px] text-on-surface-variant leading-relaxed">
              Carga aquí el gasto de cada campaña tal como aparece en el reporte de la plataforma.
              El período importa: Google y TikTok no traen fechas en sus exportaciones y el gasto se
              reparte entre los días que declares.
            </p>
          </div>

          <div className="card p-5">
            <h3 className="text-[15px] font-semibold text-on-surface mb-3">Agregar campaña</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Select
                value={nuevaInv.plataforma}
                onValueChange={v => setNuevaInv(s => ({ ...s, plataforma: v }))}
                options={[
                  { value: 'GOOGLE', label: 'Google Ads' },
                  { value: 'META', label: 'Meta Ads' },
                  { value: 'TIKTOK', label: 'TikTok Ads' },
                ]}
              />
              <input placeholder="Nombre de la campaña" value={nuevaInv.campania}
                onChange={e => setNuevaInv(s => ({ ...s, campania: e.target.value }))} className={`${campo} col-span-1 lg:col-span-3`} />
              <input type="date" value={nuevaInv.desde}
                onChange={e => setNuevaInv(s => ({ ...s, desde: e.target.value }))} className={campo} />
              <input type="date" value={nuevaInv.hasta}
                onChange={e => setNuevaInv(s => ({ ...s, hasta: e.target.value }))} className={campo} />
              <input type="number" placeholder="Gasto en pesos" value={nuevaInv.gastoCOP}
                onChange={e => setNuevaInv(s => ({ ...s, gastoCOP: e.target.value }))} className={campo} />
              <input type="number" placeholder="Impresiones" value={nuevaInv.impresiones}
                onChange={e => setNuevaInv(s => ({ ...s, impresiones: e.target.value }))} className={campo} />
              <input type="number" placeholder="Clics" value={nuevaInv.clics}
                onChange={e => setNuevaInv(s => ({ ...s, clics: e.target.value }))} className={campo} />
              <button
                onClick={() => crearInv.mutate()}
                disabled={!nuevaInv.campania || !nuevaInv.desde || !nuevaInv.hasta || !nuevaInv.gastoCOP || crearInv.isPending}
                className="h-9 px-4 rounded-lg bg-primary text-white text-[12.5px] font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                {crearInv.isPending ? 'Guardando…' : 'Agregar'}
              </button>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-[15px] font-semibold text-on-surface mb-3">Campañas cargadas</h3>
            {(d?.inversion.length ?? 0) === 0 ? (
              <p className="text-[13px] text-on-surface-variant text-center py-6">
                Todavía no hay ninguna campaña cargada
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-surface-high">
                      <th className="px-2 py-2 text-left text-[11.5px] font-semibold text-on-surface-variant">Plataforma</th>
                      <th className="px-2 py-2 text-left text-[11.5px] font-semibold text-on-surface-variant">Campaña</th>
                      <th className="px-2 py-2 text-left text-[11.5px] font-semibold text-on-surface-variant">Período</th>
                      <th className="px-2 py-2 text-right text-[11.5px] font-semibold text-on-surface-variant">Gasto</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {d!.inversion.map(i => (
                      <tr key={i.id} className="border-b border-surface-high last:border-0">
                        <td className="px-2 py-2.5 text-[12.5px] text-on-surface-variant whitespace-nowrap">{i.plataforma}</td>
                        <td className="px-2 py-2.5 text-[12.5px] text-on-surface min-w-[180px]">{i.campania}</td>
                        <td className="px-2 py-2.5 text-[11.5px] text-on-surface-variant whitespace-nowrap">{i.desde} → {i.hasta}</td>
                        <td className="px-2 py-2.5 text-right text-[12.5px] tabular-nums text-on-surface whitespace-nowrap">{formatCOP(i.gastoCOP)}</td>
                        <td className="px-2 py-2.5 text-right">
                          <button
                            onClick={() => borrarInv.mutate(i.id)}
                            className="w-7 h-7 rounded flex items-center justify-center text-on-surface-variant hover:text-[#dc2626] hover:bg-surface-high transition-colors cursor-pointer"
                            aria-label="Eliminar campaña"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
