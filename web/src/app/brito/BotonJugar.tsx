'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { OverlaySendero, DURACION, MINIMO } from './TransicionSendero'

/**
 * Botón principal de la portada con la transición de entrada al juego.
 *
 * Al presionar, la pantalla de carga del sendero cubre todo y al terminar se
 * navega. La idea es que la espera anticipe lo que viene en vez de tapar la
 * pantalla con un girador genérico.
 */
export function BotonJugar({ href, children, variante = 'principal' }: {
  href: string
  children: React.ReactNode
  /** Un admin entra a jugar desde el botón secundario, no desde el principal. */
  variante?: 'principal' | 'secundario'
}) {
  const router = useRouter()
  const [corriendo, setCorriendo] = useState(false)
  const [montado, setMontado] = useState(false)

  // El portal necesita `document`, que no existe al renderizar en el servidor.
  useEffect(() => setMontado(true), [])

  // Se precarga la ruta al montar: así el trazo y la descarga del mapa corren
  // en paralelo y la animación no queda esperando a la red.
  useEffect(() => { router.prefetch(href) }, [router, href])

  useEffect(() => {
    if (!corriendo) return
    const salto = setTimeout(() => router.push(href), Math.max(DURACION, MINIMO))
    return () => clearTimeout(salto)
  }, [corriendo, router, href])

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

      {corriendo && montado && createPortal(
        <OverlaySendero mensaje="Preparando tu juego" />,
        document.body,
      )}
    </>
  )
}
