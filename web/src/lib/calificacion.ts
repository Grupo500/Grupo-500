// ============================================================
// Calificación ponderada tipo ICFES (Prueba Saber 11)
//
// - Cada área se puntúa de 0 a 100 = (aciertos / total) × 100.
//   (El ICFES real usa un modelo estadístico privado —IRT— no público;
//    esta es la aproximación estándar de los simulacros.)
// - Puntaje Global de 0 a 500 = promedio ponderado de las áreas × 5,
//   con los pesos oficiales del ICFES:
//     Lectura Crítica ×3 · Matemáticas ×3 · Sociales ×3 · Ciencias ×3 · Inglés ×1
// ============================================================

export const PESOS: Record<string, number> = {
  "Lectura Crítica": 3,
  Matemáticas: 3,
  "Sociales y Ciudadanas": 3,
  "Ciencias Naturales": 3,
  Inglés: 1,
}

export type Pregunta = {
  id: number
  area: string
  correcta: string // 'A'|'B'|'C'|'D'
}

export type ResultadoArea = {
  area: string
  correctas: number
  total: number
  puntaje: number // 0–100
}

export type Resultado = {
  porArea: ResultadoArea[]
  correctasTotal: number
  total: number
  global: number // 0–500
}

// respuestas: { [idPregunta]: "A" }
export function calificar(
  preguntas: Pregunta[],
  respuestas: Record<string, string>
): Resultado {
  const acc: Record<string, { c: number; t: number }> = {}
  let correctasTotal = 0

  for (const p of preguntas) {
    const a = (acc[p.area] ??= { c: 0, t: 0 })
    a.t += 1
    if (respuestas[String(p.id)] === p.correcta) {
      a.c += 1
      correctasTotal += 1
    }
  }

  const porArea: ResultadoArea[] = Object.entries(acc).map(([area, v]) => ({
    area,
    correctas: v.c,
    total: v.t,
    puntaje: v.t > 0 ? Math.round((v.c / v.t) * 100) : 0,
  }))

  let sumaPond = 0
  let sumaPesos = 0
  for (const a of porArea) {
    const peso = PESOS[a.area] ?? 1
    sumaPond += a.puntaje * peso
    sumaPesos += peso
  }
  const global = sumaPesos > 0 ? Math.round((sumaPond / sumaPesos) * 5) : 0

  return {
    porArea,
    correctasTotal,
    total: preguntas.length,
    global,
  }
}
