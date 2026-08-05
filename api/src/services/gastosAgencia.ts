// Gastos de la agencia: lectura del Google Sheet de contabilidad interna.
//
// Solo lectura y servidor contra servidor. El sheet se publica por link, así que
// no hay OAuth: se descarga el CSV de cada pestaña y se normaliza aquí.
//
// El identificador del sheet va en `GASTOS_AGENCIA_SHEET_ID` y NO se hardcodea:
// este repositorio es público y el sheet contiene cédulas y números de cuenta.
//
// PII: la cédula no sale de este archivo y de la cuenta bancaria solo se
// devuelven los últimos 4 dígitos. Lo que no se serializa no se puede filtrar.

import { logger } from '../utils/logger'
import { leerPestania, sheetsEscrituraConfigurada } from './googleSheets'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const

/** gid de cada pestaña; se pueden sobreescribir por entorno si el sheet cambia. */
export const GIDS = {
  nomina: process.env.GASTOS_AGENCIA_GID_NOMINA ?? '0',
  actual: process.env.GASTOS_AGENCIA_GID_ACTUAL ?? '1489175693',
  previo: process.env.GASTOS_AGENCIA_GID_PREVIO ?? '1461721508',
  cuentas: process.env.GASTOS_AGENCIA_GID_CUENTAS ?? '58985148',
}

const TTL_MS = 5 * 60 * 1000

export interface CategoriaAnual {
  nombre: string
  clave: string
  valores: (number | null)[]
}

export interface Anio {
  anio: number
  /** Pestaña de donde salió; la necesita la escritura para ubicar la celda. */
  gid: string
  meses: string[]
  categorias: CategoriaAnual[]
  totalPorMes: (number | null)[]
  totalAnio: number
  promedioMesesActivos: number
  mesesConDato: number[]
  descuadre: { mes: string; sheet: number; suma: number }[]
}

export interface PersonaNomina {
  nombre: string
  banco: string
  /** Solo los últimos 4 dígitos, del estilo "••••8227". */
  cuenta: string
  monto: number
  pagado: boolean
}

export interface GastosAgencia {
  leidoEn: string
  anios: Record<string, Anio>
  produccion: Record<string, { titulo: string; anio: string | null; tipos: CategoriaAnual[] }>
  tarifario: Record<string, { items: { concepto: string; valor: number; seccion: string | null }[]; total: number }>
  nomina: {
    corte: string
    personas: PersonaNomina[]
    resumen: {
      total: number
      pagados: number
      pendientes: number
      montoPagado: number
      montoPendiente: number
      pendientesSinMonto: number
    }
  }
  cuentas: { total: number; porBanco: { banco: string; cuentas: number }[] }
  avisos: string[]
}

export function gastosAgenciaConfigurado(): boolean {
  return Boolean(process.env.GASTOS_AGENCIA_SHEET_ID)
}

// ── utilidades de CSV ───────────────────────────────────────────────────

type Grid = string[][]

/** Parser tolerante: los montos vienen entrecomillados (" COP $1,075,000"). */
function parseCSV(text: string): Grid {
  const rows: Grid = []
  let row: string[] = []
  let cur = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++ } else quoted = false
      } else cur += c
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      row.push(cur); cur = ''
    } else if (c === '\n') {
      row.push(cur); rows.push(row); row = []; cur = ''
    } else if (c !== '\r') {
      cur += c
    }
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row) }
  return rows
}

export const at = (rows: Grid, r: number, c: number): string =>
  rows[r] && rows[r][c] != null ? String(rows[r][c]).trim() : ''

/** " COP $1,075,000" → 1075000 · "" → null */
export function money(v: string | null | undefined): number | null {
  if (v == null) return null
  const s = String(v).replace(/[^\d,.\-]/g, '').replace(/,/g, '')
  if (!s || s === '-' || s === '.') return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n) : null
}

