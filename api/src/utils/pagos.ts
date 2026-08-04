interface PagoConCuotas {
  monto: number
  enPartes: boolean
  cuotaNumero: number | null
  cuotasTotal: number | null
}

// Hotmart no reenvía un webhook por cada cuota de un Smart Installment — solo
// llega el primer cargo, y `cuotaNumero` se actualiza después vía el backfill
// que consulta la API de Hotmart. `monto` siempre es el valor de UNA cuota, no
// lo acumulado, así que hay que multiplicar por cuántas cuotas van pagadas.
export function montoPagadoPago(p: PagoConCuotas): number {
  if (p.enPartes && (p.cuotasTotal ?? 0) > 1) {
    return p.monto * (p.cuotaNumero ?? 1)
  }
  return p.monto
}
