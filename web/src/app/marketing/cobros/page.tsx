'use client'

// Cobros freelance del área de Marketing.
//
// Pantalla propia y no una columna dentro de Entregables: un freelance puede
// estar esperando aprobación desde que se le encarga el trabajo, mucho antes
// de publicar nada, y en Entregables —que lista lo publicado— no tendría dónde
// aparecer. Además lo ya pagado se quedaría mezclado con los enlaces del mes.
//
// Se entra por la tabla de liquidación —una fila por persona— porque a un
// freelance no se le hacen cinco transferencias, se le hace una. Al elegir a
// alguien en el filtro, la pantalla se abre en el detalle de sus trabajos, con
// la misma forma de Entregables.
//
// Quién ve qué lo decide el backend: los líderes reciben los de todo el equipo
// y `puedeAprobar` en true; el resto recibe solo los suyos.

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { Loader2, Check, Wallet, BadgeCheck, AlertTriangle } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { cn, formatCOP } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { AvatarMiembro } from '@/components/marketing/AvatarMiembro'

type EstadoCobro = 'POR_APROBAR' | 'APROBADO' | 'PAGADO'

interface Persona {
  id: string; nombre: string; rut: string | null
  user?: { image: string | null }
}
interface Cobro {
  id: string
  titulo: string
  tipo: string
  fecha: string
  valor: number | null
  estadoCobro: EstadoCobro
  aprobadoEn: string | null
  pagadoEn: string | null
  asignadoA: Persona | null
  aprobadoPor: { id: string; nombre: string } | null
  entregables: { id: string; publicadoEn: string }[]
}

interface Respuesta {
  cobros: Cobro[]
  puedeAprobar: boolean
  totales: { porAprobar: number; aprobado: number; pagado: number }
}

const ESTADO_LABEL: Record<EstadoCobro, string> = {
  POR_APROBAR: 'Por aprobar',
  APROBADO: 'Aprobado',
  PAGADO: 'Pagado',
}

// Ámbar lo que espera acción, verde lo aprobado, gris lo cerrado. Mismo
// lenguaje de color que el resto del área.
const ESTADO_CLASE: Record<EstadoCobro, string> = {
  POR_APROBAR: 'bg-[#d97706]/15 text-[#9a5b06]',
  APROBADO:    'bg-[#16a34a]/15 text-[#0f7a35]',
  PAGADO:      'bg-surface-high text-on-surface-variant',
}

const SIN_ASIGNAR = '__sin__'

function mesActualISO() {
  const hoy = new Date()
  return { desde: format(startOfMonth(hoy), 'yyyy-MM-dd'), hasta: format(endOfMonth(hoy), 'yyyy-MM-dd') }
}

/** En qué va el trabajo, no solo la fecha: quien aprueba necesita saberlo. */
function detalleDe(c: Cobro, conNombre: boolean) {
  const quien = conNombre ? `${c.asignadoA?.nombre ?? 'Sin asignar'} · ` : ''
  const cuando = c.pagadoEn
    ? `pagado el ${format(new Date(c.pagadoEn), "d 'de' MMMM", { locale: es })}`
    : c.aprobadoEn
      ? `aprobado por ${c.aprobadoPor?.nombre ?? 'alguien'} el ${format(new Date(c.aprobadoEn), "d 'de' MMMM", { locale: es })}`
      : c.entregables.length > 0
        ? `entregado el ${format(new Date(c.entregables[0].publicadoEn), "d 'de' MMMM", { locale: es })}`
        : 'en proceso, sin entregar'
  return quien + cuando
}

