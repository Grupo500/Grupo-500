/**
 * Quién es quién, en un solo sitio.
 *
 * Antes cada muro de acceso, el sidebar, el menú de abajo y la pantalla de
 * usuarios repetían la lista de roles a mano —catorce copias entre las dos
 * mitades del proyecto— y sumar un rol obligaba a acordarse de todas. Espeja
 * `api/src/utils/roles.ts`; si allá se agrega uno, aquí también.
 */

export type Rol =
  | 'ADMIN' | 'COFUNDADOR' | 'VENDEDOR'
  | 'MARKETING' | 'EDITOR' | 'COMMUNITY'
  | 'LIDER_EDICION' | 'SOCIAL_MEDIA' | 'LIDER_DISENO'
  | 'ESTUDIANTE'

/** Entran al área de Marketing y a nada más. */
export const ROLES_MARKETING: Rol[] = [
  'MARKETING', 'EDITOR', 'COMMUNITY', 'LIDER_EDICION', 'SOCIAL_MEDIA', 'LIDER_DISENO',
]

/** Ven los cobros de todo el equipo y son quienes los aprueban. */
export const LIDERES_MARKETING: Rol[] = ['ADMIN', 'LIDER_EDICION']

export const esMarketing = (r?: string | null) => ROLES_MARKETING.includes(r as Rol)
export const esLiderMarketing = (r?: string | null) => LIDERES_MARKETING.includes(r as Rol)

/** Cómo se llama cada rol en pantalla. */
export const ROL_LABEL: Record<Exclude<Rol, 'ESTUDIANTE'>, string> = {
  ADMIN:         'Administrador',
  COFUNDADOR:    'Cofundador',
  VENDEDOR:      'Asesor',
  MARKETING:     'Marketing',
  EDITOR:        'Editor de video',
  COMMUNITY:     'Community manager',
  LIDER_EDICION: 'Líder de edición',
  SOCIAL_MEDIA:  'Social media manager',
  LIDER_DISENO:  'Líder de diseño gráfico',
}

/**
 * Opciones para los selectores de rol, en el orden en que se asignan.
 *
 * MARKETING queda fuera a propósito: nació como el rol genérico del área,
 * antes de que existieran los cinco oficios, y hoy no describe el trabajo de
 * nadie. Sigue en `ROL_LABEL` —y en el enum de la base— por si quedara alguna
 * cuenta vieja: así se muestra con nombre en vez de aparecer en blanco.
 */
const ASIGNABLES: Exclude<Rol, 'ESTUDIANTE' | 'MARKETING'>[] = [
  'ADMIN', 'COFUNDADOR', 'VENDEDOR',
  'EDITOR', 'COMMUNITY', 'LIDER_EDICION', 'SOCIAL_MEDIA', 'LIDER_DISENO',
]

export const OPCIONES_ROL = ASIGNABLES.map(value => ({ value, label: ROL_LABEL[value] }))
