'use client'

// Cobros freelance del área de Marketing.
//
// Pantalla propia y no una columna dentro de Entregables: un freelance puede
// estar esperando aprobación desde que se le encarga el trabajo, mucho antes
// de publicar nada, y en Entregables —que lista lo publicado— no tendría dónde
// aparecer. Además lo ya pagado se quedaría mezclado con los enlaces del mes.
//
// Quién ve qué lo decide el backend: los líderes reciben los de todo el equipo
// y `puedeAprobar` en true; el resto recibe solo los suyos.

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { Loader2, Check, Wallet, BadgeCheck } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { cn, formatCOP } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'

type EstadoCobro = 'POR_APROBAR' | 'APROBADO' | 'PAGADO'

interface Cobro {
  id: string
  titulo: string
  tipo: string
  fecha: string
  valor: number | null
  estadoCobro: EstadoCobro
  aprobadoEn: string | null
  pagadoEn: string | null
  asignadoA: { id: string; nombre: string } | null
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

function mesActualISO() {
  const hoy = new Date()
  return { desde: format(startOfMonth(hoy), 'yyyy-MM-dd'), hasta: format(endOfMonth(hoy), 'yyyy-MM-dd') }
}

export default function CobrosPage() {
  const queryClient = useQueryClient()
  const [rango] = useState(mesActualISO)
  const [estado, setEstado] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['marketing-cobros', rango.desde, rango.hasta, estado],
    queryFn: () => apiFetch<{ data: Respuesta }>(
      `/marketing/cobros?desde=${rango.desde}&hasta=${rango.hasta}${estado ? `&estado=${estado}` : ''}`,
    ),
  })
  const r = data?.data
  const cobros = r?.cobros ?? []
  const puedeAprobar = r?.puedeAprobar ?? false

  const mover = useMutation({
    mutationFn: ({ id, accion }: { id: string; accion: 'aprobar' | 'pagar' }) =>
      apiFetch(`/marketing/cobros/${id}/${accion}`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing-cobros'] }),
  })

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title={puedeAprobar ? 'Cobros freelance' : 'Mis cobros'}
        subtitle={puedeAprobar
          ? 'Trabajos que se pagan aparte, y en qué van'
          : 'Tus trabajos freelance y en qué van'}
        actions={
          <Select
            value={estado}
            onValueChange={setEstado}
            className="input-base w-[170px]"
            options={[
              { value: '', label: 'Todos los estados' },
              ...(Object.keys(ESTADO_LABEL) as EstadoCobro[]).map(e => ({ value: e, label: ESTADO_LABEL[e] })),
            ]}
          />
        }
      />

      {/* Los totales salen de lo mismo que se lista, así que siempre cuadran
          con las filas de abajo. */}
      <div className={cn('grid gap-3', puedeAprobar ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
        {[
          { l: 'Por aprobar', v: r?.totales.porAprobar, c: 'text-[#9a5b06]' },
          ...(puedeAprobar ? [{ l: 'Aprobado sin pagar', v: r?.totales.aprobado, c: 'text-[#0f7a35]' }] : []),
          { l: 'Pagado este mes', v: r?.totales.pagado, c: 'text-on-surface' },
        ].map(k => (
          <div key={k.l} className="card p-4">
            <p className="text-[11px] text-on-surface-variant">{k.l}</p>
            <p className={cn('mt-1 text-[19px] font-bold tracking-[-0.02em] tabular-nums', k.c)}>
              {isLoading ? '—' : formatCOP(k.v ?? 0)}
            </p>
          </div>
        ))}
      </div>

      <div className="card-panel overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-on-surface-variant">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : cobros.length === 0 ? (
          <p className="py-16 text-center text-[13px] text-on-surface-variant">
            No hay cobros freelance en este período.
          </p>
        ) : (
          <div className="divide-y divide-outline-variant">
            {cobros.map(c => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#7c3aed]/15">
                  <Wallet className="size-3.5 text-[#7c3aed]" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-on-surface">{c.titulo}</p>
                  <p className="mt-0.5 text-[11px] text-on-surface-variant">
                    {/* Se dice el estado real del trabajo, no solo la fecha: quien
                        aprueba necesita saber si ya se entregó o sigue en proceso. */}
                    {puedeAprobar && `${c.asignadoA?.nombre ?? 'Sin asignar'} · `}
                    {c.pagadoEn
                      ? `pagado el ${format(new Date(c.pagadoEn), "d 'de' MMMM", { locale: es })}`
                      : c.aprobadoEn
                        ? `aprobado por ${c.aprobadoPor?.nombre ?? 'alguien'} el ${format(new Date(c.aprobadoEn), "d 'de' MMMM", { locale: es })}`
                        : c.entregables.length > 0
                          ? `entregado el ${format(new Date(c.entregables[0].publicadoEn), "d 'de' MMMM", { locale: es })}`
                          : 'en proceso, sin entregar'}
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
                    disabled={mover.isPending}
                    className="shrink-0 cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    <BadgeCheck className="mr-1 inline size-3.5" />Aprobar
                  </button>
                )}
                {puedeAprobar && c.estadoCobro === 'APROBADO' && (
                  <button
                    onClick={() => mover.mutate({ id: c.id, accion: 'pagar' })}
                    disabled={mover.isPending}
                    className="shrink-0 cursor-pointer rounded-lg border border-outline-variant px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-high disabled:opacity-40"
                  >
                    <Check className="mr-1 inline size-3.5" />Marcar pagado
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
