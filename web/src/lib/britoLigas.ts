// Catálogo de ligas de Brito. Son fijas y no se editan desde el panel, así que
// viven como constante igual que MATERIAS en el mapa.

export const LIGAS = [
  { nivel: 0, nombre: 'Aprendiz', color: '#B87333', icono: '/brito/ligas/aprendiz.png' },
  { nivel: 1, nombre: 'Explorador', color: '#8E9BA8', icono: '/brito/ligas/explorador.png' },
  { nivel: 2, nombre: 'Analista', color: '#F5A623', icono: '/brito/ligas/analista.png' },
  { nivel: 3, nombre: 'Estratega', color: '#1E5FA8', icono: '/brito/ligas/estratega.png' },
  { nivel: 4, nombre: 'Cerebrito', color: '#7C6FDB', icono: '/brito/ligas/cerebrito.png' },
] as const

export const LIGA_MAX = LIGAS.length - 1
export const TAM_GRUPO = 30
export const CUPOS_ASCENSO = 7
export const CUPOS_DESCENSO = 5
export const SEMANAS_INACTIVAS_PARA_DESCENDER = 2

export function ligaDe(nivel: number) {
  return LIGAS[Math.min(Math.max(nivel, 0), LIGA_MAX)]
}

// La semana corre de lunes a domingo en hora de Colombia (UTC-5, sin horario
// de verano), no en la del servidor. Se trabaja sobre una fecha "desplazada"
// para poder usar los getters UTC sin depender del huso del proceso.
const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000

function aBogota(fecha: Date): Date {
  return new Date(fecha.getTime() - OFFSET_BOGOTA_MS)
}

/** Clave ISO de la semana, tipo "2026-W31". */
export function semanaDe(fecha: Date = new Date()): string {
  const d = aBogota(fecha)
  // Jueves de la misma semana ISO: define a qué año pertenece la semana.
  const diaISO = (d.getUTCDay() + 6) % 7
  const jueves = new Date(d.getTime())
  jueves.setUTCDate(jueves.getUTCDate() - diaISO + 3)

  const primerJueves = new Date(Date.UTC(jueves.getUTCFullYear(), 0, 4))
  const diaISOPrimero = (primerJueves.getUTCDay() + 6) % 7
  primerJueves.setUTCDate(primerJueves.getUTCDate() - diaISOPrimero + 3)

  const semana = 1 + Math.round((jueves.getTime() - primerJueves.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return `${jueves.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`
}

/** Cuántos días completos faltan para que cierre la semana en curso. */
export function diasRestantesSemana(fecha: Date = new Date()): number {
  const d = aBogota(fecha)
  const diaISO = (d.getUTCDay() + 6) % 7
  const finSemana = new Date(d.getTime())
  finSemana.setUTCDate(finSemana.getUTCDate() + (6 - diaISO))
  finSemana.setUTCHours(23, 59, 59, 999)
  return Math.max(0, Math.ceil((finSemana.getTime() - d.getTime()) / (24 * 60 * 60 * 1000)))
}