export function num(v: string | null | undefined): number | null {
  if (v == null || String(v).trim() === '') return null
  const s = String(v).replace(/[^\d.\-]/g, '')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Nunca devuelve la cuenta completa. */
function enmascararCuenta(v: string): string {
  const d = String(v ?? '').replace(/\D/g, '')
  if (!d) return ''
  return d.length <= 4 ? '••••' : '••••' + d.slice(-4)
}

export function indiceMes(label: string): number {
  const s = String(label ?? '').trim().toLowerCase()
  if (!s) return -1
  return MESES.findIndex(m => s.startsWith(m))
}

export function buscarCelda(rows: Grid, needle: string): { r: number; c: number } | null {
  const n = needle.toLowerCase()
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || []
    for (let c = 0; c < row.length; c++) {
      if (String(row[c] ?? '').trim().toLowerCase().includes(n)) return { r, c }
    }
  }
  return null
}

/**
 * Clave canónica de categoría.
 *
 * El sheet las renombra entre años ("Salarios" en 2025 y "Salarios (se incluyen
 * bonos y extras)" en 2026); sin normalizar, la comparación año contra año no
 * empareja nada.
 */
export function claveCategoria(nombre: string): string {
  return String(nombre ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const suma = (xs: (number | null)[]): number => xs.reduce<number>((a, b) => a + (b || 0), 0)

export function sheetId(): string {
  const id = process.env.GASTOS_AGENCIA_SHEET_ID
  if (!id) throw new Error('GASTOS_AGENCIA_SHEET_ID no está configurado')
  return id
}

/**
 * Trae una pestaña como grilla.
 *
 * Con la cuenta de servicio configurada se lee por la API (que es además el
 * único camino que sigue funcionando si el sheet deja de estar público, y el
 * mismo que usa la escritura). Si no la hay, se cae al CSV público.
 */
export async function traerPestania(gid: string): Promise<Grid> {
  if (sheetsEscrituraConfigurada()) {
    return leerPestania(sheetId(), gid)
  }

  const url = `https://docs.google.com/spreadsheets/d/${sheetId()}/export?format=csv&gid=${gid}`
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`El sheet respondió ${res.status} en la pestaña gid=${gid}`)
  const text = await res.text()
  if (/<html/i.test(text.slice(0, 200))) {
    throw new Error('El sheet devolvió HTML: perdió el permiso de lectura por link y no hay cuenta de servicio configurada')
  }
  return parseCSV(text)
}

// ── contabilidad anual ──────────────────────────────────────────────────

/** Fila de encabezado = la primera con 6 o más nombres de mes. */
export function filaDeMeses(rows: Grid) {
  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const cols: { c: number; mi: number }[] = []
    ;(rows[r] || []).forEach((v, c) => {
      const mi = indiceMes(v)
      if (mi >= 0) cols.push({ c, mi })
    })
    if (cols.length >= 6) {
      const vistos = new Set<number>()
      const meses: { c: number; mi: number }[] = []
      for (const x of cols.sort((a, b) => a.c - b.c)) {
        if (vistos.has(x.mi)) continue
        vistos.add(x.mi)
        meses.push(x)
      }
      return { row: r, meses }
    }
  }
  return null
}

