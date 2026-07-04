'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import gsap from 'gsap'

// Canvas de Three.js: sin SSR (usa window/WebGL) y cargado solo cuando hace falta
const Hero3DScene = dynamic(() => import('./Hero3DScene').then(m => m.Hero3DScene), { ssr: false })

function soportaWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

interface Props {
  children: React.ReactNode // contenido de texto/CTA superpuesto
  className?: string
}

export function Hero3D({ children, className = '' }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const overlayRef    = useRef<HTMLDivElement>(null)

  const [enViewport,      setEnViewport]      = useState(false)
  const [reducirMovimiento, setReducirMovimiento] = useState(false)
  const [webglOk,          setWebglOk]          = useState(true)
  const [pestañaVisible,   setPestañaVisible]   = useState(true)
  const [esMovil,          setEsMovil]          = useState(false)

  // Preferencia del sistema — se respeta siempre, sin importar el dispositivo
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducirMovimiento(mq.matches)
    setWebglOk(soportaWebGL())
    setEsMovil(window.matchMedia('(max-width: 768px)').matches)

    const onChange = (e: MediaQueryListEvent) => setReducirMovimiento(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Solo montar la escena 3D cuando el hero entra al viewport
  useEffect(() => {
    if (!contenedorRef.current) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setEnViewport(true); obs.disconnect() } },
      { threshold: 0.15 }
    )
    obs.observe(contenedorRef.current)
    return () => obs.disconnect()
  }, [])

  // Pausar el render 3D cuando la pestaña no está visible (batería/CPU)
  useEffect(() => {
    const onVisibility = () => setPestañaVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Entrada del texto/CTA con GSAP — corre siempre (también sin 3D), pero
  // se reduce a un simple fade si el usuario prefiere menos movimiento
  useEffect(() => {
    if (!overlayRef.current) return
    const elementos = overlayRef.current.querySelectorAll('[data-hero-anim]')
    if (elementos.length === 0) return

    if (reducirMovimiento) {
      gsap.set(elementos, { opacity: 1, y: 0 })
      return
    }
    gsap.fromTo(
      elementos,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.12, delay: 0.15 }
    )
  }, [reducirMovimiento])

  const mostrar3D = enViewport && webglOk && !reducirMovimiento

  return (
    <div ref={contenedorRef} className={`relative overflow-hidden ${className}`}>
      {/* Degradado de marca — siempre presente; el canvas 3D es transparente y va encima */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#21b9f7] via-[#4361ee] to-[#635cef]" />
      {mostrar3D && (
        <div className="absolute inset-0">
          <Hero3DScene liviano={esMovil} pausado={!pestañaVisible} />
        </div>
      )}

      {/* Overlay de texto/CTA — siempre legible, con capa oscura sutil para contraste */}
      <div className="absolute inset-0 bg-black/10 pointer-events-none" />
      <div ref={overlayRef} className="relative z-10">
        {children}
      </div>
    </div>
  )
}
