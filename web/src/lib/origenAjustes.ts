'use client'

/**
 * De dónde se entró a Ajustes.
 *
 * Ajustes no es un área: es una pantalla que se abre desde cualquiera. Antes
 * el sidebar cambiaba al entrar y "volver" llevaba a Ventas aunque se viniera
 * de Marketing (Hotman, 22-ago). Ahora el sidebar y la barra de abajo siguen
 * mostrando el área de origen, y "Volver" regresa exactamente a donde se
 * estaba. Se guarda en sessionStorage: sobrevive a recargar y muere con la
 * pestaña, que es justo la vida que tiene "de dónde vengo".
 */

import { useEffect, useState } from 'react'
import type { Rol } from '@/lib/roles'

const CLAVE = 'ajustes:origen'

export function recordarOrigen(pathname: string) {
  if (typeof window === 'undefined') return
  if (pathname === '/ajustes' || pathname.startsWith('/ajustes/')) return
  try { window.sessionStorage.setItem(CLAVE, pathname) } catch { /* modo privado sin storage */ }
}

export function leerOrigen(): string | null {
  if (typeof window === 'undefined') return null
  try { return window.sessionStorage.getItem(CLAVE) } catch { return null }
}

/** A dónde ir si no se sabe de dónde se vino: la puerta natural de cada rol. */
export function origenPorDefecto(role?: Rol | string): string {
  return role === 'ADMIN' || role === 'VENDEDOR' ? '/dashboard' : '/inicio'
}

/** El origen, ya resuelto en el navegador (null en el primer render del servidor). */
export function useOrigenAjustes(role?: Rol | string): string {
  const [origen, setOrigen] = useState<string | null>(null)
  useEffect(() => { setOrigen(leerOrigen()) }, [])
  return origen ?? origenPorDefecto(role)
}
