'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Home } from 'lucide-react'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { NotificacionesButton } from '@/components/ui/NotificacionesButton'

// Misma paleta fija del sidebar: el header y la barra son la misma pieza de
// marca partida en dos, así que no siguen el tema claro/oscuro de la app.
const RAIL_BG = '#15203a'

// Los cuatro botones van en círculo claro sobre el oscuro. Se pasa por
// `className` porque sus estilos por defecto son para fondo claro.
const BOTON = 'w-9 h-9 rounded-full bg-white/[0.09] text-[#cfe3ff] hover:bg-white/[0.16] hover:text-white'

/**
 * Franja de marca a todo el ancho, encima del sidebar y del contenido.
 *
 * Antes esto era una tarjeta flotante dentro del sidebar y los cuatro botones
 * vivían dentro del dashboard de Ventas — o sea que en Estudiantes, Cursos o
 * Colegios no había ni marca arriba ni forma de refrescar. Al subirlos aquí
 * están en todas las pantallas del área, y en celular (donde el sidebar no
 * existe) aparece por primera vez la marca.
 */
export function Header() {
  return (
    <header
      style={{ background: RAIL_BG }}
      className="flex h-[60px] flex-shrink-0 items-center justify-between gap-4 px-3 md:px-4"
    >
      <Link href="/inicio" className="flex min-w-0 items-center gap-2.5" title="Volver al inicio">
        <Image
          src="/logo-grupo500.png"
          alt="Grupo 500"
          width={40}
          height={40}
          priority
          className="h-9 w-9 flex-shrink-0 rounded-full object-cover md:h-10 md:w-10"
        />
        <span className="min-w-0">
          <span className="block text-[13.5px] font-bold leading-none tracking-tight text-white">Grupo 500</span>
          <span className="mt-0.5 block text-[10.5px] font-medium leading-none text-slate-400">Pre-ICFES</span>
        </span>
      </Link>

      <div className="flex flex-shrink-0 items-center gap-2">
        {/* En celular el menú de abajo ya lleva a todos los módulos, así que
            el atajo a inicio sobra y se queda el espacio para lo demás. */}
        <Link
          href="/inicio"
          title="Volver al inicio"
          className={`hidden md:flex items-center justify-center transition-colors ${BOTON}`}
        >
          <Home className="h-4 w-4" />
        </Link>
        <NotificacionesButton className={BOTON} />
        <ThemeToggle className={BOTON} />
        <RefreshButton className={BOTON} />
      </div>
    </header>
  )
}
