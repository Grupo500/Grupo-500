import { esLiderMarketing } from '@/lib/roles'
import type { Contenido, Miembro } from '@/components/marketing/CalendarioMarketing'

/** Quién reparte trabajo: ve además lo que asignó, para poder revisarlo. */
export const PUEDE_ASIGNAR = ['ADMIN', 'COMMUNITY', 'SOCIAL_MEDIA', 'LIDER_EDICION', 'LIDER_DISENO']
export const puedeAsignar = (rol?: string | null) => PUEDE_ASIGNAR.includes(rol ?? '')

/**
 * Qué contenido le toca ver a quien está mirando la pantalla.
 *
 * La regla de verdad vive en el backend (`filtroVisibilidad`), que es lo único
 * que impide que los datos ajenos salgan del servidor. Esta copia existe
 * porque la misma regla tiene que aplicarse en la pantalla el día que el
 * servidor todavía responda con la versión anterior — pasó el 20-ago, con los
 * despliegues de Railway pausados por un incidente de su proveedor, y el
 * equipo viendo el trabajo de todos.
 *
 * Cuando el backend ya filtra, esto no descarta nada: filtrar dos veces lo
 * mismo no cambia el resultado.
 */
export function visiblesPara(
  contenidos: Contenido[],
  opciones: { rol?: string | null; userId?: string | null; miembros: Miembro[] },
): Contenido[] {
  const { rol, userId, miembros } = opciones

  // Los administradores y la jefa de marketing ven todo.
  if (esLiderMarketing(rol)) return contenidos

  const miMiembroId = miembros.find(m => m.userId && m.userId === userId)?.id
  // Sin ficha de marketing no hay trabajo propio que mostrar. Ante la duda,
  // nada: es preferible una pantalla vacía a enseñar lo que no le toca.
  if (!miMiembroId) return puedeAsignar(rol) ? contenidos.filter(c => c.asignadoPorId === userId) : []

  return contenidos.filter(c =>
    c.asignadoA?.id === miMiembroId ||
    (puedeAsignar(rol) && c.asignadoPorId === userId),
  )
}
