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
