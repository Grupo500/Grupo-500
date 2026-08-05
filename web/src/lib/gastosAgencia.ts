// Análisis de los gastos de la agencia.
//
// El backend entrega el sheet normalizado y el cálculo vive aquí: son doce
// puntos por categoría, así que filtrar por periodo o apagar una categoría se
// recalcula al instante sin volver a pedir datos.

export const MESES_GASTOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export interface CategoriaAnual {
  nombre: string
  clave: string
  valores: (number | null)[]
}

export interface AnioGastos {
  anio: number
  meses: string[]
  categorias: CategoriaAnual[]
  totalPorMes: (number | null)[]
  totalAnio: number
  promedioMesesActivos: number
  mesesConDato: number[]
  descuadre: { mes: string; sheet: number; suma: number }[]
}

export interface GastosAgenciaData {
  leidoEn: string
  desactualizado?: boolean
  /** El servidor tiene cuenta de servicio y las tablas se pueden editar. */
  edicion?: boolean
  anios: Record<string, AnioGastos>
  produccion: Record<string, { titulo: string; anio: string | null; tipos: CategoriaAnual[] }>
  tarifario: Record<string, { items: { concepto: string; valor: number; seccion: string | null }[]; total: number }>
  nomina: {
    corte: string
    personas: { nombre: string; banco: string; cuenta: string; monto: number; pagado: boolean }[]
    resumen: {
      total: number; pagados: number; pendientes: number
      montoPagado: number; montoPendiente: number; pendientesSinMonto: number
    }
  }
  cuentas: { total: number; porBanco: { banco: string; cuentas: number }[] }
  avisos: string[]
}

export type Tono = 'alerta' | 'bueno' | 'neutro'
export type Tendencia = 'creciendo' | 'cayendo' | 'estable' | 'errático' | 'sin datos'

export interface CategoriaAnalizada {
  nombre: string
  clave: string
  valores: (number | null)[]
  total: number
  participacion: number
  totalPrevio: number | null
  delta: number | null
  tendencia: Tendencia
}

export interface Observacion { tono: Tono; titulo: string; texto: string }

export interface AnalisisGastos {
  anio: string
  meses: string[]
  porMes: (number | null)[]
  previoPorMes: (number | null)[] | null
  mesesDisponibles: number[]
  mesesActivos: number[]
  primerMes: number
  ultimoMes: number
  rangoCompleto: boolean
  filtradoPorCategoria: boolean
  total: number
  totalPrevio: number | null
  deltaAnual: number | null
  promedio: number
  ritmoAnualizado: number
  totalAnioPrevio: number | null
  deltaProyeccion: number | null
  mesMax: { i: number; v: number } | null
  mesMin: { i: number; v: number } | null
  categorias: CategoriaAnalizada[]
  concentracion: number
  volatilidad: number | null
  eficiencia: EficienciaContenido | null
  observaciones: Observacion[]
  calidad: { nivel: 'alto' | 'medio' | 'info'; texto: string }[]
}

export interface EficienciaContenido {
  piezasPorMes: (number | null)[]
  horasPorMes: (number | null)[]
  gastoPorMes: (number | null)[]
  costoPorPieza: (number | null)[]
  mesesConPiezas: number[]
  piezasTotal: number
  gastoTotal: number
  costoPromedio: number | null
  porBloque: { clave: string; titulo: string; total: number }[]
}

const suma = (xs: (number | null)[]): number => xs.reduce<number>((a, b) => a + (b || 0), 0)
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Pendiente de mínimos cuadrados: cuánto se mueve el gasto por mes. */
function pendiente(ys: (number | null)[]): number | null {
  const pts = ys.map((y, x) => [x, y] as const).filter((p): p is readonly [number, number] => p[1] != null)
  if (pts.length < 3) return null
  const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length
  const my = pts.reduce((a, p) => a + p[1], 0) / pts.length
  let arriba = 0, abajo = 0
  for (const [x, y] of pts) { arriba += (x - mx) * (y - my); abajo += (x - mx) ** 2 }
  return abajo === 0 ? null : arriba / abajo
}

function coefVariacion(ys: (number | null)[]): number | null {
  const v = ys.filter((y): y is number => y != null && y > 0)
  if (v.length < 2) return null
  const m = v.reduce((a, b) => a + b, 0) / v.length
  if (!m) return null
  const varianza = v.reduce((a, y) => a + (y - m) ** 2, 0) / v.length
  return Math.sqrt(varianza) / m
}