export default function CobrosPage() {
  const queryClient = useQueryClient()
  const [rango] = useState(mesActualISO)
  const [estado, setEstado] = useState('')
  const [persona, setPersona] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['marketing-cobros', rango.desde, rango.hasta, estado],
    queryFn: () => apiFetch<{ data: Respuesta }>(
      `/marketing/cobros?desde=${rango.desde}&hasta=${rango.hasta}${estado ? `&estado=${estado}` : ''}`,
    ),
  })
  const r = data?.data
  const cobros = r?.cobros ?? []
  const puedeAprobar = r?.puedeAprobar ?? false

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['marketing-cobros'] })

  const mover = useMutation({
    mutationFn: ({ id, accion }: { id: string; accion: 'aprobar' | 'pagar' }) =>
      apiFetch(`/marketing/cobros/${id}/${accion}`, { method: 'PATCH' }),
    onSuccess: invalidar,
  })

  const moverLote = useMutation({
    mutationFn: ({ ids, accion }: { ids: string[]; accion: 'aprobar' | 'pagar' }) =>
      apiFetch('/marketing/cobros/lote', { method: 'PATCH', body: JSON.stringify({ ids, accion }) }),
    onSuccess: invalidar,
  })
  const ocupado = mover.isPending || moverLote.isPending

  // Una entrada por persona con sus tres montos. Se arma sobre lo mismo que se
  // lista, así que la tabla y el detalle nunca pueden discrepar.
  const porPersona = useMemo(() => {
    const mapa = new Map<string, {
      id: string; nombre: string; rut: string | null; foto: string | null
      cobros: Cobro[]; porAprobar: number; aprobado: number; pagado: number
    }>()
    for (const c of cobros) {
      const id = c.asignadoA?.id ?? SIN_ASIGNAR
      if (!mapa.has(id)) mapa.set(id, {
        id,
        nombre: c.asignadoA?.nombre ?? 'Sin asignar',
        rut:    c.asignadoA?.rut ?? null,
        foto:   c.asignadoA?.user?.image ?? null,
        cobros: [], porAprobar: 0, aprobado: 0, pagado: 0,
      })
      const g = mapa.get(id)!
      g.cobros.push(c)
      const v = c.valor ?? 0
      if (c.estadoCobro === 'POR_APROBAR') g.porAprobar += v
      else if (c.estadoCobro === 'APROBADO') g.aprobado += v
      else g.pagado += v
    }
    return [...mapa.values()].sort((a, b) =>
      // Primero a quien hay que pagarle: lo pendiente manda sobre el alfabeto.
      (b.porAprobar + b.aprobado) - (a.porAprobar + a.aprobado) || a.nombre.localeCompare(b.nombre),
    )
  }, [cobros])

  const elegida = persona ? porPersona.find(p => p.id === persona) ?? null : null

  const idsEn = (lista: Cobro[], e: EstadoCobro) =>
    lista.filter(c => c.estadoCobro === e).map(c => c.id)

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title={puedeAprobar ? 'Cobros freelance' : 'Mis cobros'}
        subtitle={puedeAprobar
          ? 'Cuánto se le debe a cada quien, y por qué trabajos'
          : 'Tus trabajos freelance y en qué van'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* El filtro es también el conmutador de vista: elegir a alguien
                abre su detalle, y "Todo el equipo" vuelve a la liquidación. */}
            {puedeAprobar && (
              <Select
                value={persona}
                onValueChange={setPersona}
                className="input-base w-[190px]"
                options={[
                  { value: '', label: 'Todo el equipo' },
                  ...porPersona.map(p => ({ value: p.id, label: p.nombre })),
                ]}
              />
            )}
            <Select
              value={estado}
              onValueChange={setEstado}
              className="input-base w-[170px]"
              options={[
                { value: '', label: 'Todos los estados' },
                ...(Object.keys(ESTADO_LABEL) as EstadoCobro[]).map(e => ({ value: e, label: ESTADO_LABEL[e] })),
              ]}
            />
          </div>
        }
      />

      {/* Los totales salen de lo mismo que se lista, así que siempre cuadran
          con las filas de abajo. */}
      <div className={cn('grid gap-3', puedeAprobar ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
        {[
          { l: 'Por aprobar', v: elegida ? elegida.porAprobar : r?.totales.porAprobar, c: 'text-[#9a5b06]' },
          ...(puedeAprobar ? [{ l: 'Aprobado sin pagar', v: elegida ? elegida.aprobado : r?.totales.aprobado, c: 'text-[#0f7a35]' }] : []),
          { l: 'Pagado este mes', v: elegida ? elegida.pagado : r?.totales.pagado, c: 'text-on-surface' },
        ].map(k => (
          <div key={k.l} className="card p-4">
            <p className="text-[11px] text-on-surface-variant">{k.l}</p>
            <p className={cn('mt-1 text-[19px] font-bold tracking-[-0.02em] tabular-nums', k.c)}>
              {isLoading ? '—' : formatCOP(k.v ?? 0)}
            </p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="card-panel flex items-center justify-center py-16 text-on-surface-variant">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : cobros.length === 0 ? (
        <div className="card-panel py-16 text-center text-[13px] text-on-surface-variant">
          No hay cobros freelance en este período.
        </div>

      /* ── Liquidación: una fila por persona ─────────────────────────────── */
      ) : puedeAprobar && !elegida ? (
        <div className="card-panel overflow-x-auto p-0">
          <table className="w-full min-w-[620px] border-collapse">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className="px-4 py-3 text-left text-[10.5px] font-semibold text-on-surface-variant">Persona</th>
                <th className="px-4 py-3 text-right text-[10.5px] font-semibold text-on-surface-variant">Por aprobar</th>
                <th className="px-4 py-3 text-right text-[10.5px] font-semibold text-on-surface-variant">Aprobado</th>
                <th className="px-4 py-3 text-right text-[10.5px] font-semibold text-on-surface-variant">Pagado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {porPersona.map(p => {
                const idsPorAprobar = idsEn(p.cobros, 'POR_APROBAR')
                const idsAprobados  = idsEn(p.cobros, 'APROBADO')
                return (
                  <tr key={p.id} className="border-b border-outline-variant/50 last:border-0">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setPersona(p.id)}
                        className="flex items-center gap-2.5 text-left transition-opacity hover:opacity-70"
                      >
                        {p.id === SIN_ASIGNAR
                          ? <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-surface-high">
                              <Wallet className="size-3 text-on-surface-variant" />
                            </span>
                          : <AvatarMiembro id={p.id} nombre={p.nombre} image={p.foto} size={26} />}
                        <span className="min-w-0">
                          <span className="block truncate text-[12.5px] font-semibold text-on-surface">{p.nombre}</span>
                          {/* El RUT es lo que se necesita para transferir: si
                              falta, se avisa aquí y no cuando ya se iba a pagar. */}
                          {p.id !== SIN_ASIGNAR && (
                            p.rut
                              ? <span className="block text-[10px] text-on-surface-variant">RUT {p.rut}</span>
                              : <span className="flex items-center gap-1 text-[10px] font-semibold text-[#9a5b06]">
                                  <AlertTriangle className="size-2.5" /> Falta el RUT
                                </span>
                          )}
                        </span>
                      </button>
                    </td>
                    <td className={cn('px-4 py-3 text-right text-[12.5px] tabular-nums',
                      p.porAprobar > 0 ? 'font-semibold text-[#9a5b06]' : 'text-on-surface-variant')}>
                      {p.porAprobar > 0 ? formatCOP(p.porAprobar) : '—'}
                    </td>
                    <td className={cn('px-4 py-3 text-right text-[12.5px] tabular-nums',
                      p.aprobado > 0 ? 'font-semibold text-[#0f7a35]' : 'text-on-surface-variant')}>
                      {p.aprobado > 0 ? formatCOP(p.aprobado) : '—'}
                    </td>
                    <td className={cn('px-4 py-3 text-right text-[12.5px] tabular-nums',
                      p.pagado > 0 ? 'text-on-surface' : 'text-on-surface-variant')}>
                      {p.pagado > 0 ? formatCOP(p.pagado) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {idsPorAprobar.length > 0 ? (
                        <button
                          onClick={() => moverLote.mutate({ ids: idsPorAprobar, accion: 'aprobar' })}
                          disabled={ocupado}
                          className="cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-40"
                        >
                          <BadgeCheck className="mr-1 inline size-3.5" />
                          Aprobar {idsPorAprobar.length > 1 ? 'todo' : ''}
                        </button>
                      ) : idsAprobados.length > 0 ? (
                        <button
                          onClick={() => moverLote.mutate({ ids: idsAprobados, accion: 'pagar' })}
                          disabled={ocupado}
                          className="cursor-pointer rounded-lg border border-outline-variant px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-high disabled:opacity-40"
                        >
                          <Check className="mr-1 inline size-3.5" />Marcar pagado
                        </button>
                      ) : (
                        <span className="text-[10.5px] text-on-surface-variant">Nada pendiente</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

      /* ── Detalle: los trabajos de una persona (o los propios) ──────────── */
      ) : (
        <div className="card-panel overflow-hidden p-0">
          {elegida && (
            <div className="flex items-center gap-2.5 border-b border-outline-variant px-4 py-3">
              {elegida.id === SIN_ASIGNAR
                ? <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-high">
                    <Wallet className="size-3.5 text-on-surface-variant" />
                  </span>
                : <AvatarMiembro id={elegida.id} nombre={elegida.nombre} image={elegida.foto} size={32} />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-on-surface">{elegida.nombre}</span>
                {elegida.id !== SIN_ASIGNAR && (
                  elegida.rut
                    ? <span className="block text-[10.5px] text-on-surface-variant">RUT {elegida.rut}</span>
                    : <span className="flex items-center gap-1 text-[10.5px] font-semibold text-[#9a5b06]">
                        <AlertTriangle className="size-2.5" /> Falta el RUT
                      </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setPersona('')}
                className="shrink-0 cursor-pointer text-[11px] font-semibold text-primary hover:underline"
              >
                Ver todo el equipo
              </button>
            </div>
          )}

          <div className="divide-y divide-outline-variant">
            {(elegida ? elegida.cobros : cobros).map(c => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#7c3aed]/15">
                  <Wallet className="size-3.5 text-[#7c3aed]" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-on-surface">{c.titulo}</p>
                  <p className="mt-0.5 text-[11px] text-on-surface-variant">
                    {detalleDe(c, puedeAprobar && !elegida)}
                  </p>
                </div>

                <span className="shrink-0 text-[13px] font-bold tabular-nums text-on-surface">
                  {c.valor != null ? formatCOP(c.valor) : 'Sin valor'}
                </span>

                <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold', ESTADO_CLASE[c.estadoCobro])}>
                  {ESTADO_LABEL[c.estadoCobro]}
                </span>

                {puedeAprobar && c.estadoCobro === 'POR_APROBAR' && (
                  <button
                    onClick={() => mover.mutate({ id: c.id, accion: 'aprobar' })}
                    disabled={ocupado}
                    className="shrink-0 cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    <BadgeCheck className="mr-1 inline size-3.5" />Aprobar
                  </button>
                )}
                {puedeAprobar && c.estadoCobro === 'APROBADO' && (
                  <button
                    onClick={() => mover.mutate({ id: c.id, accion: 'pagar' })}
                    disabled={ocupado}
                    className="shrink-0 cursor-pointer rounded-lg border border-outline-variant px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-high disabled:opacity-40"
                  >
                    <Check className="mr-1 inline size-3.5" />Marcar pagado
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
