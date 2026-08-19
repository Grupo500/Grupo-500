// ============================================================
// Emparejador pago → curso.
//
// Un pago de Hotmart no dice a qué curso del estudiante pertenece.
// El criterio viejo era "el curso con fecha de compra más cercana",
// y con dos cursos comprados el MISMO día empataba y ambos pagos
// caían al primero: el otro curso quedaba "sin ningún abono" y la
// app inventaba deudores (Landon Romero pagó sus dos cursos
// completos y aparecía debiendo $370.000).
//
// El criterio nuevo: el MONTO manda, la fecha desempata.
//   1. Un pago que calza con el total de un curso (de contado, o
//      cuota × cuotasTotal) pertenece a ese curso.
//   2. Si nada calza, gana el curso más cercano en fecha… pero un
//      curso que ya recibió su total completo pierde el empate:
//      no se le siguen apilando pagos que claramente son del otro.
// ============================================================

export type CursoAsignable = {
  /** Total esperado del curso: precioAcordado ?? precio de lista. */
  total: number | null
  fechaCompra: Date | null
}

export type PagoAsignable = {
  monto: number
  fechaPago: Date | null
  enPartes?: boolean
  cuotasTotal?: number | null
}

const TOLERANCIA = 0.02 // 2%: redondeos de conversión de divisa

function calza(p: PagoAsignable, c: CursoAsignable): boolean {
  if (!c.total) return false
  const margen = c.total * TOLERANCIA
  if (Math.abs(p.monto - c.total) <= margen) return true // pago de contado
  const cuotas = p.cuotasTotal ?? 0
  if (p.enPartes && cuotas > 1 && Math.abs(p.monto * cuotas - c.total) <= margen) return true
  return false
}

/**
 * Devuelve, para cada pago (en el orden recibido), el índice del curso al que
 * pertenece. Los pagos se procesan en orden cronológico por dentro para que
 * "este curso ya está lleno" tenga sentido, pero el resultado respeta el
 * orden de entrada.
 */
export function asignarPagosACursos(cursos: CursoAsignable[], pagos: PagoAsignable[]): number[] {
  if (cursos.length <= 1) return pagos.map(() => 0)

  const acumulado = cursos.map(() => 0)
  const resultado = new Array<number>(pagos.length).fill(0)

  const orden = pagos
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.fechaPago?.getTime() ?? 0) - (b.p.fechaPago?.getTime() ?? 0))

  for (const { p, i } of orden) {
    // 1. Calce por monto. Si calza con varios (dos cursos del mismo precio),
    //    gana el que aún no ha recibido su total.
    const fuertes = cursos
      .map((c, idx) => ({ c, idx }))
      .filter(({ c }) => calza(p, c))
      .sort((a, b) => {
        const llenoA = a.c.total ? acumulado[a.idx] + p.monto > a.c.total * (1 + TOLERANCIA) : false
        const llenoB = b.c.total ? acumulado[b.idx] + p.monto > b.c.total * (1 + TOLERANCIA) : false
        if (llenoA !== llenoB) return llenoA ? 1 : -1
        return 0
      })

    let elegido: number
    if (fuertes.length > 0) {
      elegido = fuertes[0].idx
    } else {
      // 2. Fecha más cercana; a igualdad, el curso con cupo libre.
      let mejor = 0
      let mejorScore = Infinity
      const t = p.fechaPago?.getTime() ?? 0
      cursos.forEach((c, idx) => {
        const dist = c.fechaCompra ? Math.abs(c.fechaCompra.getTime() - t) : Number.MAX_SAFE_INTEGER / 4
        const lleno = c.total ? acumulado[idx] + p.monto > c.total * (1 + TOLERANCIA) : false
        const score = dist + (lleno ? Number.MAX_SAFE_INTEGER / 2 : 0)
        if (score < mejorScore) { mejorScore = score; mejor = idx }
      })
      elegido = mejor
    }

    acumulado[elegido] += p.monto
    resultado[i] = elegido
  }

  return resultado
}
