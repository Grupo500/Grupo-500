'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ArrowRight } from 'lucide-react'
import { LIGAS, CUPOS_ASCENSO, CUPOS_DESCENSO, ligaDe } from '@/lib/britoLigas'

export interface MiembroLiga {
  estudianteId: string
  nombre: string
  xpSemana: number
  posicion: number
}

export interface EstadoLiga {
  liga: number
  miPosicion: number
  diasRestantes: number
  miembros: MiembroLiga[]
}

export function RankingModal({
  estado, miId, variante = 'tarjeta',
}: {
  estado: EstadoLiga | null
  miId: string | null
  variante?: 'tarjeta' | 'icono' | 'navitem'
}) {
  const [abierto, setAbierto] = useState(false)
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])

  const liga = ligaDe(estado?.liga ?? 0)
  const total = estado?.miembros.length ?? 0
  // La zona de descenso solo existe si el grupo es lo bastante grande.
  const hayZonaDescenso = total > CUPOS_ASCENSO + CUPOS_DESCENSO
  const inicioDescenso = hayZonaDescenso ? total - CUPOS_DESCENSO + 1 : Infinity
  const puedeSubir = (estado?.liga ?? 0) < LIGAS.length - 1
  const puedeBajar = (estado?.liga ?? 0) > 0

  const modal = abierto && (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-[#1e1e19]/40 animate-fade-in" onClick={() => setAbierto(false)} />
      <div className="relative flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-slide-up">
          <button
            onClick={() => setAbierto(false)}
            className="absolute right-3.5 top-3.5 text-[#9a998f] transition-colors hover:text-[#2B2B28]"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Recorrido completo de ligas */}
          <div className="mb-5 flex items-end justify-center gap-1.5">
            {LIGAS.map(l => {
              const actual = l.nivel === estado?.liga
              const alcanzada = l.nivel <= (estado?.liga ?? 0)
              return (
                <div key={l.nivel} className="flex flex-col items-center gap-1" style={{ width: 56 }}>
                  <img
                    src={l.icono}
                    alt={l.nombre}
                    className={`object-contain transition-all ${actual ? 'h-11 w-11' : 'h-7 w-7'} ${alcanzada ? '' : 'opacity-35 grayscale'}`}
                  />
                  <span
                    className={`text-center text-[9.5px] leading-tight ${actual ? 'font-bold' : 'font-medium'}`}
                    style={{ color: actual ? l.color : '#a5a49b' }}
                  >
                    {l.nombre}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="mb-1 text-center">
            <h2 className="text-lg font-bold" style={{ color: liga.color }}>Liga {liga.nombre}</h2>
            <p className="mt-0.5 text-[11.5px] font-medium text-[#8a897f]">
              {estado
                ? `Termina en ${estado.diasRestantes} ${estado.diasRestantes === 1 ? 'día' : 'días'} · Puesto ${estado.miPosicion} de ${total}`
                : 'Completa una lección para entrar a competir'}
            </p>
          </div>

          {!estado || total === 0 ? (
            <p className="py-8 text-center text-sm font-medium text-[#8a897f]">
              Todavía no hay actividad esta semana. ¡Sé el primero!
            </p>
          ) : (
            <div className="mt-4 max-h-[50vh] space-y-1.5 overflow-y-auto pr-0.5">
              {estado.miembros.map(m => {
                const esYo = m.estudianteId === miId
                const enAscenso = puedeSubir && m.posicion <= CUPOS_ASCENSO
                const enDescenso = puedeBajar && m.posicion >= inicioDescenso
                return (
                  <div key={m.estudianteId}>
                    {enAscenso && m.posicion === 1 && (
                      <Separador texto="Zona de ascenso" color="#22C56E" />
                    )}
                    {enDescenso && m.posicion === inicioDescenso && (
                      <Separador texto="Zona de descenso" color="#D94A4A" />
                    )}
                    <div
                      className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${
                        esYo ? 'border-[#F5A623]/50 bg-[#F5A623]/12' : 'border-[#ECEAE2] bg-[#FAFAF7]'
                      }`}
                    >
                      <span className="flex w-7 items-center justify-center text-sm font-bold text-[#8a897f]">
                        {m.posicion <= 3
                          ? <img src="/brito/icons/medalla.png" alt={`Puesto ${m.posicion}`} className="h-6 w-6 object-contain" />
                          : m.posicion}
                      </span>
                      <span className="flex-1 truncate text-[13px] font-semibold text-[#2B2B28]">
                        {m.nombre}{esYo && ' (tú)'}
                      </span>
                      <span className="text-[13px] font-bold text-[#1E5FA8]">{m.xpSemana} XP</span>
                    </div>
                    {enAscenso && m.posicion === CUPOS_ASCENSO && (
                      <div className="mt-1.5 h-px" style={{ background: '#22C56E' }} />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <p className="mt-4 text-center text-[10.5px] font-medium leading-snug text-[#a5a49b]">
            Cada semana los {CUPOS_ASCENSO} primeros suben de liga
            {hayZonaDescenso && ` y los ${CUPOS_DESCENSO} últimos bajan`}.
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {variante === 'navitem' ? (
        <button
          onClick={() => setAbierto(true)}
          className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-semibold text-[#57564f] transition-colors hover:bg-[#F5F3EC]"
        >
          <img src="/brito/icons/trofeo.png" alt="" className="h-8 w-8 object-contain" /> Ligas
        </button>
      ) : variante === 'icono' ? (
        <button
          onClick={() => setAbierto(true)}
          title="Ligas"
          className="opacity-90 transition-opacity hover:opacity-100"
        >
          <img src={liga.icono} alt="Ligas" className="h-5 w-5 object-contain" />
        </button>
      ) : (
        <button
          onClick={() => setAbierto(true)}
          className="group flex w-full flex-col gap-2 rounded-2xl p-4 text-left"
          style={{ background: '#EAF1FA', border: '1px solid #DCE8F5' }}
        >
          <div className="flex items-center gap-2.5">
            <img src={liga.icono} alt="" className="h-9 w-9 object-contain" />
            <div className="min-w-0">
              <div className="text-[15px] font-bold" style={{ color: liga.color }}>Liga {liga.nombre}</div>
              {estado && (
                <div className="text-[11px] font-medium text-[#8a897f]">
                  Puesto {estado.miPosicion} de {estado.miembros.length}
                </div>
              )}
            </div>
          </div>
          <span className="text-xs font-medium leading-snug text-[#6b6a63]">
            {estado
              ? `Quedan ${estado.diasRestantes} ${estado.diasRestantes === 1 ? 'día' : 'días'}. Los ${CUPOS_ASCENSO} primeros suben de liga.`
              : 'Completa tu primera lección para entrar a competir.'}
          </span>
          <span
            className="mt-1.5 flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_12px_rgba(30,95,168,0.28)] transition-all group-hover:-translate-y-[2px] group-hover:brightness-110 group-hover:shadow-[0_7px_18px_rgba(30,95,168,0.4)] group-active:translate-y-0 group-active:brightness-95"
            style={{ background: '#1E5FA8' }}
          >
            Ver ranking <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>
      )}

      {montado && modal && createPortal(modal, document.body)}
    </>
  )
}

function Separador({ texto, color }: { texto: string; color: string }) {
  return (
    <div className="mb-1.5 mt-2 flex items-center gap-2 first:mt-0">
      <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color }}>{texto}</span>
      <span className="h-px flex-1" style={{ background: color, opacity: 0.45 }} />
    </div>
  )
}
