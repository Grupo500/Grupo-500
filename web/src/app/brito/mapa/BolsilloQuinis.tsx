'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/** Cuánto dura la escena completa antes de cerrarse sola. */
const DURACION_ESCENA = 4200

/** Las monedas caen en secuencia hacia la ranura. */
const MONEDAS = [0, 0.55, 1.1, 1.65, 2.2]

/** Estrellitas que saltan del marranito con cada moneda. */
const ESTRELLAS = [
  { left: '22%', top: '30%', delay: 0.75, tam: 22 },
  { left: '74%', top: '24%', delay: 1.3, tam: 16 },
  { left: '16%', top: '52%', delay: 1.85, tam: 15 },
  { left: '82%', top: '46%', delay: 2.4, tam: 20 },
  { left: '30%', top: '16%', delay: 2.95, tam: 15 },
  { left: '66%', top: '58%', delay: 3.2, tam: 17 },
]

/**
 * El bolsillo de Quinis del panel del mapa: una tarjeta con la moneda, sin
 * texto ni conteo. Al tocarla se abre la escena de recolección — las monedas
 * caen a la ranura del marranito, que rebota feliz entre estrellitas.
 */
export function BolsilloQuinis() {
  const [abierto, setAbierto] = useState(false)
  const [montado, setMontado] = useState(false)

  // El portal necesita `document`, que no existe al renderizar en el servidor.
  useEffect(() => setMontado(true), [])

  useEffect(() => {
    if (!abierto) return
    const cierre = setTimeout(() => setAbierto(false), DURACION_ESCENA)
    return () => clearTimeout(cierre)
  }, [abierto])

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        aria-label="Bolsillo de Quinis"
        className="rounded-2xl p-4 flex items-center justify-center cursor-pointer transition-transform hover:-translate-y-0.5"
        style={{ background: '#FDF3DF', border: '1px solid #F5DFB3' }}
      >
        <img src="/brito/icons/quini.png" alt="" className="w-14 h-14 object-contain drop-shadow-sm" />
      </button>

      {abierto && montado && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in"
          style={{ background: 'rgba(43,43,40,0.55)', backdropFilter: 'blur(2px)' }}
          role="dialog"
          aria-label="Recolección de Quinis"
          onClick={() => setAbierto(false)}
        >
          <div className="relative w-[320px] h-[400px] sm:w-[380px] sm:h-[460px]">
            {/* Monedas cayendo hacia la ranura */}
            {MONEDAS.map((delay, i) => (
              <img
                key={i}
                src="/brito/icons/quini.png"
                alt=""
                className="quini-cae absolute w-12 h-12 object-contain"
                style={{ left: '50%', top: 0, animationDelay: `${delay}s` }}
              />
            ))}

            {/* Estrellitas al impacto */}
            {ESTRELLAS.map((e, i) => (
              <span
                key={i}
                aria-hidden
                className="quini-estrella absolute"
                style={{ left: e.left, top: e.top, fontSize: e.tam, animationDelay: `${e.delay}s`, color: '#F5A623', textShadow: '0 0 10px rgba(245,166,35,0.55)' }}
              >
                ✦
              </span>
            ))}

            {/* El marranito feliz */}
            <img
              src="/brito/marranito.png"
              alt="Marranito alcancía"
              className="quini-marranito absolute left-1/2 bottom-0 w-[240px] sm:w-[290px] object-contain"
            />
          </div>

          <style>{`
            @keyframes quiniCae {
              0%   { transform: translate(-50%, -40px) rotate(-8deg) scale(0.7); opacity: 0; }
              12%  { opacity: 1; transform: translate(-50%, 0) rotate(0deg) scale(1); }
              68%  { transform: translate(-50%, 168px) rotate(10deg) scale(1); opacity: 1; }
              84%  { transform: translate(-50%, 196px) rotate(12deg) scale(0.35); opacity: 0.9; }
              100% { transform: translate(-50%, 200px) scale(0.2); opacity: 0; }
            }
            .quini-cae { opacity: 0; animation: quiniCae 1.1s cubic-bezier(.45,.02,.6,1) forwards; }

            @keyframes quiniFeliz {
              0%, 100% { transform: translateX(-50%) rotate(0) scale(1); }
              12% { transform: translateX(-50%) rotate(-4deg) scale(1.03, 0.97); }
              24% { transform: translateX(-50%) rotate(3deg) scale(0.98, 1.04) translateY(-8px); }
              36% { transform: translateX(-50%) rotate(-2deg) scale(1.02, 0.98); }
              48% { transform: translateX(-50%) rotate(0) scale(1); }
            }
            .quini-marranito { transform-origin: 50% 95%; transform: translateX(-50%); animation: quiniFeliz 1.1s ease-in-out 0.6s 3; }

            @keyframes quiniEstrella {
              0%   { opacity: 0; transform: scale(0.2) rotate(0deg); }
              35%  { opacity: 1; transform: scale(1.25) rotate(20deg); }
              100% { opacity: 0; transform: scale(0.4) rotate(45deg) translateY(-26px); }
            }
            .quini-estrella { opacity: 0; animation: quiniEstrella 0.9s ease-out forwards; }

            @media (prefers-reduced-motion: reduce) {
              .quini-cae, .quini-estrella { animation: none; opacity: 0; }
              .quini-marranito { animation: none; }
            }
          `}</style>
        </div>,
        document.body,
      )}
    </>
  )
}
