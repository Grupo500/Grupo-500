'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { apiFetch } from '@/lib/api'
import { formatCOP } from '@/lib/utils'
import { Crown, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Wallet, Users as UsersIcon } from 'lucide-react'

interface Asesor {
  id: string
  nombre: string
  image: string | null
  totalVentas: number
  cantidadPagos: number
  totalEstudiantes: number
  comisionGanada: number
  variacion: number
}

interface Props {
  desde?: string
  hasta?: string
  periodoLabel?: string
}

function iniciales(nombre: string) {
  return nombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

const TOP_INICIAL = 10

export function RankingAsesores({ desde, hasta, periodoLabel }: Props) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const verde  = isDark ? '#6ee7b7' : '#16a34a'
  const rojo   = isDark ? '#f87171' : '#dc2626'
  const [verTodos, setVerTodos] = useState(false)
  const [expandidoId, setExpandidoId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['ranking-asesores', desde, hasta],
    queryFn: async () => {
      const params = desde && hasta ? `?desde=${desde}&hasta=${hasta}` : ''
      return apiFetch<{ data: Asesor[] }>(`/reportes/asesores${params}`)
    },
    staleTime: 30_000,
  })

  const asesores    = data?.data ?? []
  const podium      = asesores.slice(0, 3)
  const restoTotal  = asesores.slice(3)
  const resto       = verTodos ? restoTotal : restoTotal.slice(0, TOP_INICIAL - 3)
  const hayMas      = restoTotal.length > TOP_INICIAL - 3

  // Reordenar 2-1-3 para el podium visual
  const podiumOrden = [podium[1], podium[0], podium[2]].filter(Boolean)

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[13px] font-semibold text-on-surface">Ranking de asesores</p>
        <span className="text-[11px] text-on-surface-variant">
          {asesores.length} asesor{asesores.length !== 1 ? 'es' : ''}{periodoLabel ? ` · ${periodoLabel}` : ''}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 rounded-xl bg-surface-high animate-pulse" />
          ))}
        </div>
      ) : asesores.length === 0 ? (
        <p className="text-[13px] text-on-surface-variant text-center py-6">Sin datos en este período</p>
      ) : (
        <>
          {/* ── Podium 2 - 1 - 3 ───────────────────────────────────── */}
          {podium.length > 0 && (
            <div className="grid grid-cols-3 gap-3 items-end">
              {podiumOrden.map((a) => {
                const pos = podium.indexOf(a) + 1
                const isFirst  = pos === 1
                const isSecond = pos === 2
                const isThird  = pos === 3

                const altura  = isFirst ? 92 : isSecond ? 68 : 50
                const colorBg = isFirst
                  ? 'linear-gradient(180deg, #fac775, #ef9f27)'
                  : isSecond
                    ? 'linear-gradient(180deg, var(--surface-high), var(--outline-variant))'
                    : 'linear-gradient(180deg, #f5c4b3, #d85a30)'
                const badgeBg = isFirst ? '#ef9f27' : isSecond ? 'var(--on-surface-variant)' : '#d85a30'
                const avatarRing = isFirst ? '#ef9f27' : isSecond ? 'var(--outline-variant)' : '#d85a30'
                const numColor   = isFirst || isThird ? '#fff' : 'var(--on-surface)'

                return (
                  <button
                    type="button"
                    key={a.id}
                    onClick={() => setExpandidoId(prev => prev === a.id ? null : a.id)}
                    className="flex flex-col items-center text-center cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-0 p-0"
                  >
                    {isFirst && <Crown className="w-5 h-5 mb-1" style={{ color: '#ef9f27' }} />}
                    <div className="relative">
                      <div
                        className="rounded-full overflow-hidden flex items-center justify-center font-semibold"
                        style={{
                          width:  isFirst ? 56 : 44,
                          height: isFirst ? 56 : 44,
                          background: 'var(--primary-container)',
                          color: 'var(--primary)',
                          fontSize: isFirst ? 16 : 13,
                          border: `2px solid ${avatarRing}`,
                        }}
                      >
                        {a.image
                          ? <img src={a.image} alt={a.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          : iniciales(a.nombre)}
                      </div>
                      <div
                        className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center text-white font-semibold"
                        style={{
                          width: isFirst ? 22 : 18,
                          height: isFirst ? 22 : 18,
                          background: badgeBg,
                          fontSize: isFirst ? 11 : 10,
                        }}
                      >
                        {pos}
                      </div>
                    </div>
                    <p className="text-[11px] font-semibold text-on-surface mt-2 leading-tight truncate w-full px-1" title={a.nombre}>
                      {a.nombre}
                    </p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5 tabular-nums">{formatCOP(a.totalVentas)}</p>
                    {isFirst && (
                      <p className="text-[10px] text-on-surface-variant tabular-nums">{a.cantidadPagos} venta{a.cantidadPagos !== 1 ? 's' : ''}</p>
                    )}
                    <div
                      className="w-full mt-2 rounded-t-lg flex items-center justify-center font-bold"
                      style={{
                        height: altura,
                        background: colorBg,
                        color: numColor,
                        fontSize: isFirst ? 22 : 18,
                      }}
                    >
                      {pos}°
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Detalle de comisión del asesor seleccionado del podium */}
          {podium.some(a => a.id === expandidoId) && (() => {
            const a = podium.find(x => x.id === expandidoId)!
            return (
              <div className="rounded-xl border border-primary/30 bg-[var(--primary-container)]/30 p-3 animate-fade-in">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-primary" />
                    <span className="text-[12px] font-semibold text-on-surface">Comisión de {a.nombre}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-on-surface-variant">
                    <span className="flex items-center gap-1"><UsersIcon className="w-3 h-3" /> {a.totalEstudiantes} estudiante{a.totalEstudiantes !== 1 ? 's' : ''}</span>
                    <span className="text-[14px] font-bold tabular-nums" style={{ color: 'var(--primary)' }}>{formatCOP(a.comisionGanada)}</span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── Lista del 4° en adelante ───────────────────────────── */}
          {restoTotal.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <div className="grid grid-cols-[32px_36px_1fr_auto_50px] gap-2 px-3 pb-1 text-[10px] uppercase tracking-wide text-on-surface-variant">
                <span>#</span>
                <span></span>
                <span>Asesor</span>
                <span className="text-right">Ventas</span>
                <span className="text-right">N°</span>
              </div>
              {resto.map((a, i) => {
                const pos = i + 4
                const isOpen = expandidoId === a.id
                return (
                  <div key={a.id}>
                    <button
                      type="button"
                      onClick={() => setExpandidoId(prev => prev === a.id ? null : a.id)}
                      className={`w-full grid grid-cols-[32px_36px_1fr_auto_50px_16px] gap-2 items-center px-3 py-2 rounded-xl text-left transition-colors border-0 cursor-pointer ${isOpen ? 'bg-[var(--primary-container)]/40' : 'bg-surface-high/40 hover:bg-surface-high'}`}
                    >
                      <span className="text-[12px] font-semibold text-on-surface-variant">{pos}°</span>
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/15 flex items-center justify-center ring-1 ring-primary/10">
                        {a.image
                          ? <img src={a.image} alt={a.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          : <span className="text-[10px] font-bold text-primary">{iniciales(a.nombre)}</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-on-surface truncate" title={a.nombre}>{a.nombre}</p>
                        {a.variacion !== 0 && (
                          <span className="text-[10px] font-semibold flex items-center gap-0.5"
                            style={{ color: a.variacion > 0 ? verde : rojo }}>
                            {a.variacion > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {a.variacion > 0 ? '+' : ''}{a.variacion}%
                          </span>
                        )}
                      </div>
                      <span className="text-[12px] font-bold text-on-surface tabular-nums text-right">{formatCOP(a.totalVentas)}</span>
                      <span className="text-[11px] text-on-surface-variant tabular-nums text-right">{a.cantidadPagos}</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-on-surface-variant transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="mt-1 mb-1 ml-10 mr-3 px-3 py-2 rounded-xl border border-primary/30 bg-[var(--primary-container)]/30 animate-fade-in">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Wallet className="w-3.5 h-3.5 text-primary" />
                            <span className="text-[11px] font-semibold text-on-surface">Comisión generada</span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-on-surface-variant">
                            <span className="flex items-center gap-1"><UsersIcon className="w-3 h-3" /> {a.totalEstudiantes} estudiante{a.totalEstudiantes !== 1 ? 's' : ''}</span>
                            <span className="text-[13px] font-bold tabular-nums" style={{ color: 'var(--primary)' }}>{formatCOP(a.comisionGanada)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Botón ver todos / ver menos */}
              {hayMas && (
                <button
                  onClick={() => setVerTodos(v => !v)}
                  className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold text-primary hover:bg-surface-high transition-colors"
                >
                  {verTodos
                    ? <><ChevronUp className="w-3.5 h-3.5" /> Ver menos</>
                    : <><ChevronDown className="w-3.5 h-3.5" /> Ver todos ({asesores.length} asesores)</>}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
