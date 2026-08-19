// Utilidades del módulo Contabilidad (área de Marketing).
// Una "quincena" se identifica como "2026-08-Q1" (día 1–15) o "Q2" (16–fin),
// igual que en la app original de pagos de agencia.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function quincenaActual(hoy = new Date()): string {
  const y = hoy.getFullYear()
  const m = String(hoy.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-${hoy.getDate() <= 15 ? 'Q1' : 'Q2'}`
}

export function etiquetaQuincena(id: string): string {
  const m = id.match(/^(\d{4})-(\d{2})-Q([12])$/)
  if (!m) return id
  return `${m[3]}.ª quincena · ${MESES[Number(m[2]) - 1]} ${m[1]}`
}

/** Fecha corta al estilo de la app original: "18 de ago." */
export function fechaCorta(hoy = new Date()): string {
  return `${hoy.getDate()} de ${MESES_CORTOS[hoy.getMonth()]}.`
}

/** Quincenas a ofrecer: las que tienen datos + la actual, ordenadas descendente. */
export function listaQuincenas(conDatos: string[], actual = quincenaActual()): string[] {
  return [...new Set([actual, ...conDatos])].sort().reverse()
}

export const cop = (v: number) => `$${Math.round(v).toLocaleString('es-CO')}`

export type EstadoRegistro = 'Realizado' | 'Rechazado' | 'Aprobado' | 'Pendiente'
export function estadoRegistro(r: { pagado: boolean; rechazado: boolean; aprobado: boolean }): EstadoRegistro {
  if (r.pagado) return 'Realizado'
  if (r.rechazado) return 'Rechazado'
  if (r.aprobado) return 'Aprobado'
  return 'Pendiente'
}

/** Iniciales para el avatar de una persona sin foto. */
export function iniciales(nombre: string): string {
  return nombre.split(/\s+/).slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase()
}

// ── Identidad de una persona entre departamentos ────────────────────────────
// Hay gente que trabaja en tres áreas a la vez y tiene una fila de
// `contab_personas` en cada una (los nombres repetidos son a propósito: es la
// misma persona en otra área). En el detalle de un departamento se ve por
// separado; para el resumen y la búsqueda hay que unificarla, y lo único que
// las une es el nombre. Por eso se compara normalizado: sin tildes, sin
// mayúsculas y sin espacios de más, que es donde difieren en la práctica.

/** Clave con la que se decide que dos filas son la misma persona. */
export function claveNombre(nombre: string): string {
  return nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/\s+/g, ' ')
}

/** La misma clave, apta para una URL: "Sara Reyes" → "sara-reyes". */
export function slugNombre(nombre: string): string {
  return claveNombre(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** Mes al que pertenece una quincena: "2026-08-Q1" → "2026-08". */
export function mesDeQuincena(quincena: string): string {
  return quincena.slice(0, 7)
}

/** Etiqueta de un mes: "2026-08" → "agosto 2026". */
export function etiquetaMes(mes: string): string {
  const m = mes.match(/^(\d{4})-(\d{2})$/)
  if (!m) return mes
  return `${MESES[Number(m[2]) - 1]} ${m[1]}`
}
