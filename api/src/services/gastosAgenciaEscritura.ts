// Escritura sobre el Google Sheet de gastos de la agencia.
//
// El sheet es la única fuente de verdad: la app no guarda una copia. Un "sync
// bidireccional" entre dos copias es donde se pierden datos, porque dos ediciones
// simultáneas se pisan sin avisar. Aquí solo hay un almacén y no puede divergir.
//
// Cada escritura:
//   1. relee la pestaña (nunca desde caché),
//   2. vuelve a ubicar la celda POR ETIQUETA, no por una posición guardada — si
//      alguien insertó una fila en el sheet, la posición vieja apuntaría a otro dato,
//   3. compara con el valor que el cliente creía tener y aborta con 409 si cambió,
//   4. escribe y tira la caché de lectura.

import {
  GIDS, at, money, num, buscarCelda, filaDeMeses, claveCategoria,
  traerPestania, invalidarCache, sheetId, obtenerGastosAgencia,
} from './gastosAgencia'
import { escribirCeldas, agregarFila, sheetsEscrituraConfigurada } from './googleSheets'
import { logger } from '../utils/logger'

type Grid = string[][]

/** El valor cambió en el sheet desde que el cliente lo leyó. */
export class ConflictoSheet extends Error {
  constructor(public valorActual: string | number | null, mensaje?: string) {
    super(mensaje ?? 'El dato cambió en el sheet desde que lo abriste')
    this.name = 'ConflictoSheet'
  }
}

/** El dato que se quiere editar ya no está donde debería. */
export class NoUbicado extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'NoUbicado'
  }
}

export function escrituraDisponible(): boolean {
  return sheetsEscrituraConfigurada()
}

function exigirEscritura() {
  if (!escrituraDisponible()) {
    throw new Error('La edición está apagada: falta la cuenta de servicio de Google Sheets en el servidor')
  }
}

/** Compara importes tolerando null y 0 como equivalentes a "vacío". */
function mismoImporte(a: number | null, b: number | null): boolean {
  return (a ?? 0) === (b ?? 0)
}

// ── contabilidad mensual ────────────────────────────────────────────────

/**
 * Ubica la celda de una categoría y mes en la hoja de contabilidad.
 *
 * Exportada aparte de la escritura para poder probarla en seco: escribir en la
 * celda equivocada de la contabilidad es el peor fallo posible de este módulo.
 */
export function ubicarContabilidad(rows: Grid, categoriaClave: string, mes: number): { fila: number; columna: number } {
  const head = filaDeMeses(rows)
  if (!head) throw new NoUbicado('No encontré la fila de meses en la hoja de contabilidad')

  const columna = head.meses.find(m => m.mi === mes)?.c
  if (columna == null) throw new NoUbicado('Esa hoja no tiene columna para ese mes')

  // Se busca por clave canónica y se para en Total: la fila de totales es una
  // fórmula del sheet y no se debe sobreescribir nunca.
  for (let r = head.row + 1; r < rows.length; r++) {
    const label = at(rows, r, 0)
    if (!label) continue
    if (label.toLowerCase() === 'total') break
    if (claveCategoria(label) === categoriaClave) return { fila: r, columna }
  }
  throw new NoUbicado(`No encontré la categoría «${categoriaClave}» en la hoja`)
}

export async function actualizarContabilidad(opciones: {
  anio: string
  categoriaClave: string
  mes: number
  valor: number | null
  valorAnterior: number | null
  usuario?: string
}): Promise<{ valor: number | null }> {
  exigirEscritura()
  const { anio, categoriaClave, mes, valor, valorAnterior } = opciones

  // El gid de la hoja del año sale del snapshot ya parseado.
  const snap = await obtenerGastosAgencia()
  const hoja = snap.anios[anio]
  if (!hoja) throw new NoUbicado(`No tengo cargada la contabilidad de ${anio}`)

  const rows = await traerPestania(hoja.gid)
  const { fila, columna } = ubicarContabilidad(rows, categoriaClave, mes)

  const actual = money(at(rows, fila, columna))
  if (!mismoImporte(actual, valorAnterior)) throw new ConflictoSheet(actual)

  await escribirCeldas(sheetId(), [{ gid: hoja.gid, fila, columna, valor: valor ?? '' }])
  invalidarCache()

  logger.info(
    { type: 'gastos_agencia_edit', tabla: 'contabilidad', anio, categoriaClave, mes, valor, usuario: opciones.usuario },
    'contabilidad actualizada desde la app',
  )
  return { valor }
}

// ── nómina del corte ────────────────────────────────────────────────────

interface UbicacionNomina {
  filaHeader: number
  filas: number[]           // filas con persona, en orden
  cNombre: number
  cBanco: number
  cCuenta: number
  cMonto: number
  cPago: number
}

