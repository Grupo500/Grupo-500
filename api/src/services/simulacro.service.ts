/**
 * Servicio de parseo de PDFs de simulacros pre-ICFES
 *
 * Soporta dos formatos de PDF:
 *
 * FORMATO 1 — Bloque por estudiante (un registro por sección):
 * ─────────────────────────────────────────────────────────────
 *   Nombre: Juan García Martínez
 *   Documento: 1000123456
 *   Lectura Crítica: 65
 *   Matemáticas: 58
 *   Ciencias Naturales: 71
 *   Sociales y Ciudadanas: 63
 *   Inglés: 55
 *
 * FORMATO 2 — Tabla (fila por estudiante):
 * ─────────────────────────────────────────────────────────────
 *   Nombre | LC | MAT | CN | SC | ING
 *   Juan García | 65 | 58 | 71 | 63 | 55
 *   María López | 72 | 80 | 68 | 74 | 61
 *
 * Reglas de clasificación (basadas en puntaje global sobre 500):
 *   BAJO  < 250   →  puede requerir intensivo
 *   MEDIO 250–349
 *   ALTO  ≥ 350
 */

async function parsePdf(buffer: Buffer): Promise<{ text: string }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFParser = require('pdf2json')
  return new Promise((resolve, reject) => {
    const parser = new PDFParser()
    parser.on('pdfParser_dataError', (err: any) => reject(new Error(err?.parserError ?? 'Error parsing PDF')))
    parser.on('pdfParser_dataReady', (data: any) => {
      // Extraer texto plano de todas las páginas
      const text = (data?.Pages ?? [])
        .flatMap((page: any) => page?.Texts ?? [])
        .map((t: any) => decodeURIComponent(t?.R?.[0]?.T ?? ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      resolve({ text })
    })
    parser.parseBuffer(buffer)
  })
}
import { prisma } from '../config/prisma'

export interface ResultadoEstudiante {
  nombre: string
  documento?: string
  areas: Record<string, number>    // Ej: { 'Lectura Crítica': 65, 'Matemáticas': 58 }
  puntajeTotal: number
  porcentajeAciertos: number       // puntajeTotal / 500 * 100
  areasDebiles: string[]
  estado: 'BAJO' | 'MEDIO' | 'ALTO'
  requiereIntensivo: boolean
  estudianteId?: string            // match en DB
}

// ── Áreas del ICFES y sus variantes de nombre ──────────────────────────────
const AREA_ALIASES: { nombre: string; alias: RegExp }[] = [
  { nombre: 'Lectura Crítica',         alias: /lectura\s*cr[ií]tica|lc/i          },
  { nombre: 'Matemáticas',             alias: /matem[áa]ticas?|mat/i              },
  { nombre: 'Ciencias Naturales',      alias: /ciencias\s*naturales?|cn/i         },
  { nombre: 'Sociales y Ciudadanas',   alias: /sociales(\s*y\s*ciudadanas?)?|sc/i },
  { nombre: 'Inglés',                  alias: /ingl[eé]s|ing/i                    },
]

function normalizarArea(raw: string): string {
  for (const { nombre, alias } of AREA_ALIASES) {
    if (alias.test(raw.trim())) return nombre
  }
  return raw.trim()
}

function clasificar(puntaje: number): 'BAJO' | 'MEDIO' | 'ALTO' {
  if (puntaje >= 350) return 'ALTO'
  if (puntaje >= 250) return 'MEDIO'
  return 'BAJO'
}

function calcularAreasDebiles(areas: Record<string, number>): string[] {
  // Umbral: área con puntaje < 50 sobre 100 se considera débil
  return Object.entries(areas)
    .filter(([, v]) => v < 50)
    .map(([k]) => k)
}

// ── Parser formato bloque ──────────────────────────────────────────────────
function parsearFormatoBloque(texto: string): ResultadoEstudiante[] {
  const resultados: ResultadoEstudiante[] = []

  // Dividir por bloques que empiecen con "Nombre:"
  const bloques = texto.split(/(?=nombre\s*:)/i).filter(b => /nombre\s*:/i.test(b))

  for (const bloque of bloques) {
    const lineas = bloque.split('\n').map(l => l.trim()).filter(Boolean)
    let nombre   = ''
    let documento = ''
    const areas: Record<string, number> = {}

    for (const linea of lineas) {
      const [clave, ...resto] = linea.split(':')
      const valor = resto.join(':').trim()

      if (/nombre/i.test(clave))     { nombre    = valor; continue }
      if (/documento|cc|id/i.test(clave)) { documento = valor; continue }

      // Intentar mapear como área
      const areaNorm = normalizarArea(clave)
      const num      = parseFloat(valor.replace(',', '.'))
      if (!isNaN(num) && AREA_ALIASES.some(a => a.nombre === areaNorm)) {
        areas[areaNorm] = num
      }
    }

    if (!nombre || Object.keys(areas).length === 0) continue

    const puntajeTotal        = Object.values(areas).reduce((s, v) => s + v, 0)
    const porcentajeAciertos  = Math.round((puntajeTotal / (Object.keys(areas).length * 100)) * 100)
    const areasDebiles        = calcularAreasDebiles(areas)
    const estado              = clasificar(puntajeTotal)

    resultados.push({
      nombre,
      documento,
      areas,
      puntajeTotal,
      porcentajeAciertos,
      areasDebiles,
      estado,
      requiereIntensivo: estado === 'BAJO',
    })
  }

  return resultados
}

// ── Parser formato tabla ───────────────────────────────────────────────────
function parsearFormatoTabla(texto: string): ResultadoEstudiante[] {
  const resultados: ResultadoEstudiante[] = []
  const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean)

  // Detectar fila de encabezados (contiene palabras de áreas ICFES)
  let headerIdx = -1
  let headers:  string[] = []

  for (let i = 0; i < lineas.length; i++) {
    const partes = lineas[i].split(/[|\t;,]/).map(p => p.trim())
    const tieneArea = partes.some(p => AREA_ALIASES.some(a => a.alias.test(p)))
    if (tieneArea && partes.length >= 3) {
      headerIdx = i
      headers   = partes
      break
    }
  }

  if (headerIdx === -1) return []

  // Mapear índice de columna → nombre de área
  const colMap: Record<number, string> = {}
  let nombreCol = 0
  let docCol    = -1

  headers.forEach((h, i) => {
    if (/nombre/i.test(h))         { nombreCol = i; return }
    if (/documento|cc|id/i.test(h)) { docCol   = i; return }
    const areaNorm = normalizarArea(h)
    if (AREA_ALIASES.some(a => a.nombre === areaNorm)) colMap[i] = areaNorm
  })

  // Leer filas de datos
  for (let i = headerIdx + 1; i < lineas.length; i++) {
    const partes = lineas[i].split(/[|\t;,]/).map(p => p.trim())
    if (partes.length < 3) continue

    const nombre   = partes[nombreCol] ?? ''
    const documento = docCol >= 0 ? (partes[docCol] ?? '') : ''
    if (!nombre || /nombre/i.test(nombre)) continue

    const areas: Record<string, number> = {}
    for (const [idxStr, areaNombre] of Object.entries(colMap)) {
      const idx = Number(idxStr)
      const num = parseFloat((partes[idx] ?? '').replace(',', '.'))
      if (!isNaN(num)) areas[areaNombre] = num
    }

    if (Object.keys(areas).length === 0) continue

    const puntajeTotal       = Object.values(areas).reduce((s, v) => s + v, 0)
    const porcentajeAciertos = Math.round((puntajeTotal / (Object.keys(areas).length * 100)) * 100)
    const areasDebiles       = calcularAreasDebiles(areas)
    const estado             = clasificar(puntajeTotal)

    resultados.push({
      nombre,
      documento,
      areas,
      puntajeTotal,
      porcentajeAciertos,
      areasDebiles,
      estado,
      requiereIntensivo: estado === 'BAJO',
    })
  }

  return resultados
}

