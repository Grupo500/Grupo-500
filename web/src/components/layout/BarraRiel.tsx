'use client'

/**
 * La barra de abajo: el sidebar de escritorio, acostado.
 *
 * Réplica del widget "El sidebar, acostado" que Hotman eligió sobre la barra
 * con joroba (21-ago). El mismo azul #15203a del riel, la misma curva CÓNCAVA
 * tallada en el borde (allá el derecho, aquí el de arriba) y el mismo círculo
 * cian #21b9f7 flotando medio afuera, asentado en el hueco. Donde la joroba
 * se abombaba, esta se ahueca — la firma visual del escritorio, en el
 * teléfono.
 *
 * El viaje entre módulos redibuja la silueta en cada cuadro: el hueco no es
 * un elemento que se desplaza sino parte del contorno del riel, así que se
 * recalcula el trazado mientras el círculo avanza — los dos llegan como una
 * sola pieza, en 0.8s con la curva de siempre. Se anima con un lazo propio
 * (no transiciones CSS): las transiciones se tragan el viaje cuando la
 * navegación de Next comprime los cuadros, ya nos pasó con la joroba.
 *
 * Lo demás es lo que ya estaba blindado: la pestaña activa vive fuera del
 * componente (cada área monta su propia barra y al navegar entre áreas nace
 * de cero), la barra se esconde al hacer scroll y vuelve al detenerse, y el
 * scroll que dispara la propia navegación no cuenta.
 */

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export interface PestanaBarra {
  key: string
  /** Solo para lectores de pantalla: la barra no lleva rótulos a la vista. */
  label: string
  icon: LucideIcon
  activa: boolean
  /** Navega. Si no hay, tiene que haber `onClick` (así entra el panel "Más"). */
  href?: string
  onClick?: () => void
}

/** Los colores del sidebar de escritorio, exactos. */
const RIEL = '#15203a'
const CIAN = '#21b9f7'
const APAGADO = '#94a3b8'

const DURACION_MS = 800

/** Zona transparente arriba del riel: por ahí asoma el círculo. */
const TECHO = 34
const ALTO_FILA = 64
/** Cuánto se ahueca la curva y su medio ancho (el sidebar usa 38/52 en vertical). */
const PROFUNDO = 30
const MEDIO = 56
const CIRCULO = 52

/**
 * La pestaña activa que se vio por última vez, FUERA del componente: cada
 * área tiene su propio layout con su propia barra, y sin esta memoria el
 * recién montado pintaba la nueva ya activa, sin viaje.
 */
let memoriaActiva: string | null = null

/** cubic-bezier(.45,0,.15,1) resuelta numéricamente, para el lazo de animación. */
function curva(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const sx = (u: number) => 3 * 0.45 * u * (1 - u) * (1 - u) + 3 * 0.15 * u * u * (1 - u) + u * u * u
  const sy = (u: number) => 3 * 0 * u * (1 - u) * (1 - u) + 3 * 1 * u * u * (1 - u) + u * u * u
  let lo = 0, hi = 1, u = t
  for (let i = 0; i < 24; i++) {
    u = (lo + hi) / 2
    if (sx(u) < t) lo = u; else hi = u
  }
  return sy(u)
}