export function ubicarNomina(rows: Grid): UbicacionNomina {
  const hit = buscarCelda(rows, 'Trabajador')
  if (!hit) throw new NoUbicado('No encontré el encabezado "Trabajador/a" en la hoja de nómina')

  const header = (rows[hit.r] || []).map(v => String(v ?? '').trim().toLowerCase())
  const idx = (needle: string) => header.findIndex(h => h.includes(needle))

  const filas: number[] = []
  for (let r = hit.r + 1; r < rows.length; r++) {
    if (at(rows, r, hit.c)) filas.push(r)
  }

  return {
    filaHeader: hit.r,
    filas,
    cNombre: hit.c,
    cBanco: idx('banco'),
    cCuenta: idx('cuenta'),
    cMonto: idx('pagar'),
    cPago: header.lastIndexOf('pago'),
  }
}

export async function actualizarNomina(opciones: {
  indice: number
  nombreEsperado: string
  campo: 'monto' | 'pagado' | 'banco'
  valor: number | boolean | string | null
  valorAnterior: number | boolean | string | null
  usuario?: string
}): Promise<{ valor: unknown }> {
  exigirEscritura()
  const { indice, nombreEsperado, campo, valor, valorAnterior } = opciones

  const rows = await traerPestania(GIDS.nomina)
  const u = ubicarNomina(rows)

  const fila = u.filas[indice]
  if (fila == null) throw new NoUbicado('Esa fila de la nómina ya no existe en el sheet')

  // Verificación de identidad: si en esa posición hay otra persona, alguien
  // reordenó o insertó filas y escribir ahí le cambiaría el pago a quien no es.
  const nombreEnFila = at(rows, fila, u.cNombre)
  if (nombreEnFila.trim() !== nombreEsperado.trim()) {
    throw new ConflictoSheet(nombreEnFila, `En esa fila ahora está «${nombreEnFila}», no «${nombreEsperado}». Recarga antes de editar.`)
  }

  let columna: number
  let aEscribir: string | number
  if (campo === 'monto') {
    columna = u.cMonto
    const actual = money(at(rows, fila, columna))
    if (!mismoImporte(actual, (valorAnterior as number | null) ?? null)) throw new ConflictoSheet(actual)
    aEscribir = (valor as number | null) ?? ''
  } else if (campo === 'pagado') {
    columna = u.cPago
    const textoActual = at(rows, fila, columna).toUpperCase()
    const actual = textoActual.startsWith('S')
    if (actual !== Boolean(valorAnterior)) throw new ConflictoSheet(actual ? 'SÍ' : 'NO')
    aEscribir = valor ? 'SÍ' : 'NO'
  } else {
    columna = u.cBanco
    const actual = at(rows, fila, columna)
    if (actual.trim() !== String(valorAnterior ?? '').trim()) throw new ConflictoSheet(actual)
    aEscribir = String(valor ?? '')
  }
  if (columna < 0) throw new NoUbicado(`La hoja de nómina no tiene la columna de ${campo}`)

  await escribirCeldas(sheetId(), [{ gid: GIDS.nomina, fila, columna, valor: aEscribir }])
  invalidarCache()

  logger.info(
    { type: 'gastos_agencia_edit', tabla: 'nomina', persona: nombreEsperado, campo, valor, usuario: opciones.usuario },
    'nómina actualizada desde la app',
  )
  return { valor }
}

export async function agregarPersonaNomina(opciones: {
  nombre: string
  banco?: string | null
  monto?: number | null
  pagado?: boolean
  usuario?: string
}): Promise<{ fila: number }> {
  exigirEscritura()
  const { nombre, banco, monto, pagado } = opciones

  const rows = await traerPestania(GIDS.nomina)
  const u = ubicarNomina(rows)

  if (u.filas.some(r => at(rows, r, u.cNombre).trim().toLowerCase() === nombre.trim().toLowerCase())) {
    throw new ConflictoSheet(nombre, `«${nombre}» ya está en la nómina de este corte`)
  }

  // Se arma la fila completa respetando el orden de columnas del sheet.
  const ancho = Math.max(u.cNombre, u.cBanco, u.cCuenta, u.cMonto, u.cPago) + 1
  const valores: (string | number | null)[] = Array.from({ length: ancho }, () => '')
  valores[u.cNombre] = nombre.trim()
  if (u.cBanco >= 0) valores[u.cBanco] = banco?.trim() ?? ''
  if (u.cMonto >= 0) valores[u.cMonto] = monto ?? ''
  if (u.cPago >= 0) valores[u.cPago] = pagado ? 'SÍ' : 'NO'
  // Cédula y número de cuenta quedan en blanco a propósito: son datos que el
  // panel nunca recibe completos, así que no puede escribirlos. Se llenan en el
  // sheet, que es donde ya viven.

  const fila = await agregarFila(sheetId(), GIDS.nomina, valores, 0)
  invalidarCache()

  logger.info(
    { type: 'gastos_agencia_edit', tabla: 'nomina', accion: 'alta', persona: nombre, usuario: opciones.usuario },
    'persona agregada a la nómina desde la app',
  )
  return { fila }
}

// ── producción de contenido ─────────────────────────────────────────────

