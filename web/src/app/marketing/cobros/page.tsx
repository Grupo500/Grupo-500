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
import {
  Loader2, Check, Wallet, BadgeCheck, AlertTriangle, ChevronDown,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { cn, formatCOP } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { AvatarMiembro } from '@/components/marketing/AvatarMiembro'

type EstadoCobro = 'POR_APROBAR' | 'APROBADO' | 'PAGADO'

interface Persona {
  id: string; nombre: string
  user?: { image: string | null }
  /** Qué le falta para poder cobrar; lo calcula el backend. */
  falta: string[]
  completos: boolean
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
  cuentaCobroUrl: string | null
  cuentaCobroEn: string | null
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

  // Desde aquí solo se aprueba. El pago no lo marca nadie del equipo: lo
  // registra contabilidad desde su módulo cuando de verdad gira, así que no
  // hay botón de "pagado" en esta pantalla (Hotman, 22-ago).
  const mover = useMutation({
    mutationFn: (id: string) => apiFetch(`/marketing/cobros/${id}/aprobar`, { method: 'PATCH' }),
    onSuccess: invalidar,
  })

  const moverLote = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch('/marketing/cobros/lote', { method: 'PATCH', body: JSON.stringify({ ids }) }),
    onSuccess: invalidar,
  })
  const ocupado = mover.isPending || moverLote.isPending

  // Qué bloques abrió la persona a mano. Por defecto TODOS plegados: se
  // entra, se ve la liquidación por persona, y se abre el que se quiera —
  // llegar con todo desplegado era ruido (Hotman, 22-ago).
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const alternar = (id: string) => setAbiertos(prev => {
    const s = new Set(prev)
    s.has(id) ? s.delete(id) : s.add(id)
    return s
  })

  /** Un empujón a quien no ha llenado sus datos, en vez de esperar al giro. */
  const recordar = useMutation({
    mutationFn: (miembroId: string) =>
      apiFetch(`/marketing/miembros/${miembroId}/recordar-datos`, { method: 'POST' }),
    onSuccess: () => alert('Le llegó el recordatorio.'),
    onError: (e: Error) => alert(e.message || 'No se pudo enviar'),
  })


  // Una entrada por persona con sus tres montos. Se arma sobre lo mismo que se
  // lista, así que la tabla y el detalle nunca pueden discrepar.
  const porPersona = useMemo(() => {
    const mapa = new Map<string, {
      id: string; nombre: string; foto: string | null
      falta: string[]; completos: boolean
      cobros: Cobro[]; porAprobar: number; aprobado: number; pagado: number
    }>()
    for (const c of cobros) {
      const id = c.asignadoA?.id ?? SIN_ASIGNAR
      // La firma dejó de pedirse, pero el servidor puede seguir enviándola en
      // la lista de faltantes hasta que suba la versión nueva; mientras tanto
      // marcaría a todo el equipo con un dato imposible de llenar y les
      // frenaría el cobro (Hotman, 20-ago).
      const faltaReal = (c.asignadoA?.falta ?? []).filter(f => !/firma/i.test(f))
      if (!mapa.has(id)) mapa.set(id, {
        id,
        nombre: c.asignadoA?.nombre ?? 'Sin asignar',
        foto:   c.asignadoA?.user?.image ?? null,
        falta:  faltaReal,
        completos: (c.asignadoA?.completos ?? false) || faltaReal.length === 0,
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

  /**
   * Un trabajo con su valor, su etapa y lo que se puede hacer con él.
   *
   * Vive dentro de la página porque necesita las mutaciones y los permisos, y
   * pasárselos sueltos serían ocho props para nada. Se usa en la liquidación
   * —dentro del bloque de cada persona— y en el detalle de una sola.
   */
  function FilaCobro({ c, conNombre }: { c: Cobro; conNombre: boolean }) {
    return (
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#7c3aed]/15">
          <Wallet className="size-3.5 text-[#7c3aed]" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-on-surface">{c.titulo}</p>
          <p className="mt-0.5 text-[11px] text-on-surface-variant">
            {detalleDe(c, conNombre)}
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
            onClick={() => mover.mutate(c.id)}
            disabled={ocupado}
            className="shrink-0 cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <BadgeCheck className="mr-1 inline size-3.5" />Aprobar
          </button>
        )}
        {/* Aprobado es sello y ya: ninguna acción por fila (Hotman, 22-ago).
            El pago se registra por persona desde el encabezado, y la cuenta
            de cobro la arma el servidor cada sábado —una por persona con
            todos sus trabajos— y la sube a Drive. Si a alguien le faltan
            datos, lo dice el encabezado de su grupo. */}
      </div>
    )
  }

  const elegida = persona ? porPersona.find(p => p.id === persona) ?? null : null

  const idsEn = (lista: Cobro[], e: EstadoCobro) =>
    lista.filter(c => c.estadoCobro === e).map(c => c.id)

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title={puedeAprobar ? 'Cobros freelance' : 'Mis cobros'}
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
      {/* Dos tarjetas y no tres: "pagado" ya no se registra aquí sino en el
          módulo de contabilidad (Hotman, 22-ago). */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { l: 'Por aprobar', v: elegida ? elegida.porAprobar : r?.totales.porAprobar, c: 'text-[#9a5b06]' },
          { l: 'Aprobado',    v: elegida ? elegida.aprobado   : r?.totales.aprobado,   c: 'text-[#0f7a35]' },
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

      /* ── Liquidación: cada persona con los trabajos que componen su cifra ─
         Se aprueba trabajo, no gente: para firmar que hay que pagar $250.000
         hay que ver que son cinco carruseles de $50.000, y poder dejar fuera
         el que quedó a medias. Antes era una fila por persona con tres
         columnas de plata —dos de ellas siempre en guion, porque un cobro
         está en una sola etapa— y un "Aprobar todo" sin ver qué (Hotman,
         20-ago). */
      ) : puedeAprobar && !elegida ? (
        <div className="space-y-3">
          {porPersona.map(p => {
            const idsPorAprobar = idsEn(p.cobros, 'POR_APROBAR')
            const idsAprobados  = idsEn(p.cobros, 'APROBADO')
            const abierto = abiertos.has(p.id)
            const acento = idsPorAprobar.length > 0 ? '#d97706' : idsAprobados.length > 0 ? '#16a34a' : 'var(--outline)'
            return (
              <div key={p.id} className="card-panel overflow-hidden p-0">
                <div
                  className="flex flex-wrap items-center gap-3 bg-surface-low px-4 py-3"
                  style={{ boxShadow: `inset 3px 0 0 ${acento}` }}
                >
                  <button
                    type="button"
                    onClick={() => alternar(p.id)}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
                  >
                    <ChevronDown className={cn('size-3.5 shrink-0 text-on-surface-variant transition-transform', !abierto && '-rotate-90')} />
                    {p.id === SIN_ASIGNAR
                      ? <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-surface-high">
                          <Wallet className="size-3.5 text-on-surface-variant" />
                        </span>
                      : <AvatarMiembro id={p.id} nombre={p.nombre} image={p.foto} size={30} />}
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold text-on-surface">{p.nombre}</span>
                      <span className="block text-[11px] text-on-surface-variant">
                        {p.cobros.length} trabajo{p.cobros.length !== 1 ? 's' : ''}
                        {p.id !== SIN_ASIGNAR && (p.completos
                          ? ' · datos completos'
                          : null)}
                        {p.id !== SIN_ASIGNAR && !p.completos && (
                          <span className="font-semibold text-[#9a5b06]">
                            {' · '}
                            {p.falta.length === 1 ? `falta ${p.falta[0]}` : `le faltan ${p.falta.length} datos`}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>

                  <span className="shrink-0 text-[16px] font-semibold tabular-nums tracking-tight text-on-surface">
                    {formatCOP(p.porAprobar + p.aprobado + p.pagado)}
                  </span>

                  {idsPorAprobar.length > 0 ? (
                    <button
                      onClick={() => moverLote.mutate(idsPorAprobar)}
                      disabled={ocupado || !p.completos}
                      title={p.completos ? undefined : `Sin ${p.falta.join(', ')} no se le puede girar`}
                      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[11.5px] font-bold text-on-primary transition-[filter,transform] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <BadgeCheck className="size-3.5" />
                      {/* Dice cuántos: "Aprobar todo" no deja saber qué se firma. */}
                      Aprobar {idsPorAprobar.length > 1 ? `los ${idsPorAprobar.length}` : ''}
                    </button>
                  ) : (
                    <span className="shrink-0 text-[11px] text-on-surface-variant">Nada pendiente</span>
                  )}
                </div>

                {abierto && (
                  <>
                    {/* La consecuencia, no la cuenta: "le faltan 9 datos" no
                        dice qué pasa si se aprueba igual. */}
                    {p.id !== SIN_ASIGNAR && !p.completos && (
                      <div className="flex flex-wrap items-center gap-2.5 border-b border-outline-variant bg-[#dc2626]/[0.06] px-4 py-2.5 text-[11.5px] text-on-surface">
                        <AlertTriangle className="size-3.5 shrink-0 text-[#dc2626]" />
                        <span className="min-w-0 flex-1">
                          Sin {p.falta.join(', ')} no se le puede girar aunque se apruebe.
                        </span>
                        <button
                          type="button"
                          onClick={() => recordar.mutate(p.id)}
                          disabled={recordar.isPending}
                          className="shrink-0 cursor-pointer text-[11.5px] font-semibold text-[#dc2626] hover:underline disabled:opacity-50"
                        >
                          {recordar.isPending && recordar.variables === p.id ? 'Enviando…' : 'Recordárselo'}
                        </button>
                      </div>
                    )}
                    <div className="divide-y divide-outline-variant/50">
                      {p.cobros.map(c => <FilaCobro key={c.id} c={c} conNombre={false} />)}
                    </div>
                  </>
                )}
              </div>
            )
          })}
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
                {elegida.id !== SIN_ASIGNAR && !elegida.completos && (
                  <span className="flex items-center gap-1 text-[10.5px] font-semibold text-[#9a5b06]">
                    <AlertTriangle className="size-2.5" /> Falta {elegida.falta.join(', ')}
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
              <FilaCobro key={c.id} c={c} conNombre={puedeAprobar && !elegida} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
