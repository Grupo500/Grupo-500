'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'

/** Cuánto dura el trazo del sendero. */
export const DURACION = 1900
/**
 * Piso de tiempo visible. Si el destino resuelve en 150 ms la animación
 * alcanza a parpadear, y un destello se siente peor que no tener transición.
 */
export const MINIMO = 700

/**
 * Pantalla de carga del juego: el sendero del mapa se dibuja de izquierda a
 * derecha con Brito corriendo encima. La animación arranca al montar, así que
 * el componente solo debe existir mientras la transición está corriendo
 * (montado vía portal a `document.body` para escapar de ancestros con
 * transform que atraparían el `position: fixed`).
 *
 * La comparten la portada (Preparando tu juego) y el mapa (Preparando tu
 * lección); cambia solo el mensaje.
 */
export function OverlaySendero({ mensaje }: { mensaje: string }) {
  const rutaRef = useRef<SVGPathElement>(null)
  const britoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ruta = rutaRef.current
    const brito = britoRef.current
    if (!ruta || !brito) return

    const largo = ruta.getTotalLength()
    ruta.style.strokeDasharray = String(largo)
    ruta.style.strokeDashoffset = String(largo)
    ruta.animate(
      [{ strokeDashoffset: largo }, { strokeDashoffset: 0 }],
      { duration: DURACION, easing: 'ease-in-out', fill: 'forwards' },
    )

    let inicio: number | null = null
    let cuadro = 0
    const paso = (t: number) => {
      if (inicio === null) inicio = t
      const avance = Math.min((t - inicio) / DURACION, 1)
      const p = ruta.getPointAtLength(avance * largo)
      // El lienzo del SVG es 1000x340 y se escala al ancho disponible. Se
      // traduce a porcentajes para que la mascota siga la curva en cualquier
      // pantalla; con píxeles quedaría desfasada al cambiar de tamaño.
      brito.style.left = `${(p.x / 1000) * 100}%`
      brito.style.top = `${(p.y / 340) * 100}%`
      if (avance < 1) cuadro = requestAnimationFrame(paso)
    }
    cuadro = requestAnimationFrame(paso)

    return () => cancelAnimationFrame(cuadro)
  }, [])

  return (
    <div
      className="fixed inset-0 z-[100] bg-[#F7F5EF] flex flex-col items-center justify-center animate-fade-in"
      role="status"
      aria-live="polite"
    >
      <div className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full bg-[#F5A623]/12 blur-3xl pointer-events-none" aria-hidden />
      <div className="absolute -bottom-40 -right-32 w-[560px] h-[560px] rounded-full bg-[#1E5FA8]/10 blur-3xl pointer-events-none" aria-hidden />

      <div className="relative w-full max-w-[820px] px-6">
        {/* El sendero replica la curva del mapa, así que la transición
            anticipa la pantalla que está por aparecer. */}
        <div className="relative w-full" style={{ aspectRatio: '1000 / 340' }}>
          <svg viewBox="0 0 1000 340" className="w-full h-full overflow-visible" aria-hidden>
            <path
              ref={rutaRef}
              d="M70 250 C 230 80, 370 300, 510 170 S 790 50, 930 150"
              fill="none"
              stroke="#DCD8C9"
              strokeWidth="11"
              strokeLinecap="round"
            />
            <circle cx="70" cy="250" r="16" fill="#22C56E" />
            <circle cx="510" cy="170" r="16" fill="#22C56E" />
            <circle cx="930" cy="150" r="19" fill="#F5A623" />
          </svg>

          <div
            ref={britoRef}
            className="absolute w-[92px] h-[92px] pointer-events-none"
            style={{ left: '7%', top: '73%', animation: 'brincoBrito 620ms ease-in-out infinite' }}
          >
            <Image src="/brito/brito-mascota.png" alt="" width={92} height={92} className="w-full h-full object-contain" priority />
          </div>
        </div>

        <p className="text-center text-[17px] font-extrabold text-[#57564f] mt-6">
          {mensaje}
        </p>
      </div>

      <style>{`
        @keyframes brincoBrito {
          0%, 100% { transform: translate(-50%, -70%) }
          50%      { transform: translate(-50%, -84%) }
        }
      `}</style>
    </div>
  )
}
