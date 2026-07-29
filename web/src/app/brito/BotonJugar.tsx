'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

/** Cuánto dura el trazo del sendero. */
const DURACION = 1900
/**
 * Piso de tiempo visible. Si el mapa resuelve en 150 ms la animación alcanza a
 * parpadear, y un destello se siente peor que no tener transición.
 */
const MINIMO = 700

/**
 * Botón principal de la portada con la transición de entrada al juego.
 *
 * Al presionar, el sendero del mapa se dibuja de izquierda a derecha con Brito
 * corriendo encima, y al terminar se navega. La idea es que la espera anticipe
 * lo que viene en vez de tapar la pantalla con un girador genérico.
 */
export function BotonJugar({ href, children, variante = 'principal' }: {
  href: string
  children: React.ReactNode
  /** Un admin entra a jugar desde el botón secundario, no desde el principal. */
  variante?: 'principal' | 'secundario'
}) {
  const router = useRouter()
  const [corriendo, setCorriendo] = useState(false)
  const rutaRef = useRef<SVGPathElement>(null)
  const britoRef = useRef<HTMLDivElement>(null)

  // Se precarga la ruta al montar: así el trazo y la descarga del mapa corren
  // en paralelo y la animación no queda esperando a la red.
  useEffect(() => { router.prefetch(href) }, [router, href])

  function arrancar(e: React.MouseEvent) {
    e.preventDefault()
    if (corriendo) return

    // Quien pidió menos movimiento no debería recibir una animación de dos
    // segundos: se navega de inmediato.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      router.push(href)
      return
    }

    setCorriendo(true)
  }

  // La animación vive en un efecto y no en el manejador del clic: necesita que
  // el SVG ya esté en el DOM para medir el largo del trazo.
  useEffect(() => {
    if (!corriendo) return
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
      // El SVG usa un lienzo de 1000x400 escalado al viewport; se traduce a
      // porcentajes para que la mascota siga la curva en cualquier pantalla.
      brito.style.left = `${(p.x / 1000) * 100}%`
      brito.style.top = `${(p.y / 400) * 100}%`
      if (avance < 1) cuadro = requestAnimationFrame(paso)
    }
    cuadro = requestAnimationFrame(paso)

    const salto = setTimeout(() => router.push(href), Math.max(DURACION, MINIMO))

    return () => { cancelAnimationFrame(cuadro); clearTimeout(salto) }
  }, [corriendo, router, href])

  return (
    <>
      <button
        onClick={arrancar}
        disabled={corriendo}
        className={
          variante === 'principal'
            ? 'block w-full text-center rounded-2xl py-3.5 text-[15px] font-extrabold text-white transition-all active:translate-y-[3px] active:shadow-none disabled:opacity-90 cursor-pointer'
            : 'block w-full text-center rounded-2xl py-3.5 text-[15px] font-bold text-[#2B2B28] bg-white border-2 border-[#E3E0D6] transition-all hover:bg-[#FAF9F5] active:translate-y-[2px] active:shadow-none disabled:opacity-90 cursor-pointer'
        }
        style={
          variante === 'principal'
            ? { background: 'linear-gradient(180deg, #F5A623 0%, #E8940D 100%)', boxShadow: '0 4px 0 #C97E1E' }
            : { boxShadow: '0 3px 0 #E3E0D6' }
        }
      >
        {children}
      </button>

      {corriendo && (
        <div
          className="fixed inset-0 z-50 bg-[#F7F5EF] flex items-center justify-center animate-fade-in"
          role="status"
          aria-live="polite"
        >
          <div className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-[#F5A623]/12 blur-3xl" aria-hidden />
          <div className="absolute -bottom-32 -right-24 w-[460px] h-[460px] rounded-full bg-[#1E5FA8]/10 blur-3xl" aria-hidden />

          <div className="relative w-full max-w-[900px] px-6">
            {/* El sendero replica la curva del mapa, así que la transición
                anticipa la pantalla que está por aparecer. */}
            <div className="relative w-full" style={{ aspectRatio: '1000 / 400' }}>
              <svg viewBox="0 0 1000 400" className="w-full h-full" aria-hidden>
                <path
                  ref={rutaRef}
                  d="M80 300 C 240 110, 380 350, 520 210 S 800 80, 930 190"
                  fill="none"
                  stroke="#DCD8C9"
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <circle cx="80" cy="300" r="17" fill="#22C56E" />
                <circle cx="520" cy="210" r="17" fill="#22C56E" />
                <circle cx="930" cy="190" r="20" fill="#F5A623" />
              </svg>

              <div
                ref={britoRef}
                className="absolute w-[76px] h-[76px] -translate-x-1/2 -translate-y-[68%] pointer-events-none"
                style={{ left: '8%', top: '75%', animation: 'brincoBrito 620ms ease-in-out infinite' }}
              >
                <Image src="/brito/brito-mascota.png" alt="" width={76} height={76} className="w-full h-full object-contain" priority />
              </div>
            </div>

            <p className="text-center text-[15px] font-bold text-[#57564f] mt-2">
              Preparando tu juego
            </p>
          </div>

          <style>{`
            @keyframes brincoBrito {
              0%, 100% { transform: translate(-50%, -68%) }
              50%      { transform: translate(-50%, -80%) }
            }
          `}</style>
        </div>
      )}
    </>
  )
}