function parsearContabilidad(rows: Grid, anio: number, gid: string): Anio {
  const head = filaDeMeses(rows)
  if (!head) throw new Error(`No encontré la fila de meses en la contabilidad ${anio}`)

  const ultimaColMes = Math.max(...head.meses.map(m => m.c))
  const categorias: CategoriaAnual[] = []
  let filaTotal: number | null = null

  for (let r = head.row + 1; r < rows.length; r++) {
    const label = at(rows, r, 0)
    if (!label) {
      if (categorias.length) break
      continue
    }
    if (label.toLowerCase() === 'total') { filaTotal = r; break }

    const valores: (number | null)[] = MESES.map(() => null)
    let algo = false
    for (const { c, mi } of head.meses) {
      const v = money(at(rows, r, c))
      valores[mi] = v
      if (v != null) algo = true
    }
    if (!algo) continue
    categorias.push({ nombre: label, clave: claveCategoria(label), valores })
  }

  // Totales por mes: manda la fila Total del sheet. Hay meses (junio 2025) con
  // total pero sin ninguna categoría desglosada, y sumar categorías se comería
  // ese gasto.
  const totalSheet: (number | null)[] = MESES.map(() => null)
  if (filaTotal != null) {
    for (const { c, mi } of head.meses) totalSheet[mi] = money(at(rows, filaTotal, c))
  }
  const sumaCats: (number | null)[] = MESES.map((_, mi) => {
    const vals = categorias.map(k => k.valores[mi]).filter(v => v != null)
    return vals.length ? suma(vals) : null
  })

  const totalPorMes = MESES.map((_, i) => totalSheet[i] ?? sumaCats[i])
  const totalCalculado = suma(totalPorMes)
  const mesesConDato = MESES.map((_, i) => i).filter(i => (totalPorMes[i] || 0) > 0)

  let totalAnio: number | null = null
  if (filaTotal != null) {
    for (let c = ultimaColMes + 1; c < (rows[filaTotal] || []).length; c++) {
      const v = money(at(rows, filaTotal, c))
      if (v != null) { totalAnio = v; break }
    }
  }

  // Meses donde la fila Total del sheet no cuadra con la suma de sus categorías.
  const descuadre: { mes: string; sheet: number; suma: number }[] = []
  for (let i = 0; i < MESES.length; i++) {
    const t = totalSheet[i]
    const s = sumaCats[i]
    if (t != null && s != null && t !== s) descuadre.push({ mes: MESES[i], sheet: t, suma: s })
  }

  return {
    anio,
    gid,
    meses: [...MESES],
    categorias,
    totalPorMes,
    totalAnio: totalAnio ?? totalCalculado,
    promedioMesesActivos: mesesConDato.length ? Math.round(totalCalculado / mesesConDato.length) : 0,
    mesesConDato,
    descuadre,
  }
}

// ── producción de contenido (tablas dentro de la hoja del año actual) ────

function parsearProduccion(rows: Grid, etiqueta: string) {
  const hit = buscarCelda(rows, etiqueta)
  if (!hit) return null

  let filaHead = -1
  for (let r = hit.r; r < Math.min(hit.r + 4, rows.length); r++) {
    if (at(rows, r, hit.c).toLowerCase() === 'tipo') { filaHead = r; break }
  }
  if (filaHead < 0) return null

  const meses: { c: number; mi: number }[] = []
  const vistos = new Set<number>()
  ;(rows[filaHead] || []).forEach((v, c) => {
    if (c <= hit.c) return
    const mi = indiceMes(v)
    if (mi >= 0 && !vistos.has(mi)) { vistos.add(mi); meses.push({ c, mi }) }
  })
  if (!meses.length) return null

  const tipos: CategoriaAnual[] = []
  for (let r = filaHead + 1; r < rows.length; r++) {
    const label = at(rows, r, hit.c)
    if (!label) break
    const valores: (number | null)[] = MESES.map(() => null)
    let algo = false
    for (const { c, mi } of meses) {
      const v = num(at(rows, r, c))
      valores[mi] = v
      if (v != null) algo = true
    }
    if (!algo) continue // filas de etiqueta suelta, por ejemplo "Caja menor"
    tipos.push({ nombre: label, clave: claveCategoria(label), valores })
  }

  // El año va en el título. Sin él no se sabe a qué gasto corresponden las
  // piezas, y cruzarlas con otro año da un costo por pieza inventado.
  const titulo = at(rows, hit.r, hit.c)
  const anio = (titulo.match(/(20\d{2})/) || [])[1] ?? null

  return tipos.length ? { titulo, anio, tipos } : null
}

// ── tarifario ───────────────────────────────────────────────────────────

function parsearBloqueTarifa(rows: Grid, filaHead: number, colLabel: number, colValor: number) {
  const items: { concepto: string; valor: number; seccion: string | null }[] = []
  let total: number | null = null
  let seccion: string | null = null
  let vacias = 0

  for (let r = filaHead + 1; r < Math.min(filaHead + 24, rows.length); r++) {
    const label = at(rows, r, colLabel)
    const valor = money(at(rows, r, colValor))

    if (!label) {
      if (valor == null && items.length && ++vacias >= 3) break
      continue
    }
    vacias = 0
    if (label.toLowerCase() === 'total') { total = valor; continue }
    // Un label sin valor no es basura: es un subtítulo ("Incentivo de memes").
    if (valor == null) { seccion = label; continue }
    items.push({ concepto: label, valor, seccion })
  }

  if (!items.length) return null
  return { items, total: total ?? items.reduce((a, i) => a + i.valor, 0) }
}