/**
 * Cómo se comporta una categoría dentro del periodo.
 *
 * Es distinto de la variación contra el año anterior: Edición puede estar plana
 * dentro del año y llevar un +500% contra el año pasado, y son dos lecturas que
 * hay que poder dar por separado.
 */
function tendenciaDe(valores: (number | null)[]): Tendencia {
  const activos = valores.filter((v): v is number => v != null && v > 0)
  if (activos.length < 3) return 'sin datos'
  const m = activos.reduce((a, b) => a + b, 0) / activos.length
  const p = pendiente(valores)
  const cv = coefVariacion(valores) ?? 0
  const relativa = p != null && m ? p / m : 0
  if (cv > 0.7) return 'errático'
  if (relativa > 0.12) return 'creciendo'
  if (relativa < -0.12) return 'cayendo'
  return 'estable'
}

const ES_HORAS = (nombre: string) => /hora/i.test(nombre)

function analizarProduccion(
  datos: GastosAgenciaData, a: AnioGastos, mesesActivos: number[], anio: string,
): EficienciaContenido | null {
  // Solo los bloques del año que se está viendo: las tablas de producción están
  // en la hoja del año actual, y usarlas con el gasto de otro año daría un
  // costo por pieza inventado.
  const entradas = Object.entries(datos.produccion).filter(([, b]) => b.anio === anio)
  if (!entradas.length) return null
  const bloques = entradas.map(([, b]) => b)

  const acumular = (soloHoras: boolean) => MESES_GASTOS.map((_, i) => {
    let t: number | null = null
    for (const b of bloques) {
      for (const tipo of b.tipos) {
        if (ES_HORAS(tipo.nombre) !== soloHoras) continue
        const v = tipo.valores[i]
        if (v != null) t = (t || 0) + v
      }
    }
    return t
  })

  const piezasPorMes = acumular(false)
  const horasPorMes = acumular(true)

  // El gasto que produce contenido: Videos y Edición.
  const claves = ['videos', 'edicion']
  const gastoPorMes = MESES_GASTOS.map((_, i) =>
    suma(a.categorias.filter(c => claves.includes(c.clave)).map(c => c.valores[i])))

  const costoPorPieza = MESES_GASTOS.map((_, i) =>
    (piezasPorMes[i] && gastoPorMes[i]) ? gastoPorMes[i]! / piezasPorMes[i]! : null)

  const mesesConPiezas = mesesActivos.filter(i => (piezasPorMes[i] ?? 0) > 0)
  const piezasTotal = suma(mesesConPiezas.map(i => piezasPorMes[i]))
  const gastoTotal = suma(mesesConPiezas.map(i => gastoPorMes[i]))

  return {
    piezasPorMes, horasPorMes, gastoPorMes, costoPorPieza, mesesConPiezas,
    piezasTotal, gastoTotal,
    costoPromedio: piezasTotal ? gastoTotal / piezasTotal : null,
    porBloque: entradas.map(([clave, b]) => ({
      clave, titulo: b.titulo,
      total: suma(b.tipos.filter(t => !ES_HORAS(t.nombre)).flatMap(t => t.valores.filter(v => v != null))),
    })),
  }
}