// ── Extractor principal ────────────────────────────────────────────────────
export async function extraerResultadosDePDF(buffer: Buffer): Promise<ResultadoEstudiante[]> {
  const { text } = await parsePdf(buffer)

  let resultados = parsearFormatoBloque(text)
  if (resultados.length === 0) resultados = parsearFormatoTabla(text)

  return resultados
}

// ── Matching de nombres contra DB ──────────────────────────────────────────
function similitud(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.9
  const wordsA = new Set(na.split(/\s+/))
  const wordsB = new Set(nb.split(/\s+/))
  const intersect = [...wordsA].filter(w => wordsB.has(w)).length
  return intersect / Math.max(wordsA.size, wordsB.size)
}

export async function matchearConDB(
  resultados: ResultadoEstudiante[],
): Promise<ResultadoEstudiante[]> {
  const estudiantes = await prisma.estudiante.findMany({
    select: { id: true, nombre: true, documento: true },
  })

  return resultados.map(r => {
    // 1. Match exacto por número de documento (más confiable)
    if (r.documento) {
      const docLimpio = r.documento.replace(/\D/g, '')
      const porDoc = estudiantes.find(
        e => e.documento && e.documento.replace(/\D/g, '') === docLimpio,
      )
      if (porDoc) return { ...r, estudianteId: porDoc.id }
    }

    // 2. Fallback: similitud de nombre (umbral 0.7)
    let mejor: { id: string; score: number } | null = null
    for (const e of estudiantes) {
      const score = similitud(r.nombre, e.nombre)
      if (score > 0.7 && (!mejor || score > mejor.score)) {
        mejor = { id: e.id, score }
      }
    }
    return mejor ? { ...r, estudianteId: mejor.id } : r
  })
}