function parsearTarifario(rows: Grid) {
  const out: Record<string, { items: { concepto: string; valor: number; seccion: string | null }[]; total: number }> = {}
  const ancla = buscarCelda(rows, 'Ediciones')
  if (!ancla) return out

  const fila = rows[ancla.r] || []
  const colDe = (needle: string) =>
    fila.findIndex(v => String(v ?? '').trim().toLowerCase() === needle)

  const bloques: [string, number, number][] = []
  const cSal = colDe('salarios')
  const cVid = colDe('videos')
  const cEdi = colDe('ediciones')
  if (cSal >= 0) bloques.push(['salarios', cSal - 1, cSal])
  if (cVid >= 0) bloques.push(['videos', cVid, cVid + 1])
  if (cEdi >= 0) bloques.push(['ediciones', cEdi, cEdi + 1])

  for (const [clave, colLabel, colValor] of bloques) {
    const b = parsearBloqueTarifa(rows, ancla.r, colLabel, colValor)
    if (b) out[clave] = b
  }
  return out
}

// ── nómina del corte ────────────────────────────────────────────────────

function parsearNomina(rows: Grid): GastosAgencia['nomina'] {
  const hit = buscarCelda(rows, 'Trabajador')
  if (!hit) throw new Error('No encontré el encabezado "Trabajador/a" en la hoja de nómina')

  const header = (rows[hit.r] || []).map(v => String(v ?? '').trim().toLowerCase())
  const idx = (needle: string) => header.findIndex(h => h.includes(needle))
  const cBanco = idx('banco')
  const cCuenta = idx('cuenta')
  const cMonto = idx('pagar')
  const cPago = header.lastIndexOf('pago')

  let corte = ''
  for (let r = 0; r < hit.r; r++) {
    const v = at(rows, r, 0)
    if (v) { corte = v; break }
  }

  const personas: PersonaNomina[] = []
  for (let r = hit.r + 1; r < rows.length; r++) {
    const nombre = at(rows, r, hit.c)
    if (!nombre) continue
    const monto = cMonto >= 0 ? money(at(rows, r, cMonto)) : null
    const pago = cPago >= 0 ? at(rows, r, cPago).toUpperCase() : ''
    personas.push({
      nombre,
      banco: cBanco >= 0 ? at(rows, r, cBanco).replace(/\s+/g, ' ').trim() : '',
      // La columna de cédula existe en el sheet y a propósito no se lee.
      cuenta: cCuenta >= 0 ? enmascararCuenta(at(rows, r, cCuenta)) : '',
      monto: monto ?? 0,
      pagado: pago.startsWith('S'),
    })
  }

  const pagados = personas.filter(p => p.pagado)
  const pendientes = personas.filter(p => !p.pagado)

  return {
    corte,
    personas,
    resumen: {
      total: personas.length,
      pagados: pagados.length,
      pendientes: pendientes.length,
      montoPagado: pagados.reduce((a, p) => a + p.monto, 0),
      montoPendiente: pendientes.reduce((a, p) => a + p.monto, 0),
      // Sin esto no se distingue "no se debe nada" de "todavía no se calculó".
      pendientesSinMonto: pendientes.filter(p => !p.monto).length,
    },
  }
}

function parsearCuentas(rows: Grid): GastosAgencia['cuentas'] {
  const hit = buscarCelda(rows, 'No. de Cuenta')
  if (!hit) return { total: 0, porBanco: [] }

  const header = (rows[hit.r] || []).map(v => String(v ?? '').trim().toLowerCase())
  const cBanco = header.findIndex(h => h.includes('banco'))

  const mapa = new Map<string, number>()
  let total = 0
  for (let r = hit.r + 1; r < rows.length; r++) {
    const nombre = at(rows, r, 0)
    const banco = cBanco >= 0 ? at(rows, r, cBanco).replace(/\s+/g, ' ').trim() : ''
    if (!nombre && !banco) continue
    total++
    const k = banco || 'Sin banco'
    mapa.set(k, (mapa.get(k) || 0) + 1)
  }

  // Solo el agregado por banco: el directorio completo de cuentas no tiene por
  // qué salir de aquí para pintar un panel.
  return {
    total,
    porBanco: [...mapa.entries()]
      .map(([banco, cuentas]) => ({ banco, cuentas }))
      .sort((a, b) => b.cuentas - a.cuentas),
  }
}