export function ubicarProduccion(
  rows: Grid, bloqueTitulo: string, tipo: string, mes: number,
): { fila: number; columna: number } {
  const ancla = buscarCelda(rows, bloqueTitulo)
  if (!ancla) throw new NoUbicado(`No encontré el bloque «${bloqueTitulo}» en el sheet`)

  let filaHead = -1
  for (let r = ancla.r; r < Math.min(ancla.r + 4, rows.length); r++) {
    if (at(rows, r, ancla.c).toLowerCase() === 'tipo') { filaHead = r; break }
  }
  if (filaHead < 0) throw new NoUbicado('No encontré la fila "Tipo" del bloque de producción')

  let columna = -1
  const vistos = new Set<number>()
  ;(rows[filaHead] || []).forEach((v, c) => {
    if (c <= ancla.c) return
    const mi = indiceMesLocal(v)
    if (mi >= 0 && !vistos.has(mi)) {
      vistos.add(mi)
      if (mi === mes) columna = c
    }
  })
  if (columna < 0) throw new NoUbicado('Ese bloque no tiene columna para ese mes')

  for (let r = filaHead + 1; r < rows.length; r++) {
    const label = at(rows, r, ancla.c)
    if (!label) break
    if (label.trim().toLowerCase() === tipo.trim().toLowerCase()) return { fila: r, columna }
  }
  throw new NoUbicado(`No encontré el tipo «${tipo}» en el bloque`)
}

export async function actualizarProduccion(opciones: {
  bloqueTitulo: string
  tipo: string
  mes: number
  valor: number | null
  valorAnterior: number | null
  usuario?: string
}): Promise<{ valor: number | null }> {
  exigirEscritura()
  const { bloqueTitulo, tipo, mes, valor, valorAnterior } = opciones

  const rows = await traerPestania(GIDS.actual)
  const { fila, columna } = ubicarProduccion(rows, bloqueTitulo, tipo, mes)

  const actual = num(at(rows, fila, columna))
  if ((actual ?? 0) !== (valorAnterior ?? 0)) throw new ConflictoSheet(actual)

  await escribirCeldas(sheetId(), [{ gid: GIDS.actual, fila, columna, valor: valor ?? '' }])
  invalidarCache()

  logger.info(
    { type: 'gastos_agencia_edit', tabla: 'produccion', bloqueTitulo, tipo, mes, valor, usuario: opciones.usuario },
    'producción actualizada desde la app',
  )
  return { valor }
}

// Copia local para no exportar más superficie de la necesaria del parser.
const MESES_LOCAL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function indiceMesLocal(label: string): number {
  const s = String(label ?? '').trim().toLowerCase()
  if (!s) return -1
  return MESES_LOCAL.findIndex(m => s.startsWith(m))
}

// ── tarifario ───────────────────────────────────────────────────────────

const ANCLA_TARIFA: Record<string, { etiqueta: string; desplazamiento: number }> = {
  // El bloque de salarios tiene el concepto una columna a la izquierda del encabezado.
  salarios: { etiqueta: 'salarios', desplazamiento: -1 },
  videos: { etiqueta: 'videos', desplazamiento: 0 },
  ediciones: { etiqueta: 'ediciones', desplazamiento: 0 },
}

export function ubicarTarifario(
  rows: Grid, bloque: 'salarios' | 'videos' | 'ediciones', concepto: string,
): { fila: number; columna: number } {
  const ancla = buscarCelda(rows, 'Ediciones')
  if (!ancla) throw new NoUbicado('No encontré el bloque de tarifas en el sheet')

  const filaEncabezado = rows[ancla.r] || []
  const cfg = ANCLA_TARIFA[bloque]
  const colEncabezado = filaEncabezado.findIndex(
    v => String(v ?? '').trim().toLowerCase() === cfg.etiqueta,
  )
  if (colEncabezado < 0) throw new NoUbicado(`No encontré el bloque «${bloque}» en el tarifario`)

  const colLabel = colEncabezado + cfg.desplazamiento
  const columna = cfg.desplazamiento === 0 ? colEncabezado + 1 : colEncabezado

  for (let r = ancla.r + 1; r < Math.min(ancla.r + 24, rows.length); r++) {
    if (at(rows, r, colLabel).trim().toLowerCase() === concepto.trim().toLowerCase()) {
      return { fila: r, columna }
    }
  }
  throw new NoUbicado(`No encontré «${concepto}» en el tarifario`)
}

export async function actualizarTarifario(opciones: {
  bloque: 'salarios' | 'videos' | 'ediciones'
  concepto: string
  valor: number | null
  valorAnterior: number | null
  usuario?: string
}): Promise<{ valor: number | null }> {
  exigirEscritura()
  const { bloque, concepto, valor, valorAnterior } = opciones

  const rows = await traerPestania(GIDS.actual)
  const { fila, columna: colValor } = ubicarTarifario(rows, bloque, concepto)

  const actual = money(at(rows, fila, colValor))
  if (!mismoImporte(actual, valorAnterior)) throw new ConflictoSheet(actual)

  await escribirCeldas(sheetId(), [{ gid: GIDS.actual, fila, columna: colValor, valor: valor ?? '' }])
  invalidarCache()

  logger.info(
    { type: 'gastos_agencia_edit', tabla: 'tarifario', bloque, concepto, valor, usuario: opciones.usuario },
    'tarifario actualizado desde la app',
  )
  return { valor }
}
