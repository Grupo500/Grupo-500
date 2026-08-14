/**
 * Quién es quién, en un solo sitio.
 *
 * Antes cada muro de acceso, el sidebar, el menú de abajo y la pantalla de
 * usuarios repetían la lista de roles a mano —catorce copias entre las dos
 * mitades del proyecto— y sumar un rol obligaba a acordarse de todas. Espeja
 * `api/src/utils/roles.ts`; si allá se agrega uno, aquí también.
 */

export type Rol =
  | 'ADMIN' | 'VENDEDOR'
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
  VENDEDOR:      'Vendedor',
  MARKETING:     'Marketing',
  EDITOR:        'Editor de video',
  COMMUNITY:     'Community manager',
  LIDER_EDICION: 'Líder de edición',
  SOCIAL_MEDIA:  'Social media manager',
  LIDER_DISENO:  'Líder de diseño gráfico',
}

/** Opciones para los selectores de rol, en el orden en que se asignan. */
export const OPCIONES_ROL = (Object.keys(ROL_LABEL) as Exclude<Rol, 'ESTUDIANTE'>[])
  .map(value => ({ value, label: ROL_LABEL[value] }))