// ── entrada pública ─────────────────────────────────────────────────────

let cache: { datos: GastosAgencia; expira: number } | null = null

export async function obtenerGastosAgencia(forzar = false): Promise<GastosAgencia> {
  if (!gastosAgenciaConfigurado()) {
    throw new Error('GASTOS_AGENCIA_SHEET_ID no está configurado')
  }
  if (!forzar && cache && Date.now() < cache.expira) return cache.datos

  const [nominaRows, actualRows, previoRows, cuentasRows] = await Promise.all([
    traerPestania(GIDS.nomina),
    traerPestania(GIDS.actual),
    traerPestania(GIDS.previo),
    traerPestania(GIDS.cuentas),
  ])

  const avisos: string[] = []
  const seguro = <T>(fn: () => T, alterno: T, etiqueta: string): T => {
    try { return fn() } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      avisos.push(`${etiqueta}: ${msg}`)
      logger.warn(`[gastosAgencia] ${etiqueta}: ${msg}`)
      return alterno
    }
  }

  // El año se toma del propio encabezado del sheet, no del reloj del servidor:
  // así el panel no se rompe el 1 de enero.
  const anios: Record<string, Anio> = {}
  const hojas: [string, string, Grid][] = [
    ['actual', GIDS.actual, actualRows],
    ['previo', GIDS.previo, previoRows],
  ]
  for (const [etiqueta, gid, rows] of hojas) {
    const parsed = seguro(
      () => parsearContabilidad(rows, anioDelEncabezado(rows), gid),
      null,
      `Contabilidad (${etiqueta})`,
    )
    if (parsed) anios[String(parsed.anio)] = parsed
  }

  const produccion: GastosAgencia['produccion'] = {}
  const pre = seguro(() => parsearProduccion(actualRows, 'Contenido de PreICFES'), null, 'Producción PreICFES')
  const med = seguro(() => parsearProduccion(actualRows, 'Contenido de Premédico'), null, 'Producción Premédico')
  if (pre) produccion.preicfes = pre
  if (med) produccion.premedico = med

  const datos: GastosAgencia = {
    leidoEn: new Date().toISOString(),
    anios,
    produccion,
    tarifario: seguro(() => parsearTarifario(actualRows), {}, 'Tarifario'),
    nomina: seguro(
      () => parsearNomina(nominaRows),
      { corte: '', personas: [], resumen: { total: 0, pagados: 0, pendientes: 0, montoPagado: 0, montoPendiente: 0, pendientesSinMonto: 0 } },
      'Nómina',
    ),
    cuentas: seguro(() => parsearCuentas(cuentasRows), { total: 0, porBanco: [] }, 'Cuentas'),
    avisos,
  }

  cache = { datos, expira: Date.now() + TTL_MS }
  return datos
}

/** Año de la hoja, leído del primer encabezado de mes ("enero 2026"). */
function anioDelEncabezado(rows: Grid): number {
  const head = filaDeMeses(rows)
  if (head) {
    for (const { c } of head.meses) {
      const m = at(rows, head.row, c).match(/(20\d{2})/)
      if (m) return Number(m[1])
    }
  }
  throw new Error('No pude determinar el año de la hoja de contabilidad')
}

/** Para servir algo aunque el sheet esté caído. */
export function ultimoSnapshot(): GastosAgencia | null {
  return cache?.datos ?? null
}

/**
 * Tira la caché.
 *
 * Se llama después de cada escritura: si no, el panel seguiría mostrando el
 * valor viejo hasta cinco minutos y parecería que la edición no se guardó.
 */
export function invalidarCache(): void {
  cache = null
}