export function analizarGastos(
  datos: GastosAgenciaData,
  { anio, activas = null, desde = null, hasta = null }: {
    anio: string
    activas?: Set<string> | null
    desde?: number | null
    hasta?: number | null
  },
): AnalisisGastos | null {
  const a = datos.anios[anio]
  if (!a) return null
  const previo = datos.anios[String(Number(anio) - 1)] ?? null

  const cats = a.categorias.filter(c => !activas || activas.has(c.clave))
  const filtradoPorCategoria = Boolean(activas && cats.length !== a.categorias.length)

  // Sin filtro de categorías manda la fila Total del sheet: hay meses con total
  // y sin desglose (junio 2025) y sumar categorías se comería ese gasto.
  const serieDe = (anual: AnioGastos, seleccion: CategoriaAnual[]) => MESES_GASTOS.map((_, i) => {
    const vals = seleccion.map(c => c.valores[i]).filter(v => v != null)
    const porCats = vals.length ? suma(vals) : null
    return filtradoPorCategoria ? porCats : (anual.totalPorMes[i] ?? porCats)
  })

  const porMes = serieDe(a, cats)
  const mesesDisponibles = MESES_GASTOS.map((_, i) => i).filter(i => (a.totalPorMes[i] || 0) > 0)

  const dLim = desde ?? -Infinity
  const hLim = hasta ?? Infinity
  const mesesActivos = mesesDisponibles.filter(i => i >= dLim && i <= hLim)
  const rangoCompleto = mesesActivos.length === mesesDisponibles.length
  const primerMes = mesesActivos.length ? Math.min(...mesesActivos) : -1
  const ultimoMes = mesesActivos.length ? Math.max(...mesesActivos) : -1

  const enRango = (vals: (number | null)[]) =>
    vals.map((v, i) => (mesesActivos.includes(i) ? v : null))

  const total = suma(mesesActivos.map(i => porMes[i]))

  let previoPorMes: (number | null)[] | null = null
  let totalPrevio: number | null = null
  if (previo) {
    previoPorMes = serieDe(previo, previo.categorias.filter(c => !activas || activas.has(c.clave)))
    totalPrevio = suma(mesesActivos.map(i => previoPorMes![i]))
  }

  const promedio = mesesActivos.length ? total / mesesActivos.length : 0
  const ritmoAnualizado = promedio * 12

  const conValor = mesesActivos.map(i => ({ i, v: porMes[i] || 0 }))
  const mesMax = conValor.length ? conValor.reduce((x, y) => (y.v > x.v ? y : x)) : null
  const mesMin = conValor.length ? conValor.reduce((x, y) => (y.v < x.v ? y : x)) : null

  const categorias: CategoriaAnalizada[] = cats.map(c => {
    const tot = suma(mesesActivos.map(i => c.valores[i]))
    const cp = previo?.categorias.find(p => p.clave === c.clave)
    const totPrev = cp ? suma(mesesActivos.map(i => cp.valores[i])) : null
    const recortados = enRango(c.valores)
    return {
      nombre: c.nombre,
      clave: c.clave,
      valores: recortados,
      total: tot,
      participacion: total ? tot / total : 0,
      totalPrevio: totPrev,
      delta: (totPrev != null && totPrev > 0) ? (tot - totPrev) / totPrev : null,
      tendencia: tendenciaDe(recortados),
    }
  }).sort((x, y) => y.total - x.total)

  const concentracion = total
    ? suma(categorias.slice(0, 2).map(c => c.total)) / total
    : 0

  const eficiencia = analizarProduccion(datos, a, mesesActivos, anio)

  const analisis: AnalisisGastos = {
    anio, meses: [...MESES_GASTOS],
    porMes, previoPorMes,
    mesesDisponibles, mesesActivos, primerMes, ultimoMes, rangoCompleto,
    filtradoPorCategoria,
    total, totalPrevio,
    deltaAnual: (totalPrevio != null && totalPrevio > 0) ? (total - totalPrevio) / totalPrevio : null,
    promedio, ritmoAnualizado,
    totalAnioPrevio: previo ? previo.totalAnio : null,
    // Con un rango parcial, comparar un ritmo anualizado contra el total del año
    // anterior mezclaría peras con manzanas.
    deltaProyeccion: (rangoCompleto && previo?.totalAnio)
      ? (ritmoAnualizado - previo.totalAnio) / previo.totalAnio : null,
    mesMax, mesMin, categorias, concentracion,
    volatilidad: coefVariacion(mesesActivos.map(i => porMes[i])),
    eficiencia,
    calidad: revisarCalidad(datos, a, mesesDisponibles),
    observaciones: [],
  }

  analisis.observaciones = redactar(analisis, datos)
  return analisis
}

// ── calidad del dato ────────────────────────────────────────────────────

