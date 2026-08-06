interface PagoConCuotas {
  monto: number
  enPartes: boolean
  cuotaNumero: number | null
  cuotasTotal: number | null
}

// Cada fila de pago es un cargo real que ya ocurrió, incluidas las cuotas de un
// Smart Installment: Hotmart manda un webhook por cada cobro y cada uno trae su
// propia referencia de transacción.
//
// Antes esto multiplicaba el monto por el número de cuota, asumiendo que había
// una sola fila por compra que se iba actualizando. Con una fila por cuota, esa
// multiplicación contaba de más: dos cuotas de 226.900 sumaban 680.700 en vez
// de 453.800. Verificado contra producción: 267 filas en partes, 267
// referencias distintas, ningún caso del modelo antiguo.
export function montoPagadoPago(p: PagoConCuotas): number {
  return p.monto
}

// Cuánto puede desviarse un abono del valor de la cuota para seguir
// considerándose esa cuota. Hotmart convierte de USD y la TRM cambia día a
// día, así que el mismo plan cobra montos que difieren en algunos pesos.
const TOLERANCIA_MONTO = 0.15

export interface FilaPlan {
  monto: number
  enPartes: boolean
  cuotaNumero: number | null
  cuotasTotal: number | null
  fechaPago: Date | null
}

/**
 * Una cuota del Smart Installment se puede terminar pagando por fuera de
 * Hotmart (Nequi, transferencia) y registrarse a mano en la ficha del
 * estudiante. Ese pago entra sin las marcas de cuota, así que ninguna pantalla
 * lo reconoce como parte del plan: el estudiante sigue viéndose "1 de 2" y en
 * mora aunque ya no deba nada.
 *
 * Esto decide si un abono salda la(s) siguiente(s) cuota(s) de un plan abierto,
 * para poder marcarlo en el momento de registrarlo. Marcar el dato en el origen
 * —en vez de que cada pantalla adivine— es lo que hace que la ficha, el módulo
 * de Cuotas y los reportes digan lo mismo sin repetir la lógica en cada una.
 *
 * Se exige que el monto sea múltiplo del valor de la cuota y que el abono sea
 * posterior al último cobro del plan: un estudiante con un plan abierto también
 * puede comprar OTRO curso de contado, y ese pago no debe absorberse dentro del
 * plan (verificado en producción: de 9 estudiantes con un pago suelto, 7 eran
 * exactamente eso, una compra aparte).
 *
 * Devuelve `null` cuando no hay plan abierto o el abono no encaja: ante la duda
 * el pago se queda como está, que es el estado seguro.
 */
export function cuotaQueSalda(
  filas: FilaPlan[],
  abono: { monto: number; fecha: Date },
): { cuotaNumero: number; cuotasTotal: number } | null {
  const delPlan = filas.filter(f => f.enPartes && (f.cuotasTotal ?? 0) > 1)
  if (delPlan.length === 0) return null

  const cuotasTotal = Math.max(...delPlan.map(f => f.cuotasTotal ?? 1))

  // La cuota más avanzada marca dónde va el plan y cuánto vale cada cobro.
  const ultima = [...delPlan].sort((a, b) => {
    const ca = a.cuotaNumero ?? 0, cb = b.cuotaNumero ?? 0
    if (ca !== cb) return cb - ca
    return (b.fechaPago?.getTime() ?? 0) - (a.fechaPago?.getTime() ?? 0)
  })[0]

  const ultimoNumero = ultima.cuotaNumero ?? 1
  const restantes    = cuotasTotal - ultimoNumero
  if (restantes <= 0) return null          // el plan ya está completo
  if (ultima.monto <= 0) return null       // sin valor de cuota no hay con qué comparar

  // Un pago anterior al último cobro del plan no puede ser la cuota siguiente.
  if (ultima.fechaPago && abono.fecha.getTime() < ultima.fechaPago.getTime()) return null

  // Cuántas cuotas cubre el abono: normalmente una, pero un cliente puede
  // ponerse al día pagando varias juntas.
  const cuantas = Math.round(abono.monto / ultima.monto)
  if (cuantas < 1 || cuantas > restantes) return null

  const esperado = cuantas * ultima.monto
  if (Math.abs(abono.monto - esperado) > esperado * TOLERANCIA_MONTO) return null

  return { cuotaNumero: ultimoNumero + cuantas, cuotasTotal }
}