export function BarraRiel({ pestanas, className }: {
  pestanas: PestanaBarra[]
  className?: string
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  const svgRef     = useRef<SVGSVGElement>(null)
  const silueta    = useRef<SVGPathElement>(null)
  const circulo    = useRef<HTMLSpanElement>(null)
  const fila       = useRef<HTMLDivElement>(null)
  const cxActual   = useRef<number | null>(null)
  const animacion  = useRef<number | null>(null)

  const activaReal = pestanas.find(p => p.activa)?.key ?? null
  const [activaVisual, setActivaVisual] = useState<string | null>(() =>
    memoriaActiva !== null && pestanas.some(p => p.key === memoriaActiva)
      ? memoriaActiva
      : activaReal,
  )

  // En el render y no en un efecto: el scroll que dispara la navegación puede
  // llegar antes de que los efectos corran, y no debe esconder la barra
  // mientras el hueco viaja.
  const ultimoCambio = useRef(Date.now())
  if (activaVisual !== activaReal) ultimoCambio.current = Date.now()

  // El cambio visual espera un cuadro PINTADO del estado anterior: de ahí
  // arranca el viaje.
  useEffect(() => {
    if (activaVisual === activaReal) return
    let id2 = 0
    const id = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setActivaVisual(activaReal))
    })
    return () => { cancelAnimationFrame(id); cancelAnimationFrame(id2) }
  }, [activaReal, activaVisual])

  useEffect(() => { memoriaActiva = activaVisual }, [activaVisual])

  /** La silueta del riel: borde superior recto con el hueco cóncavo en `cx`. */
  const dibujar = (cx: number | null) => {
    const caja = contenedor.current, path = silueta.current, svg = svgRef.current
    if (!caja || !path || !svg) return
    const w = caja.clientWidth, h = caja.clientHeight
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
    const p = [`M0,${TECHO}`]
    if (cx !== null) {
      p.push(
        `H${(cx - MEDIO).toFixed(1)}`,
        `C${(cx - MEDIO * 0.35).toFixed(1)},${TECHO} ${(cx - MEDIO * 0.6).toFixed(1)},${TECHO + PROFUNDO} ${cx.toFixed(1)},${TECHO + PROFUNDO}`,
        `C${(cx + MEDIO * 0.6).toFixed(1)},${TECHO + PROFUNDO} ${(cx + MEDIO * 0.35).toFixed(1)},${TECHO} ${(cx + MEDIO).toFixed(1)},${TECHO}`,
      )
    }
    p.push(`H${w}`, `V${h}`, `H0`, `Z`)
    path.setAttribute('d', p.join(' '))
  }

  const ponerCirculo = (cx: number) => {
    if (circulo.current) circulo.current.style.left = `${cx}px`
  }

  useEffect(() => {
    const caja = contenedor.current
    if (!caja) return

    const centroActiva = (): number | null => {
      const activa = fila.current?.querySelector<HTMLElement>('[data-activa="true"]')
      if (!activa) return null
      return activa.offsetLeft + (fila.current?.offsetLeft ?? 0) + activa.offsetWidth / 2
    }

    const colocar = (animando: boolean) => {
      if (animacion.current) cancelAnimationFrame(animacion.current)
      const cx = centroActiva()
      if (cx === null) {
        dibujar(null)
        if (circulo.current) circulo.current.style.opacity = '0'
        cxActual.current = null
        return
      }
      if (circulo.current) circulo.current.style.opacity = '1'

      const desde = cxActual.current
      cxActual.current = cx
      if (!animando || desde === null || desde === cx) {
        dibujar(cx)
        ponerCirculo(cx)
        return
      }
      // El lazo redibuja silueta y círculo juntos, cuadro a cuadro: el hueco
      // es parte del contorno, no un elemento que se pueda transicionar.
      const inicio = performance.now()
      const paso = (ahora: number) => {
        const t = Math.min(1, (ahora - inicio) / DURACION_MS)
        const x = desde + (cx - desde) * curva(t)
        dibujar(x)
        ponerCirculo(x)
        animacion.current = t < 1 ? requestAnimationFrame(paso) : null
      }
      animacion.current = requestAnimationFrame(paso)
    }

    colocar(true)

    const alRedimensionar = () => colocar(false)
    window.addEventListener('resize', alRedimensionar)
    window.addEventListener('orientationchange', alRedimensionar)
    return () => {
      if (animacion.current) cancelAnimationFrame(animacion.current)
      window.removeEventListener('resize', alRedimensionar)
      window.removeEventListener('orientationchange', alRedimensionar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activaVisual, pestanas.length])

  // Se esconde mientras se hace scroll — en cualquier dirección — y vuelve al
  // detenerse. Oyente en captura (el que desplaza es el <main> del área) y
  // estilo directo, sin estado de React, para no re-renderizar a 60/s.
  useEffect(() => {
    const caja = contenedor.current
    if (!caja) return
    let quieto: ReturnType<typeof setTimeout> | undefined
    const alDesplazar = () => {
      if (Date.now() - ultimoCambio.current < 1000) return
      caja.style.transform = 'translateY(100%)'
      clearTimeout(quieto)
      quieto = setTimeout(() => { caja.style.transform = 'translateY(0)' }, 220)
    }
    window.addEventListener('scroll', alDesplazar, { capture: true, passive: true })
    return () => {
      clearTimeout(quieto)
      window.removeEventListener('scroll', alDesplazar, { capture: true })
    }
  }, [])

  const IconoActivo = pestanas.find(p => p.key === activaVisual)?.icon ?? null

  return (
    <div
      ref={contenedor}
      className={cn('fixed inset-x-0 bottom-0 z-30 md:hidden', className)}
      style={{
        // Techo transparente + fila + aire de la línea de gesto: el mayor
        // entre la zona segura y 18px, nunca la suma.
        height: `calc(${TECHO + ALTO_FILA}px + max(env(safe-area-inset-bottom, 0px), 18px))`,
        transition: 'transform .35s cubic-bezier(.4,0,.2,1)',
      }}
    >
      <svg ref={svgRef} className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="none">
        {/* Sombra hacia arriba del riel, barata: no re-rasteriza en cada cuadro. */}
        <path ref={silueta} fill={RIEL} d="" style={{ filter: 'drop-shadow(0 -4px 10px rgba(0,29,61,0.18))' }} />
      </svg>

      {/* El círculo cian del sidebar, con su resplandor, medio afuera del riel. */}
      <span
        ref={circulo}
        aria-hidden
        className="pointer-events-none absolute grid place-items-center rounded-full text-white opacity-0"
        style={{
          top: TECHO,
          left: 0,
          width: CIRCULO,
          height: CIRCULO,
          background: CIAN,
          boxShadow: '0 6px 16px rgba(33,185,247,0.5)',
          transform: 'translate(-50%,-50%)',
        }}
      >
        {IconoActivo && <IconoActivo className="h-6 w-6" strokeWidth={2} />}
      </span>

      <div ref={fila} className="absolute left-3 right-3 flex items-center" style={{ top: TECHO, height: ALTO_FILA }}>
        {pestanas.map(p => {
          const activa = p.key === activaVisual
          const Icono = p.icon
          const dentro = <Icono className="h-[30px] w-[30px] flex-none" strokeWidth={2} />
          const clases = cn(
            'flex h-16 min-w-0 cursor-pointer items-center justify-center transition-opacity duration-300',
            // El icono activo vive dentro del círculo, no en la fila.
            activa && 'opacity-0',
          )
          const estilo = { width: `${100 / pestanas.length}%`, flex: `0 0 ${100 / pestanas.length}%`, color: APAGADO }

          return p.href
            ? (
              <Link key={p.key} href={p.href} aria-label={p.label} data-activa={activa} aria-current={activa ? 'page' : undefined} className={clases} style={estilo}>
                {dentro}
              </Link>
            )
            : (
              <button key={p.key} type="button" onClick={p.onClick} aria-label={p.label} data-activa={activa} aria-expanded={activa} className={clases} style={estilo}>
                {dentro}
              </button>
            )
        })}
      </div>
    </div>
  )
}
