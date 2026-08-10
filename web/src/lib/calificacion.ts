// ============================================================
// Calificación ponderada tipo ICFES (Prueba Saber 11)
//
// - Puntaje base por área: 0 a 100 = (aciertos / total) × 100, redondeado.
// - Ajuste en cascada sobre el base (algoritmo confirmado por Grupo 500,
//   "Algoritmo de calificación — Plataforma de Simulacros", 2026-08):
//     · base == 100 → queda 100
//     · 11 ≤ base ≤ 99 → v1 = base − 10; si 85 ≤ v1 ≤ 89 → v1 − 4
//     · base ≤ 10 → queda igual
//   Efecto neto: 100→100 · 95–99→base−14 · 11–94→base−10 · 0–10→base.
// - Puntaje Global de 0 a 500 = promedio ponderado de las áreas YA ajustadas × 5,
//   con los pesos oficiales del ICFES (denominador 13 = 3+3+3+3+1):
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

// Ajuste en cascada sobre el puntaje base de una materia (ver cabecera).
export function ajustarPuntajeMateria(base: number): number {
  if (base === 100) return 100
  if (base >= 11) {
    const v1 = base - 10
    return v1 >= 85 && v1 <= 89 ? v1 - 4 : v1
  }
  return base
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
    puntaje: v.t > 0 ? ajustarPuntajeMateria(Math.round((v.c / v.t) * 100)) : 0,
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
