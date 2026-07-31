'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { useCountUp } from '@/hooks/useCountUp'
import { Modal } from '@/components/ui/Modal'
import { CircleDollarSign, ChevronRight, Phone } from 'lucide-react'

interface PersonaGestion {
  estudianteId: string
  nombre: string
  telefono: string
  curso: string
  saldo: number
  asesor: string | null
  metodo: string | null
}
interface PersonaAutomatico extends PersonaGestion {
  cuotaNumero: number
  cuotasTotal: number
}
interface PorCobrar {
  total: number
  estudiantes: number
  automatico: { monto: number; estudiantes: number }
  gestion: { monto: number; estudiantes: number }
  cuotasFaltantes: { faltan: number; estudiantes: number }[]
  porGestionar: PersonaGestion[]
  porAutomatico: PersonaAutomatico[]
}

// El método llega tal cual lo reporta Hotmart o el formulario de inscripción
// (CREDIT_CARD, PIX, Nequi, Efecty...) — solo se pareja mayúscula/espaciado.
function metodoLegible(metodo: string | null) {
  if (!metodo) return 'Método sin registrar'
  return metodo
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function Fila({ p, tipo }: { p: PersonaGestion | PersonaAutomatico; tipo: 'automatico' | 'gestion' }) {
  const esAutomatico = tipo === 'automatico'
  return (
    <div className="flex items-start gap-3 py-3 border-t border-surface-high first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-on-surface truncate">{p.nombre}</p>
        <p className="text-[11.5px] text-on-surface-variant truncate mt-0.5">
          {p.curso}{p.asesor && ` · ${p.asesor}`}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'var(--surface-high)', color: 'var(--on-surface-variant)' }}
          >
            {metodoLegible(p.metodo)}
          </span>
          {esAutomatico && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--primary-container)', color: 'var(--primary)' }}
            >
              Cuota {(p as PersonaAutomatico).cuotaNumero} de {(p as PersonaAutomatico).cuotasTotal}
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[13.5px] font-bold tabular-nums text-on-surface">{formatCOP(p.saldo)}</p>
        {p.telefono && (
          <a
            href={`https://wa.me/57${p.telefono.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10.5px] text-primary hover:underline mt-1.5"
          >
            <Phone className="w-3 h-3" /> Contactar
          </a>
        )}
      </div>
    </div>
  )
}

export function PendientesPorCobrar({ desde, hasta }: { desde: string; hasta: string }) {
  const [modal, setModal] = useState<'automatico' | 'gestion' | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['pendientes-por-cobrar', desde, hasta],
    queryFn: async () => apiFetch(`/reportes/por-cobrar?desde=${desde}&hasta=${hasta}`) as Promise<{ data: PorCobrar }>,
    staleTime: 60_000,
  })

  const d = data?.data
  const animTotal = useCountUp(isLoading ? 0 : d?.total ?? 0)

  if (isLoading) {
    return (
      <div className="card p-5">
        <div className="h-4 w-40 rounded bg-surface-high animate-pulse mb-4" />
        <div className="h-8 w-52 rounded bg-surface-high animate-pulse mb-4" />
        <div className="h-2 rounded bg-surface-high animate-pulse mb-4" />
        <div className="h-16 rounded-xl bg-surface-high animate-pulse" />
      </div>
    )
  }

  if (!d || d.total === 0) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-md bg-[var(--primary-container)] flex items-center justify-center">
            <CircleDollarSign className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-[15px] font-semibold text-on-surface">Pendiente por cobrar</h3>
        </div>
        <p className="text-[13px] text-on-surface-variant text-center py-6">
          Todo al día. Sin saldos abiertos de lo vendido en este período.
        </p>
      </div>
    )
  }

  const pctAuto = d.total > 0 ? (d.automatico.monto / d.total) * 100 : 0
  const cuotasTexto = d.cuotasFaltantes
    .map(c => `${c.estudiantes} deben ${c.faltan} ${c.faltan === 1 ? 'cuota' : 'cuotas'}`)
    .join(' · ')

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[var(--primary-container)] flex items-center justify-center">
            <CircleDollarSign className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-[15px] font-semibold text-on-surface">Pendiente por cobrar</h3>
        </div>
        <span className="text-[11px] text-on-surface-variant tabular-nums shrink-0 mt-1.5">
          {d.estudiantes} estudiante{d.estudiantes !== 1 ? 's' : ''}
        </span>
      </div>

      <p className="text-[28px] font-bold tabular-nums leading-none text-on-surface">{formatCOP(animTotal)}</p>
      <p className="text-[12.5px] text-on-surface-variant mt-1.5 mb-4">
        {d.gestion.monto > 0 ? (
          <>Solo <span className="font-semibold" style={{ color: '#b45309' }}>{formatCOP(d.gestion.monto)}</span> necesitan gestión</>
        ) : (
          'Todo se cobra automáticamente'
        )}
      </p>

      {/* Proporción entre lo que llega solo y lo que hay que perseguir */}
      <div className="flex gap-[3px] mb-4">
        <div className="h-2 rounded-l" style={{ width: `${pctAuto}%`, background: 'var(--primary)' }} />
        <div className="h-2 rounded-r flex-1" style={{ background: '#f59e0b' }} />
      </div>

      <button
        onClick={() => d.porAutomatico.length > 0 && setModal('automatico')}
        disabled={d.porAutomatico.length === 0}
        className="w-full text-left rounded-xl bg-surface-low p-3.5 mb-2.5 transition-colors enabled:hover:bg-surface-high enabled:cursor-pointer disabled:cursor-default"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold text-on-surface flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--primary)' }} />
            Hotmart lo cobra solo
          </span>
          <span className="flex items-center gap-1 text-[15px] font-semibold tabular-nums text-on-surface">
            {formatCOP(d.automatico.monto)}
            {d.porAutomatico.length > 0 && <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant" />}
          </span>
        </div>
        <p className="text-[11.5px] text-on-surface-variant mt-1 ml-4">
          {d.automatico.estudiantes} con cuotas programadas{cuotasTexto && ` · ${cuotasTexto}`}
        </p>
      </button>

      {d.gestion.estudiantes > 0 && (
        <button
          onClick={() => setModal('gestion')}
          className="w-full text-left rounded-xl p-3.5 transition-opacity hover:opacity-90 cursor-pointer"
          style={{ background: 'rgba(245,158,11,0.12)' }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-semibold flex items-center gap-2" style={{ color: '#b45309' }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#f59e0b' }} />
              Requiere gestión
            </span>
            <span className="flex items-center gap-1 text-[15px] font-semibold tabular-nums" style={{ color: '#b45309' }}>
              {formatCOP(d.gestion.monto)}
              <ChevronRight className="w-3.5 h-3.5" style={{ color: '#b45309', opacity: 0.7 }} />
            </span>
          </div>
          <p className="text-[11.5px] mt-1 ml-4" style={{ color: '#b45309', opacity: 0.85 }}>
            {d.gestion.estudiantes} estudiante{d.gestion.estudiantes !== 1 ? 's' : ''} sin plan de cuotas automático
          </p>
        </button>
      )}

      <Modal
        abierto={modal === 'automatico'}
        onClose={() => setModal(null)}
        titulo="Hotmart lo cobra solo"
        subtitulo={`${d.porAutomatico.length} estudiante${d.porAutomatico.length !== 1 ? 's' : ''} con cuotas programadas`}
      >
        {d.porAutomatico.map(p => <Fila key={p.estudianteId + p.curso} p={p} tipo="automatico" />)}
      </Modal>

      <Modal
        abierto={modal === 'gestion'}
        onClose={() => setModal(null)}
        titulo="Requiere gestión"
        subtitulo="Sin plan de cuotas automático — hay que contactarlos"
      >
        {d.porGestionar.map(p => <Fila key={p.estudianteId + p.curso} p={p} tipo="gestion" />)}
      </Modal>
    </div>
  )
}
