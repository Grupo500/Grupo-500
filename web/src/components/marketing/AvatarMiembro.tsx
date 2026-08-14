'use client'

import { cn } from '@/lib/utils'

/**
 * El avatar de una persona de marketing, en un solo sitio.
 *
 * Cada pantalla lo dibujaba por su cuenta con las iniciales sobre un color, así
 * que la foto de Google —que la app ya guarda al entrar— no salía en ninguna.
 * Aquí manda la foto y las iniciales son el respaldo, no al revés.
 */

// El color se deriva del id para que cada persona conserve siempre el mismo,
// sin guardarlo en la base ni depender del orden de la lista.
const COLORES = ['#2094ff', '#7c3aed', '#db2777', '#0891b2', '#ca8a04', '#059669']
export function colorAvatar(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return COLORES[h % COLORES.length]
}

export function iniciales(n: string) {
  return n.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

export function AvatarMiembro({ id, nombre, image, size = 24, className }: {
  id: string
  nombre: string
  image?: string | null
  /** Lado en píxeles. La letra se escala con él para que nunca se desborde. */
  size?: number
  className?: string
}) {
  return (
    <span
      title={nombre}
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded-full font-bold text-white',
        className,
      )}
      style={{
        width: size, height: size,
        fontSize: Math.max(7, Math.round(size * 0.42)),
        background: image ? 'transparent' : colorAvatar(id),
      }}
    >
      {image
        // Google sirve las fotos sin referer; sin esto salen rotas.
        ? <img src={image} alt={nombre} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        : iniciales(nombre)}
    </span>
  )
}