function revisarCalidad(datos: GastosAgenciaData, a: AnioGastos, disponibles: number[]) {
  const out: { nivel: 'alto' | 'medio' | 'info'; texto: string }[] = []
  const cop = (n: number) => n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

  for (const d of a.descuadre) {
    out.push({
      nivel: d.suma === 0 ? 'alto' : 'medio',
      texto: d.suma === 0
        ? `${capital(d.mes)} tiene un total de ${cop(d.sheet)} pero ninguna categoría desglosada: ese gasto no se puede atribuir.`
        : `En ${d.mes} la fila Total del sheet (${cop(d.sheet)}) no cuadra con la suma de categorías (${cop(d.suma)}), una diferencia de ${cop(Math.abs(d.sheet - d.suma))}.`,
    })
  }

  const faltan = MESES_GASTOS.map((_, i) => i).filter(i => !disponibles.includes(i))
  if (faltan.length && faltan.length < 12) {
    out.push({
      nivel: 'info',
      texto: `${faltan.length} ${faltan.length === 1 ? 'mes' : 'meses'} sin registrar en ${a.anio} (${faltan.map(i => MESES_GASTOS[i]).join(', ')}). Todo se calcula sobre los ${disponibles.length} meses con dato.`,
    })
  }

  const r = datos.nomina.resumen
  if (r.pendientesSinMonto > 0) {
    out.push({
      nivel: r.pendientesSinMonto > r.total / 2 ? 'medio' : 'info',
      texto: `En el corte «${datos.nomina.corte}» hay ${r.pendientesSinMonto} de ${r.total} personas sin pago y sin monto en el sheet, así que el pendiente en pesos que se muestra está incompleto.`,
    })
  }

  for (const aviso of datos.avisos) out.push({ nivel: 'alto', texto: aviso })
  return out
}

// ── observaciones ───────────────────────────────────────────────────────

