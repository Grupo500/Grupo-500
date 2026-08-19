import type { Role } from '@prisma/client'

/**
 * Quién es quién, en un solo sitio.
 *
 * Antes cada ruta y cada pantalla repetía la lista de roles a mano —había
 * catorce copias— y sumar uno nuevo obligaba a acordarse de todas. Con esto,
 * agregar un rol de marketing es una línea en `MARKETING`.
 */

/** Entran al área de Marketing y a nada más. */
export const MARKETING: Role[] = [
  'MARKETING', 'EDITOR', 'COMMUNITY', 'LIDER_EDICION', 'SOCIAL_MEDIA', 'LIDER_DISENO',
]

/**
 * Ven los cobros de todo el equipo y pueden aprobarlos. El resto solo ve los
 * suyos: lo que cobra un editor no es asunto de los demás editores.
 */
export const LIDERES_MARKETING: Role[] = ['ADMIN', 'COFUNDADOR', 'LIDER_EDICION']

/** Operan el área de Ventas. */
export const VENTAS: Role[] = ['ADMIN', 'VENDEDOR']

export const esMarketing = (r?: string): boolean => MARKETING.includes(r as Role)
export const esLiderMarketing = (r?: string): boolean => LIDERES_MARKETING.includes(r as Role)

/** Todos los roles que puede tener una cuenta de trabajo (no estudiantes). */
export type RolTrabajo = Role
export const TODOS: RolTrabajo[] = ['ADMIN', 'COFUNDADOR', 'VENDEDOR', ...MARKETING]
