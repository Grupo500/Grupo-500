'use client'

/**
 * La barra de abajo, con joroba.
 *
 * El icono de la sección abierta se sube a un círculo azul y la barra se
 * levanta debajo para recibirlo; la joroba se desliza de una pestaña a otra.
 * La curva sale de un `clipPath` recortado sobre un rectángulo del mismo color
 * de la barra — dibujarla con `border-radius` no da esa entrada suave a los
 * lados (Hotman, 21-ago).
 *
 * La joroba se coloca midiendo dónde quedó la pestaña abierta: su ancho es
 * exactamente el de una pestaña, así que en la primera y en la última no se
 * sale de la barra ni pisa las esquinas redondeadas.
 *
 * Siempre son cuatro pestañas —tres módulos y "Más"—, regla de toda la app en
 * celular; con un número fijo, cada salto recorre la misma distancia.
 */

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export interface PestanaBarra {
  key: string
  label: string
  icon: LucideIcon
  activa: boolean
  /** Navega. Si no hay, tiene que haber `onClick` (así entra el panel "Más"). */
  href?: string
  onClick?: () => void
}

/** Azul oscuro del header y del sidebar: las tres son la misma pieza de chrome. */
const FONDO = '#15203a'
const ALTO_JOROBA = 26

export function BarraJoroba({ pestanas, className }: {
  pestanas: PestanaBarra[]
  className?: string
}) {
  const barra  = useRef<HTMLElement>(null)
  const joroba = useRef<HTMLSpanElement>(null)
  const [listo, setListo] = useState(false)

  const indiceActiva = pestanas.findIndex(p => p.activa)

  useEffect(() => {
    const nav = barra.current
    const bulto = joroba.current
    if (!nav || !bulto) return

    const colocar = (animando: boolean) => {
      const activa = nav.querySelector<HTMLElement>('[data-activa="true"]')
      if (!activa) { bulto.style.opacity = '0'; return }
      if (!animando) bulto.style.transition = 'none'
      const ancho = activa.offsetWidth
      bulto.style.width = `${ancho}px`
      bulto.style.transform = `translate3d(${Math.round(activa.offsetLeft)}px,0,0)`
      bulto.style.opacity = '1'
      if (!animando) requestAnimationFrame(() => { bulto.style.transition = '' })
    }

    // La primera colocación va sin animación: si no, la joroba entra
    // deslizándose desde el borde izquierdo cada vez que se carga una página.
    colocar(listo)
    if (!listo) setListo(true)

    const alRedimensionar = () => colocar(false)
    window.addEventListener('resize', alRedimensionar)
    window.addEventListener('orientationchange', alRedimensionar)
    return () => {
      window.removeEventListener('resize', alRedimensionar)
      window.removeEventListener('orientationchange', alRedimensionar)
    }
    // `listo` a propósito fuera: solo distingue la primera pasada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indiceActiva, pestanas.length])

  return (
    <div
      className={cn('fixed left-4 right-4 z-30 md:hidden', className)}
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 12px)',
        // La sombra va aquí y no en la barra: `drop-shadow` sigue la silueta
        // completa —barra más joroba— mientras que un `box-shadow` dibujaría
        // el rectángulo y dejaría la joroba flotando sin sombra.
        filter: 'drop-shadow(0 10px 26px rgba(0,29,61,0.45))',
      }}
    >
      {/* La curva, una sola vez. `clip-path: url(#…)` la busca en el documento. */}
      <svg width="0" height="0" aria-hidden className="absolute">
        <clipPath
          id="joroba-curva"
          clipPathUnits="objectBoundingBox"
          transform="scale(0.0049285362247413 0.021978021978022)"
        >
          <path d="M6.7,45.5c5.7,0.1,14.1-0.4,23.3-4c5.7-2.3,9.9-5,18.1-10.5c10.7-7.1,11.8-9.2,20.6-14.3c5-2.9,9.2-5.2,15.2-7 c7.1-2.1,13.3-2.3,17.6-2.1c4.2-0.2,10.5,0.1,17.6,2.1c6.1,1.8,10.2,4.1,15.2,7c8.8,5,9.9,7.1,20.6,14.3c8.3,5.5,12.4,8.2,18.1,10.5 c9.2,3.6,17.6,4.2,23.3,4H6.7z" />
        </clipPath>
      </svg>

      <nav ref={barra} className="relative flex h-16 items-end rounded-[28px]" style={{ background: FONDO }}>
        <span
          ref={joroba}
          aria-hidden
          className="pointer-events-none absolute left-0 opacity-0"
          style={{
            top: -ALTO_JOROBA + 1,
            height: ALTO_JOROBA,
            background: FONDO,
            clipPath: 'url(#joroba-curva)',
            transition: 'transform .45s cubic-bezier(.42,0,.14,1.05), width .45s cubic-bezier(.42,0,.14,1.05)',
          }}
        />

        {pestanas.map(p => {
          const Icono = p.icon
          const dentro = (
            <>
              {/* El círculo, detrás del icono levantado. */}
              <span
                aria-hidden
                className={cn(
                  'pointer-events-none absolute left-1/2 rounded-full transition-[transform,opacity] duration-[450ms] ease-[cubic-bezier(.34,1.4,.5,1)]',
                  p.activa ? 'opacity-100' : 'opacity-0',
                )}
                style={{
                  top: -26,
                  width: 52,
                  height: 52,
                  background: '#2094ff',
                  transform: `translateX(-50%) scale(${p.activa ? 1 : 0.2})`,
                }}
              />
              <Icono
                className={cn(
                  'relative w-[21px] h-[21px] transition-[transform,color] duration-[450ms] ease-[cubic-bezier(.42,0,.14,1.05)]',
                  p.activa ? 'text-white -translate-y-8' : 'text-[#8fa6c9]',
                )}
              />
              <span
                className={cn(
                  'absolute bottom-2 text-[10.5px] font-semibold leading-none text-white transition-[opacity,transform] duration-300 delay-100',
                  p.activa ? 'opacity-100 translate-y-0' : 'translate-y-2 opacity-0',
                )}
              >
                {p.label}
              </span>
            </>
          )

          const clases = 'relative flex h-16 flex-1 min-w-0 cursor-pointer flex-col items-center justify-center'

          return p.href
            ? (
              <Link key={p.key} href={p.href} data-activa={p.activa} aria-current={p.activa ? 'page' : undefined} className={clases}>
                {dentro}
              </Link>
            )
            : (
              <button key={p.key} type="button" onClick={p.onClick} data-activa={p.activa} aria-expanded={p.activa} className={clases}>
                {dentro}
              </button>
            )
        })}
      </nav>
    </div>
  )
}
