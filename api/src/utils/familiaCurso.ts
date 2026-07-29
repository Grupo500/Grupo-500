// Línea de producto a la que pertenece un curso.
//
// Se usa para agrupar en reportes: 23 cursos con nombres largos y parecidos son
// ilegibles en una gráfica, seis familias no.

export const FAMILIAS = [
  'Intensivo',
  'Calendario',
  'Combo',
  'Año 500',
  'Premédico',
  'Ruta 500',
  'Otros',
] as const

export type Familia = (typeof FAMILIAS)[number]

/**
 * Deduce la familia a partir del nombre. Solo se usa para sembrar el campo la
 * primera vez y al crear cursos automáticamente desde Hotmart; una vez
 * guardado, manda el campo.
 *
 * El orden importa: "Combo | Ruta 500 + Calendario G" es un combo, no un
 * Ruta 500, así que los prefijos compuestos se evalúan antes.
 */
export function familiaDesdeNombre(nombre: string): Familia {
  const n = nombre.toLowerCase().trim()
  if (n.startsWith('combo')) return 'Combo'
  if (n.startsWith('año 500') || n.startsWith('ano 500')) return 'Año 500'
  if (n.includes('premédico') || n.includes('premedico') || n.includes('med500')) return 'Premédico'
  if (n.includes('ruta 500')) return 'Ruta 500'
  if (n.includes('intensivo')) return 'Intensivo'
  if (n.includes('calendario')) return 'Calendario'
  return 'Otros'
}
