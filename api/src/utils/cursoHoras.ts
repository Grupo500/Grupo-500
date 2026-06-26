// Calcula la duración en horas de un curso a partir de su nombre.
// Regla de negocio Grupo 500:
//   · Calendario           → 310 h
//   · Intensivo            → 40 h
//   · Combos (A + B)       → suma de sus partes
//   · Año 500              → 2 calendarios + 1 intensivo = 660 h
//   · Premédico            → 100 h
//   · Desconocido / test   → 0 h
export function horasPorNombreCurso(nombre: string): number {
  const n = (nombre ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar acentos (AÑO → ANO)
    .toLowerCase()

  if (n.includes('premedico') || n.includes('med500')) return 100
  if (n.includes('ano 500')) return 660 // 310 + 310 + 40

  // Combos: varios productos unidos con "+"
  if (n.includes('+') || n.includes('combo')) {
    let total = 0
    for (const parte of n.split('+')) {
      if (parte.includes('intensivo')) total += 40
      else if (parte.includes('calendario')) total += 310
    }
    if (total > 0) return total
  }

  // Producto único — intensivo se evalúa primero porque su nombre suele
  // incluir también la palabra "calendario" (ej. "Intensivo Calendario A").
  if (n.includes('intensivo')) return 40
  if (n.includes('calendario')) return 310

  return 0
}
