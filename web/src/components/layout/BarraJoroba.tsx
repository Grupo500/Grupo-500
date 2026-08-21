'use client'

/**
 * La barra de abajo, con joroba — réplica del widget aprobado por Hotman
 * (21-ago, "La barra con joroba").
 *
 * De borde a borde y asentada en el fondo de la pantalla, sin esquinas
 * redondeadas: así la joroba acompaña a la primera y a la última pestaña sin
 * pisar ninguna curva. Cubre también la zona de la línea de gesto del
 * teléfono en el mismo azul. Sin rótulos: los iconos hablan solos.
 *
 * El icono de la sección abierta se sube a un círculo azul, la barra se
 * levanta debajo para recibirlo (la joroba: un `clipPath` sobre un
 * rectángulo del color de la barra) y las líneas del icono se dibujan de un
 * trazo. Al deseleccionarse, cae a su puesto con el mismo movimiento.
 *
 * El círculo vive DENTRO del contenedor del icono: su centro es el centro
 * del icono por construcción — cuadrarlos a mano con píxeles se descuadraba
 * con cada ajuste. Y no viaja entre pestañas: aparece en la nueva y
 * desaparece de la anterior, a la par con la joroba.
 *
 * Las cuatro animaciones —joroba, subida, caída y trazo— duran exactamente
 * DURACION, con la misma curva: velocidades distintas hacían que el conjunto
 * no se leyera como un solo gesto (el círculo, con la opacidad a un tercio
 * del tiempo, parecía llegar antes). 0.8s es la que eligió Hotman con la
 * perilla del widget.
 *
 * Proporciones medidas del original: joroba 2.24 veces el diámetro del
 * círculo, alto = ancho/4.46 (la proporción natural del clipPath, 202.9 ×
 * 45.5). SIEMPRE centrada en su pestaña.
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

/** Azul oscuro del header y del sidebar: las tres son la misma pieza de chrome. */
const FONDO = '#15203a'

/** La única velocidad de las cuatro animaciones (elegida con la perilla). */
const DURACION = '.8s'
const CURVA = 'cubic-bezier(.45,0,.15,1)'

const CIRCULO = 64
const JOROBA_ANCHO = Math.round(CIRCULO * 2.24)          // 143
const JOROBA_ALTO  = Math.round(JOROBA_ANCHO / 4.46)     // 32
/** Cuánto sube el par icono+círculo: deja el círculo asomando sobre la barra. */
const SUBIDA = 18

export function BarraJoroba({ pestanas, className }: {
  pestanas: PestanaBarra[]
  className?: string
}) {
  const barra  = useRef<HTMLElement>(null)
  const joroba = useRef<HTMLSpanElement>(null)
  const [listo, setListo] = useState(false)

  const indiceActiva = pestanas.findIndex(p => p.activa)

  /**
   * Normaliza el largo de los trazos de los iconos a 100 (`pathLength`).
   *
   * Sin esto el dibujo es disparejo: el dash de la animación mide lo mismo
   * para todos, pero una raya del menú mide una fracción de lo que mide la
   * casita — el trazo corto pasaba casi toda la animación invisible y
   * aparecía de golpe al final. lucide no expone el atributo, así que se
   * pone a mano sobre el DOM.
   */
  useEffect(() => {
    barra.current
      ?.querySelectorAll('svg :is(path,circle,rect,line,polyline)')
      .forEach(el => el.setAttribute('pathLength', '100'))
  }, [pestanas.length])

  useEffect(() => {
    const nav = barra.current
    const bulto = joroba.current
    if (!nav || !bulto) return

    const colocar = (animando: boolean) => {
      const activa = nav.querySelector<HTMLElement>('[data-activa="true"]')
      if (!activa) { bulto.style.opacity = '0'; return }
      if (!animando) bulto.style.transition = 'none'
      const x = Math.round(activa.offsetLeft + (activa.offsetWidth - JOROBA_ANCHO) / 2)
      bulto.style.transform = `translate3d(${x}px,0,0)`
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
      className={cn('fixed inset-x-0 bottom-0 z-30 md:hidden', className)}
      // `drop-shadow` y no `box-shadow`: sigue la silueta completa, barra más
      // joroba. Un box-shadow dibujaría el rectángulo y dejaría la joroba sin
      // sombra.
      style={{ filter: 'drop-shadow(0 -6px 22px rgba(0,29,61,0.25))' }}
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

      <nav
        ref={barra}
        // 12px de resguardo y no mas: el aire se lo llevan las pestanas, y en
        // los extremos la cola de la joroba corre hasta el borde y se funde
        // con el, como en el original (Hotman, 21-ago).
        className="relative flex items-end px-3"
        style={{ background: FONDO, paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <span
          ref={joroba}
          aria-hidden
          className="pointer-events-none absolute left-0 opacity-0"
          style={{
            top: -JOROBA_ALTO + 1,
            width: JOROBA_ANCHO,
            height: JOROBA_ALTO,
            background: FONDO,
            clipPath: 'url(#joroba-curva)',
            transition: `transform ${DURACION} ${CURVA}`,
          }}
        />

        {pestanas.map(p => {
          const Icono = p.icon
          const dentro = (
            <span
              className={cn('relative grid place-items-center', p.activa && 'trazo-icono')}
              style={{
                transform: p.activa ? `translateY(-${SUBIDA}px)` : 'translateY(0)',
                color: p.activa ? '#fff' : '#8fa6c9',
                transition: `transform ${DURACION} ${CURVA}, color .4s`,
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
                style={{
                  width: CIRCULO,
                  height: CIRCULO,
                  background: '#2094ff',
                  zIndex: -1,
                  transform: `translate(-50%,-50%) scale(${p.activa ? 1 : 0.2})`,
                  opacity: p.activa ? 1 : 0,
                  transition: `transform ${DURACION} ${CURVA}, opacity ${DURACION} ${CURVA}`,
                }}
              />
              <Icono className="h-[34px] w-[34px]" strokeWidth={2} />
            </span>
          )

          const clases = 'relative flex h-16 flex-1 min-w-0 cursor-pointer flex-col items-center justify-center'

          return p.href
            ? (
              <Link key={p.key} href={p.href} aria-label={p.label} data-activa={p.activa} aria-current={p.activa ? 'page' : undefined} className={clases}>
                {dentro}
              </Link>
            )
            : (
              <button key={p.key} type="button" onClick={p.onClick} aria-label={p.label} data-activa={p.activa} aria-expanded={p.activa} className={clases}>
                {dentro}
              </button>
            )
        })}
      </nav>
    </div>
  )
}
