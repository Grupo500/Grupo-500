'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { useCountUp } from '@/hooks/useCountUp'
import { CircleDollarSign, ChevronDown } from 'lucide-react'

interface PorCobrar {
  total: number
  estudiantes: number
  automatico: { monto: number; estudiantes: number }
  gestion: { monto: number; estudiantes: number }
  cuotasFaltantes: { faltan: number; estudiantes: number }[]
  porGestionar: {
    estudianteId: string
    nombre: string
    telefono: string
    curso: string
    saldo: number
    asesor: string | null
  }[]
  porAutomatico: {
    estudianteId: string
    nombre: string
    telefono: string
    curso: string
    saldo: number
    asesor: string | null
    cuotaNumero: number
    cuotasTotal: number
  }[]
}

export function PendientesPorCobrar({ desde, hasta }: { desde: string; hasta: string }) {
  const [abierto, setAbierto] = useState(false)
  const [abiertoAuto, setAbiertoAuto] = useState(false)

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

      <div className="rounded-xl bg-surface-low p-3.5 mb-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold text-on-surface flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--primary)' }} />
            Hotmart lo cobra solo
          </span>
          <span className="text-[15px] font-semibold tabular-nums text-on-surface">{formatCOP(d.automatico.monto)}</span>
        </div>
        <p className="text-[11.5px] text-on-surface-variant mt-1 ml-4">
          {d.automatico.estudiantes} con cuotas programadas{cuotasTexto && ` · ${cuotasTexto}`}
        </p>

        {d.porAutomatico.length > 0 && (
          <>
            <button
              onClick={() => setAbiertoAuto(v => !v)}
              aria-expanded={abiertoAuto}
              className="w-full flex items-center justify-center gap-1.5 mt-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold text-primary hover:bg-surface-high transition-colors cursor-pointer"
            >
              {abiertoAuto ? 'Ocultar seguimiento' : 'Ver seguimiento'}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${abiertoAuto ? 'rotate-180' : ''}`} />
            </button>

            {abiertoAuto && (
              <div className="mt-1 animate-fade-in">
                {d.porAutomatico.map(p => (
                  <div key={p.estudianteId + p.curso} className="flex items-center gap-3 py-2 border-t border-surface-high">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-on-surface truncate">{p.nombre}</p>
                      <p className="text-[11.5px] text-on-surface-variant truncate">
                        {p.curso}{p.asesor && ` · ${p.asesor}`} · Cuota {p.cuotaNumero} de {p.cuotasTotal}
                      </p>
                    </div>
                    <span className="text-[13px] font-semibold tabular-nums text-on-surface shrink-0">
                      {formatCOP(p.saldo)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {d.gestion.estudiantes > 0 && (
        <div className="rounded-xl p-3.5" style={{ background: 'rgba(245,158,11,0.12)' }}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-semibold flex items-center gap-2" style={{ color: '#b45309' }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#f59e0b' }} />
              Requiere gestión
            </span>
            <span className="text-[15px] font-semibold tabular-nums" style={{ color: '#b45309' }}>
              {formatCOP(d.gestion.monto)}
            </span>
          </div>
          <p className="text-[11.5px] mt-1 ml-4" style={{ color: '#b45309', opacity: 0.85 }}>
            {d.gestion.estudiantes} estudiante{d.gestion.estudiantes !== 1 ? 's' : ''} sin plan de cuotas automático
          </p>
        </div>
      )}

      {d.porGestionar.length > 0 && (
        <>
          <button
            onClick={() => setAbierto(v => !v)}
            aria-expanded={abierto}
            className="w-full flex items-center justify-center gap-1.5 mt-3 py-2 rounded-lg text-[12.5px] font-semibold text-on-surface-variant hover:bg-surface-high transition-colors cursor-pointer"
          >
            {abierto ? 'Ocultar' : `Ver los ${d.porGestionar.length} por gestionar`}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${abierto ? 'rotate-180' : ''}`} />
          </button>

          {abierto && (
            <div className="mt-1 animate-fade-in">
              {d.porGestionar.map(p => (
                <div key={p.estudianteId + p.curso} className="flex items-center gap-3 py-2 border-t border-surface-high">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-on-surface truncate">{p.nombre}</p>
                    <p className="text-[11.5px] text-on-surface-variant truncate">
                      {p.curso}{p.asesor && ` · ${p.asesor}`}
                    </p>
                  </div>
                  <span className="text-[13px] font-semibold tabular-nums text-on-surface shrink-0">
                    {formatCOP(p.saldo)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
