import { prisma } from '@/lib/prisma'

// Los cuatro papeles del módulo, que no son los mismos que los roles de la app:
//
//   persona       registra lo suyo y ve su propia quincena
//   líder         aprueba, rechaza, corrige valores y envía la quincena de SU área
//   contabilidad  todo lo anterior en todas las áreas, más pagos y exportaciones
//   cofundador    exactamente lo mismo que contabilidad, y además el ranking
//
// El rol de la app dice si alguien es contabilidad o cofundador; ser líder no
// es un rol sino una relación con un departamento (`contab_lideres`), porque
// una misma persona lidera un área y es simple integrante en otra.

/** Contabilidad y cofundador escriben exactamente igual. */
export function esContabilidad(role?: string | null): boolean {
  return role === 'ADMIN' || role === 'COFUNDADOR'
}

/** Lo único reservado al cofundador es ver el ranking de ingresos. */
export function esCofundador(role?: string | null): boolean {
  return role === 'COFUNDADOR'
}

/** Roles que trabajan dentro del área de Marketing. */
export function esDelArea(role?: string | null): boolean {
  return !!role && [
    'ADMIN', 'COFUNDADOR', 'MARKETING', 'EDITOR', 'COMMUNITY',
    'LIDER_EDICION', 'LIDER_DISENO', 'SOCIAL_MEDIA',
  ].includes(role)
}

export async function esLiderDe(email: string, deptId: string): Promise<boolean> {
  if (!email) return false
  const lider = await prisma.contabLider.findUnique({
    where: { deptId_email: { deptId, email } },
  })
  return !!lider
}

/** Departamentos que lidera alguien, para saber qué puede tocar. */
export async function departamentosQueLidera(email: string): Promise<string[]> {
  if (!email) return []
  const filas = await prisma.contabLider.findMany({ where: { email }, select: { deptId: true } })
  return filas.map(f => f.deptId)
}

/** Quien manda sobre un departamento: contabilidad, o su líder. */
export async function puedeAprobarEn(
  sesion: { role: string; email: string },
  deptId: string,
): Promise<boolean> {
  return esContabilidad(sesion.role) || await esLiderDe(sesion.email, deptId)
}
