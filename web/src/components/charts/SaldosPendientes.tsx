'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { AlertTriangle, Clock, ChevronRight, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SaldoPendiente {
  estudianteId: string
  nombre: string
  telefono: string
  asesor: string | null
  totalPendiente: number
  enMora: number
  cuotasPendientes: number
  pagosPendientes: number
}

type Filtro = 'todos' | 'mora'

export function SaldosPendientes() {
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busqueda, setBusqueda] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['saldos-pendientes'],
    queryFn: async () => {
      const token = await getClientToken()
      return createClientFetcher(token)<{ data: SaldoPendiente[] }>('/cobros/saldos-pendientes?limit=100')
    },
    staleTime: 60_000,
  })

  const todos = data?.data ?? []

  const filtrados = todos
    .filter(e => filtro === 'todos' || e.enMora > 0)
    .filter(e => !busqueda || e.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  const totalSaldo = filtrados.reduce((s, e) => s + e.totalPendiente, 0)
  const totalMora  = filtrados.reduce((s, e) => s + e.enMora, 0)
  const conMora    = todos.filter(e => e.enMora > 0).length

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-lowest flex flex-col"
      style={{ minHeight: 420 }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 border-b border-outline-variant/50 space-y-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-on-surface">Saldos pendientes por cobrar</p>
          <span className="text-[11px] text-on-surface-variant">{filtrados.length} estudiantes</span>
        </div>

        {/* Resumen rápido */}
        {!isLoading && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#d97706]/8 border border-[#d97706]/20 rounded-xl px-3 py-2">
              <p className="text-[10px] font-semibold text-[#d97706] uppercase tracking-wide mb-0.5">Por cobrar</p>
              <p className="text-[15px] font-bold text-on-surface tabular-nums">{formatCOP(totalSaldo)}</p>
            </div>
            <div className="bg-[#dc2626]/8 border border-[#dc2626]/20 rounded-xl px-3 py-2">
              <p className="text-[10px] font-semibold text-[#dc2626] uppercase tracking-wide mb-0.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />En mora
              </p>
              <p className="text-[15px] font-bold text-on-surface tabular-nums">{formatCOP(totalMora)}</p>
            </div>
          </div>
        )}

        {/* Filtros + búsqueda */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-surface-high border border-outline-variant/40 flex-shrink-0">
            {(['todos', 'mora'] as Filtro[]).map(f => (
              <button key={f} onClick={() => setFiltro(f)}
                className={cn(
                  'px-3 py-1 rounded-md text-[11px] font-medium transition-all duration-150',
                  filtro === f
                    ? 'bg-surface-lowest text-on-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface',
                )}>
                {f === 'todos' ? 'Todos' : `En mora (${conMora})`}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Buscar..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="flex-1 min-w-0 bg-surface-high border border-outline-variant rounded-lg px-3 py-1.5 text-[12px] text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50"
          />
        </div>
      </div>

      {/* ── Lista ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1" style={{ maxHeight: 380 }}>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-xl animate-pulse">
              <div className="w-8 h-8 rounded-full bg-surface-high flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-32 rounded bg-surface-high" />
                <div className="h-2.5 w-20 rounded bg-surface-high" />
              </div>
              <div className="h-4 w-20 rounded bg-surface-high" />
            </div>
          ))
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
            <Clock className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-[13px]">
              {busqueda ? 'Sin resultados' : filtro === 'mora' ? 'Ningún estudiante en mora' : 'Sin saldos pendientes'}
            </p>
          </div>
        ) : (
          filtrados.map((e) => {
            const tienesMora = e.enMora > 0
            const pendientesCount = e.cuotasPendientes + e.pagosPendientes
            return (
              <div key={e.estudianteId}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group cursor-pointer',
                  'hover:bg-surface-high',
                  tienesMora && 'bg-[#dc2626]/4 hover:bg-[#dc2626]/8',
                )}>
                {/* Avatar */}
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-bold',
                  tienesMora
                    ? 'bg-[#dc2626]/15 text-[#dc2626]'
                    : 'bg-primary/10 text-primary',
                )}>
                  {e.nombre[0]?.toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-semibold text-on-surface truncate">{e.nombre}</p>
                    {tienesMora && (
                      <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#dc2626]/15 text-[#dc2626] uppercase tracking-wide">mora</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[11px] text-on-surface-variant flex items-center gap-1">
                      <Phone className="w-2.5 h-2.5" />{e.telefono}
                    </p>
                    <span className="text-on-surface-variant/30">·</span>
                    <p className="text-[11px] text-on-surface-variant">
                      {pendientesCount} {pendientesCount === 1 ? 'cobro' : 'cobros'}
                    </p>
                    {e.asesor && (
                      <>
                        <span className="text-on-surface-variant/30">·</span>
                        <p className="text-[11px] text-on-surface-variant truncate">{e.asesor}</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Monto */}
                <div className="text-right flex-shrink-0">
                  <p className={cn(
                    'text-[13px] font-bold tabular-nums',
                    tienesMora ? 'text-[#dc2626]' : 'text-on-surface',
                  )}>
                    {formatCOP(e.totalPendiente)}
                  </p>
                  {tienesMora && e.enMora < e.totalPendiente && (
                    <p className="text-[10px] text-[#dc2626]/70">{formatCOP(e.enMora)} mora</p>
                  )}
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

