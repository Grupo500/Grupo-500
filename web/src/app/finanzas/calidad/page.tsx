'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { numero } from '@/components/finanzas/comunes'
import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'

type Semaforo = 'correcto' | 'revisar' | 'error' | 'informativo'

interface Verificacion {
  area: string; nombre: string; resultado: number; esperado: number | null
  estado: Semaforo; comentario?: string; enlace?: string
}

interface CalidadData {
  verificadoEn: string
  resumen: { errores: number; porRevisar: number; correctas: number; informativas: number; total: number }
  contexto: { pagos: number; cursos: number }
  verificaciones: Verificacion[]
}

const ESTADO = {
  error:       { punto: '#dc2626', texto: 'Error',       fondo: 'rgba(220,38,38,0.10)',  color: '#b91c1c' },
  revisar:     { punto: '#f59e0b', texto: 'Revisar',     fondo: 'rgba(245,158,11,0.12)', color: '#b45309' },
  correcto:    { punto: '#16a34a', texto: 'Correcto',    fondo: 'rgba(22,163,74,0.10)',  color: '#15803d' },
  informativo: { punto: '#94a3b8', texto: 'Informativo', fondo: 'rgba(148,163,184,0.14)', color: '#475569' },
} as const

export default function ControlCalidadPage() {
  const [filtro, setFiltro] = useState<Semaforo | 'todas'>('todas')

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['finanzas-calidad'],
    queryFn: async () => apiFetch('/finanzas/calidad') as Promise<{ data: CalidadData }>,
    staleTime: 30_000,
  })

  const d = data?.data
  const r = d?.resumen

  const visibles = (d?.verificaciones ?? []).filter(v => filtro === 'todas' || v.estado === filtro)

  // Agrupar por área conservando el orden en que llegan.
  const areas: { nombre: string; items: Verificacion[] }[] = []
  for (const v of visibles) {
    const ultima = areas[areas.length - 1]
    if (ultima?.nombre === v.area) ultima.items.push(v)
    else areas.push({ nombre: v.area, items: [v] })
  }

  const tarjetas = [
    { clave: 'error' as const,       n: r?.errores ?? 0,     etiqueta: 'Errores',      nota: 'Hacen mentir a un indicador' },
    { clave: 'revisar' as const,     n: r?.porRevisar ?? 0,  etiqueta: 'Por revisar',  nota: 'No bloquean, pero conviene mirarlas' },
    { clave: 'correcto' as const,    n: r?.correctas ?? 0,   etiqueta: 'Correctas',    nota: '' },
    { clave: 'informativo' as const, n: r?.informativas ?? 0, etiqueta: 'Informativas', nota: 'Solo contexto' },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Control de calidad"
        subtitle={
          d
            ? `${d.resumen.total} verificaciones sobre ${numero(d.contexto.pagos)} pagos. Revísalas después de cada carga.`
            : 'Verificaciones sobre los datos cargados'
        }
        actions={
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 px-3.5 rounded-lg bg-primary text-white text-[12.5px] font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity cursor-pointer"
          >
            {isFetching ? 'Verificando…' : 'Volver a verificar'}
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tarjetas.map(t => (
          <div
            key={t.clave}
            className={cn('card p-4', t.clave === 'revisar' && t.n > 0 && 'border-[#f59e0b]/40')}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ESTADO[t.clave].punto }} />
              <p className="text-[11.5px] font-medium text-on-surface-variant">{t.etiqueta}</p>
            </div>
            <p
              className="text-[26px] font-bold tabular-nums mt-1 leading-none"
              style={{ color: t.n > 0 && (t.clave === 'error' || t.clave === 'revisar') ? ESTADO[t.clave].color : 'var(--on-surface)' }}
            >
              {isLoading ? '—' : numero(t.n)}
            </p>
            {t.nota && <p className="text-[10.5px] text-on-surface-variant mt-1">{t.nota}</p>}
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {([['todas', 'Todas'], ['error', 'Errores'], ['revisar', 'Por revisar'], ['informativo', 'Informativas']] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFiltro(k)}
            className={cn(
              'px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors cursor-pointer border',
              filtro === k
                ? 'bg-primary text-white border-transparent'
                : 'border-surface-high text-on-surface-variant hover:bg-surface-high',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-10 rounded bg-surface-high animate-pulse" />)}
          </div>
        ) : visibles.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant text-center py-10">
            Ninguna verificación en esta categoría
          </p>
        ) : (
          areas.map(area => (
            <div key={area.nombre}>
              <p className="px-5 py-2 text-[11.5px] font-semibold text-on-surface-variant bg-surface-low">
                {area.nombre}
              </p>
              {area.items.map(v => {
                const e = ESTADO[v.estado]
                const destacar = v.estado === 'error' || v.estado === 'revisar'
                return (
                  <div
                    key={v.nombre}
                    className="flex items-start gap-3 px-5 py-3 border-b border-surface-high last:border-0"
                    style={destacar ? { background: e.fondo } : undefined}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: e.punto }} />

                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-on-surface">{v.nombre}</p>
                      {v.comentario && (
                        <p className="text-[11px] text-on-surface-variant mt-0.5">{v.comentario}</p>
                      )}
                      {v.enlace && destacar && (
                        <Link
                          href={v.enlace}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold mt-1 hover:underline"
                          style={{ color: e.color }}
                        >
                          Ir a revisarlo
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-[13px] font-semibold tabular-nums text-on-surface">{numero(v.resultado)}</p>
                        {v.esperado !== null && (
                          <p className="text-[10px] text-on-surface-variant tabular-nums">esperado {numero(v.esperado)}</p>
                        )}
                      </div>
                      <span
                        className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background: e.fondo, color: e.color }}
                      >
                        {e.texto}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