function redactar(r: AnalisisGastos, datos: GastosAgenciaData): Observacion[] {
  const obs: Observacion[] = []
  const cop = (n: number | null) => n == null
    ? '—'
    : n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
  const pc = (v: number | null) => v == null
    ? '—'
    : `${v > 0 ? '+' : ''}${(v * 100).toFixed(0).replace('.', ',')}%`

  const periodo = r.primerMes < 0 ? '—'
    : r.primerMes === r.ultimoMes ? `en ${MESES_GASTOS[r.ultimoMes]}`
      : `de ${MESES_GASTOS[r.primerMes]} a ${MESES_GASTOS[r.ultimoMes]}`

  if (r.deltaAnual != null) {
    const veces = r.totalPrevio ? r.total / r.totalPrevio : null
    obs.push({
      tono: r.deltaAnual > 0.25 ? 'alerta' : r.deltaAnual < -0.1 ? 'bueno' : 'neutro',
      titulo: `El gasto va ${pc(r.deltaAnual)} contra el año pasado`,
      texto: `${capital(periodo)} el gasto suma ${cop(r.total)}. En el mismo periodo de ${Number(r.anio) - 1} fue ${cop(r.totalPrevio)}`
        + (veces && veces > 1.5 ? `, o sea ${veces.toFixed(1).replace('.', ',')} veces más.` : '.'),
    })
  }

  if (r.deltaProyeccion != null && r.mesesActivos.length < 12) {
    obs.push({
      tono: r.deltaProyeccion > 0.2 ? 'alerta' : 'neutro',
      titulo: `Cierre proyectado ${cop(r.ritmoAnualizado)}`,
      texto: `Al ritmo de ${cop(r.promedio)} por mes, ${r.anio} cerraría en ${cop(r.ritmoAnualizado)} frente a ${cop(r.totalAnioPrevio)} del año anterior (${pc(r.deltaProyeccion)}). Es una proyección lineal: asume que los meses que faltan se parecen a los que ya pasaron.`,
    })
  }

  const sube = r.categorias.filter(c => c.delta != null).sort((a, b) => b.delta! - a.delta!)[0]
  if (sube && sube.delta! > 0.3) {
    obs.push({
      tono: 'alerta',
      titulo: `${sube.nombre} es lo que más creció (${pc(sube.delta)})`,
      texto: `Pasó de ${cop(sube.totalPrevio)} a ${cop(sube.total)} ${periodo}, y es el ${(sube.participacion * 100).toFixed(1).replace('.', ',')}% del gasto del periodo.`,
    })
  }

  const baja = r.categorias.filter(c => c.delta != null).sort((a, b) => a.delta! - b.delta!)[0]
  if (baja && baja.delta! < -0.15) {
    obs.push({
      tono: 'bueno',
      titulo: `${baja.nombre} bajó ${pc(baja.delta)}`,
      texto: `De ${cop(baja.totalPrevio)} a ${cop(baja.total)}. Vale confirmar si es ahorro real o gasto que se movió a otra categoría.`,
    })
  }

  if (r.categorias.length >= 2 && r.concentracion > 0.5) {
    const [a1, a2] = r.categorias
    obs.push({
      tono: 'neutro',
      titulo: `${(r.concentracion * 100).toFixed(0)}% del gasto está en dos categorías`,
      texto: `${a1.nombre} (${cop(a1.total)}) y ${a2.nombre} (${cop(a2.total)}) concentran la mayoría. Cualquier recorte serio sale de ahí; tocar las demás mueve poco.`,
    })
  }

  if (r.mesMax && r.mesMin && r.mesMax.i !== r.mesMin.i) {
    const rango = r.mesMin.v ? r.mesMax.v / r.mesMin.v : null
    obs.push({
      tono: (r.volatilidad ?? 0) > 0.3 ? 'alerta' : 'neutro',
      titulo: `${capital(MESES_GASTOS[r.mesMax.i])} fue el mes más caro con ${cop(r.mesMax.v)}`,
      texto: `El más barato fue ${MESES_GASTOS[r.mesMin.i]} con ${cop(r.mesMin.v)}`
        + (rango ? `, o sea ${rango.toFixed(1).replace('.', ',')} veces de diferencia entre picos.` : '.')
        + ((r.volatilidad ?? 0) > 0.3 ? ' Con esa variación mes a mes, presupuestar con el promedio va a fallar.' : ''),
    })
  }

  const erraticas = r.categorias.filter(c => c.tendencia === 'errático')
  if (erraticas.length) {
    obs.push({
      tono: 'alerta',
      titulo: erraticas.length === 1
        ? 'Una categoría se comporta de forma errática'
        : `${erraticas.length} categorías se comportan de forma errática`,
      texto: `${erraticas.map(c => c.nombre).join(', ')}: el gasto salta de un mes a otro sin patrón. Suele ser pagos que se acumulan y salen todos en un mes, no consumo real de ese mes.`,
    })
  }

  const ef = r.eficiencia
  if (ef?.costoPromedio) {
    const primero = ef.mesesConPiezas[0]
    const ultimo = ef.mesesConPiezas[ef.mesesConPiezas.length - 1]
    const cp0 = ef.costoPorPieza[primero]
    const cp1 = ef.costoPorPieza[ultimo]
    const cambio = (cp0 && cp1) ? (cp1 - cp0) / cp0 : null
    obs.push({
      tono: cambio != null && cambio > 0.2 ? 'alerta' : cambio != null && cambio < -0.1 ? 'bueno' : 'neutro',
      titulo: `Cada pieza de contenido cuesta ${cop(ef.costoPromedio)} en promedio`,
      texto: `${ef.piezasTotal.toLocaleString('es-CO')} piezas producidas contra ${cop(ef.gastoTotal)} de Videos y Edición`
        + (cambio != null && primero !== ultimo
          ? `. De ${MESES_GASTOS[primero]} a ${MESES_GASTOS[ultimo]} el costo por pieza pasó de ${cop(cp0)} a ${cop(cp1)} (${pc(cambio)}).`
          : '.'),
    })
  }

  const n = datos.nomina.resumen
  if (n.total) {
    obs.push({
      tono: 'neutro',
      titulo: `Corte «${datos.nomina.corte}»: ${n.pagados} de ${n.total} pagados`,
      texto: `${cop(n.montoPagado)} desembolsados y quedan ${n.pendientes} personas en NO`
        + (n.montoPendiente > 0
          ? `, de las cuales ${n.pendientes - n.pendientesSinMonto} ya suman ${cop(n.montoPendiente)}. Las otras ${n.pendientesSinMonto} todavía no tienen monto en el sheet.`
          : ', todavía sin monto asignado en el sheet.'),
    })
  }

  return obs
}

/** Color estable por categoría: la paleta no debe bailar entre vistas. */
export const COLOR_CATEGORIA: Record<string, string> = {
  'salarios': '#1a7de0',
  'videos': '#7c3aed',
  'edicion': '#db2777',
  'redaccion': '#d97706',
  'diseno': '#2e9e6b',
  'entretenimiento': '#ea580c',
  'estadistica e innovacion': '#0891b2',
}

const RESERVA = ['#64748b', '#94a3b8', '#0ea5e9', '#f43f5e']

export function colorCategoria(clave: string, i = 0): string {
  return COLOR_CATEGORIA[clave] ?? RESERVA[i % RESERVA.length]
}

export function etiquetaPeriodo(r: AnalisisGastos): string {
  if (r.primerMes < 0) return '—'
  if (r.primerMes === r.ultimoMes) return capital(MESES_GASTOS[r.ultimoMes])
  return `${capital(MESES_GASTOS[r.primerMes])}–${capital(MESES_GASTOS[r.ultimoMes])}`
}
