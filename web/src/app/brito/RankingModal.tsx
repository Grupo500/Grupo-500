'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ArrowRight } from 'lucide-react'

export interface FilaRanking {
  posicion: number
  estudianteId: string
  nombre: string
  xpSemana: number
}

export function RankingModal({
  ranking, miId, hayProgreso, variante = 'tarjeta',
}: {
  ranking: FilaRanking[]
  miId: string | null
  hayProgreso: boolean
  variante?: 'tarjeta' | 'icono' | 'navitem'
}) {
  const [abierto, setAbierto] = useState(false)
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])

  const modal = abierto && (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-[#1e1e19]/40 animate-fade-in" onClick={() => setAbierto(false)} />
      <div className="relative min-h-full flex items-center justify-center p-4">
        <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-slide-up">
          <button
            onClick={() => setAbierto(false)}
            className="absolute right-3.5 top-3.5 text-[#9a998f] transition-colors hover:text-[#2B2B28]"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mb-1 flex items-center gap-2">
            <img src="/brito/icons/trofeo.png" alt="" className="h-7 w-7 object-contain" />
            <h2 className="text-lg font-extrabold text-[#2B2B28]">Ranking semanal</h2>
          </div>
          <p className="mb-4 text-[11.5px] font-semibold text-[#8a897f]">
            XP ganado en los últimos 7 días · Global
          </p>

          {ranking.length === 0 ? (
            <p className="py-8 text-center text-sm font-semibold text-[#8a897f]">
              Todavía no hay actividad esta semana. ¡Sé el primero!
            </p>
          ) : (
            <div className="max-h-[55vh] space-y-1.5 overflow-y-auto">
              {ranking.map(r => {
                const esYo = r.estudianteId === miId
                return (
                  <div
                    key={r.estudianteId}
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${
                      esYo ? 'border-[#F5A623]/50 bg-[#F5A623]/12' : 'border-[#ECEAE2] bg-[#FAFAF7]'
                    }`}
                  >
                    <span className="flex w-7 items-center justify-center text-sm font-extrabold text-[#8a897f]">
                      {r.posicion <= 3
                        ? <img src="/brito/icons/medalla.png" alt={`Puesto ${r.posicion}`} className="h-6 w-6 object-contain" />
                        : r.posicion}
                    </span>
                    <span className="flex-1 truncate text-[13px] font-bold text-[#2B2B28]">
                      {r.nombre}{esYo && ' (tú)'}
                    </span>
                    <span className="text-[13px] font-extrabold text-[#1E5FA8]">{r.xpSemana} XP</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {variante === 'navitem' ? (
        <button
          onClick={() => setAbierto(true)}
          className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-bold text-[#57564f] transition-colors hover:bg-[#F5F3EC]"
        >
          <img src="/brito/icons/trofeo.png" alt="" className="h-8 w-8 object-contain" /> Ligas
        </button>
      ) : variante === 'icono' ? (
        <button
          onClick={() => setAbierto(true)}
          title="Ranking"
          className="opacity-90 transition-opacity hover:opacity-100"
        >
          <img src="/brito/icons/trofeo.png" alt="Ranking" className="h-5 w-5 object-contain" />
        </button>
      ) : (
        <button
          onClick={() => setAbierto(true)}
          className="flex w-full flex-col gap-2 rounded-2xl p-4 text-left"
          style={{ background: '#EAF1FA', border: '1px solid #DCE8F5' }}
        >
          <img src="/brito/icons/trofeo.png" alt="" className="h-8 w-8 object-contain" />
          <span className="text-[15px] font-extrabold text-[#2B2B28]">¡Compite en las Ligas!</span>
          <span className="text-xs font-semibold leading-snug text-[#6b6a63]">
            {hayProgreso
              ? 'Sube posiciones y gana medallas cada semana.'
              : 'Completa tu primera lección para entrar al ranking.'}
          </span>
          <span
            className="mt-1.5 flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-bold text-white"
            style={{ background: '#1E5FA8', boxShadow: '0 4px 12px rgba(30,95,168,0.28)' }}
          >
            Ver ranking <ArrowRight className="h-4 w-4" />
          </span>
        </button>
      )}

      {montado && modal && createPortal(modal, document.body)}
    </>
  )
}
