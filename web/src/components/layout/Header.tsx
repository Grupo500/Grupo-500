'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Home } from 'lucide-react'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { NotificacionesButton } from '@/components/ui/NotificacionesButton'

// Misma paleta fija del sidebar y de la barra flotante: las tres son la misma
// pieza de chrome, así que no siguen el tema claro/oscuro de la app.
const RAIL_BG = '#15203a'

// El mismo radio que usa el sidebar (su `R`), para no meter una curva nueva al
// sistema. Solo abajo: arriba el header va pegado al borde de la ventana y no
// tiene de qué separarse.
const RADIO_INFERIOR = 18

// Círculo claro sobre el oscuro. Se pasa por `className` porque los estilos por
// defecto de estos botones son para fondo claro. En celular bajan a 32px: con
// cuatro botones más el logo, a 36 se empujaban contra el nombre.
const BOTON =
  'w-8 h-8 md:w-9 md:h-9 rounded-full bg-white/[0.09] text-[#cfe3ff] ' +
  'hover:bg-white/[0.16] hover:text-white'

/**
 * Franja de marca a todo el ancho, encima del sidebar y del contenido.
 *
 * No lleva `position: fixed`: el layout del área es una columna de alto fijo
 * donde el que desplaza es el `<main>`, así que el header ya se queda quieto
 * por construcción. Fijarlo además obligaría a compensar su alto con padding
 * en el contenido y a pelear con la barra de direcciones del navegador móvil.
 *
 * En celular mide 62px —más alto que el escritorio a propósito: ahí el header
 * es la única marca visible y a 46px quedaba apretado (Hotman, 20-ago)— y
 * reserva el espacio de la muesca, para cuando la app se instala en la
 * pantalla de inicio.
 */
export function Header() {
  return (
    <header
      style={{
        background: RAIL_BG,
        borderBottomLeftRadius:  RADIO_INFERIOR,
        borderBottomRightRadius: RADIO_INFERIOR,
        paddingTop: 'env(safe-area-inset-top)',
      }}
      className="flex-shrink-0"
    >
      <div className="flex h-[62px] items-center justify-between gap-3 px-3.5 md:h-[60px] md:gap-4 md:px-4">
        <Link href="/inicio" className="flex min-w-0 items-center gap-2 md:gap-2.5" title="Volver al inicio">
          <Image
            src="/logo-grupo500.png"
            alt="Grupo 500"
            width={40}
            height={40}
            priority
            className="h-8 w-8 flex-shrink-0 rounded-full object-cover md:h-10 md:w-10"
          />
          {/* Se recorta antes que empujar los botones: en pantallas angostas la
              salida al selector pesa más que ver el nombre completo. */}
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-bold leading-none tracking-tight text-white md:text-[13.5px]">
              Grupo 500
            </span>
            <span className="mt-0.5 block truncate text-[9.5px] font-medium leading-none text-slate-400 md:text-[10.5px]">
              Pre-ICFES
            </span>
          </span>
        </Link>

        <div className="flex flex-shrink-0 items-center gap-1.5 md:gap-2">
          <Link
            href="/inicio"
            title="Volver al inicio"
            aria-label="Volver al inicio"
            className={`flex items-center justify-center transition-colors ${BOTON}`}
          >
            <Home className="h-4 w-4" />
          </Link>
          <NotificacionesButton className={BOTON} />
          <RefreshButton className={BOTON} />
        </div>
      </div>
    </header>
  )
}
