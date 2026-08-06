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
