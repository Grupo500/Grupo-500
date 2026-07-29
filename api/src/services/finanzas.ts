import { prisma } from '../config/prisma'
import { diaColombia } from './ranking'

/**
 * Reglas del modelo financiero, en un solo lugar.
 *
 * Vienen del cuadro de indicadores que dirección mantiene en Excel. Dos de
 * ellas explican casi todas las diferencias entre pantallas cuando no se
 * respetan:
 *
 *  1. Una cuota posterior NO es una venta nueva. Hotmart cobra la cuota 2 de 3
 *     como una transacción más, pero la venta ocurrió una sola vez, el día de
 *     la cuota 1. Contarlas todas infla las ventas y el número de clientes.
 *
 *  2. "Vendido" y "cobrado" son cifras distintas. El valor contractual de una
 *     venta a cuotas es el total del plan; lo cobrado ese mes es una cuota.
 *     Mezclarlas hace que el mes cuadre con el Excel unas veces sí y otras no.
 */

export interface PagoFinanzas {
  monto: number
  montoNeto: number | null
  comisionHotmart: number | null
  comisionAsesor: number | null
  fechaPago: Date | null
  enPartes: boolean
  cuotaNumero: number | null
  cuotasTotal: number | null
  estudianteId: string
}

/** El cargo es el primero de su venta (o un pago único). */
export function esVentaNueva(p: { cuotaNumero: number | null }): boolean {
  return p.cuotaNumero === null || p.cuotaNumero <= 1
}

/**
 * Valor contractual: lo que el estudiante se comprometió a pagar en total.
 * En un plan de cuotas el cargo que llega es una sola cuota, así que el
 * compromiso es el cargo por el número de cuotas del plan.
 */
export function valorContractual(p: { monto: number; enPartes: boolean; cuotasTotal: number | null }): number {
  const cuotas = p.cuotasTotal ?? 1
  return p.enPartes && cuotas > 1 ? p.monto * cuotas : p.monto
}

/** Lo que queda por cobrar de esta venta: todas las cuotas menos la que ya entró. */
export function cuotasFuturasOriginadas(p: { monto: number; enPartes: boolean; cuotasTotal: number | null }): number {
  const cuotas = p.cuotasTotal ?? 1
  return p.enPartes && cuotas > 1 ? p.monto * (cuotas - 1) : 0
}

export interface TotalesPeriodo {
  ventasNuevas: number
  valorVendido: number
  facturacionCobrada: number
  netoRecibido: number
  costes: number
  porcentajeCostes: number | null
  clientesNuevos: number
  ticketPromedio: number | null
  ventasContado: number
  ventasPlazos: number
  porcentajeContado: number | null
  porcentajePlazos: number | null
  cuotasFuturasOriginadas: number
  cuotasCobradas: number
}

/**
 * Calcula los indicadores de flujo de un conjunto de pagos ya filtrado por
 * fecha. Recibe los pagos en memoria en vez de consultar: las pantallas piden
 * varios períodos a la vez (mes actual, mes anterior a igual día, acumulado) y
 * repetir la consulta por cada uno multiplica el tiempo de respuesta.
 */
export function totalesDe(pagos: PagoFinanzas[], primeraCompraPorEstudiante: Map<string, string>, desdeISO: string, hastaISO: string): TotalesPeriodo {
  let ventasNuevas = 0
  let valorVendido = 0
  let facturacionCobrada = 0
  let netoRecibido = 0
  let costes = 0
  let ventasContado = 0
  let ventasPlazos = 0
  let futuras = 0
  let cobradas = 0

  for (const p of pagos) {
    // Lo cobrado incluye las cuotas posteriores: ese dinero sí entró este mes.
    facturacionCobrada += p.monto
    netoRecibido += p.montoNeto ?? 0
    costes += (p.comisionHotmart ?? 0) + (p.comisionAsesor ?? 0)

    if (esVentaNueva(p)) {
      ventasNuevas++
      valorVendido += valorContractual(p)
      futuras += cuotasFuturasOriginadas(p)
      if (p.enPartes && (p.cuotasTotal ?? 1) > 1) ventasPlazos++
      else ventasContado++
    } else {
      cobradas += p.monto
    }
  }

  // Cliente nuevo es aquel cuya PRIMERA compra cae en el período. Un estudiante
  // que ya había comprado antes y vuelve no es nuevo, aunque genere una venta.
  let clientesNuevos = 0
  for (const primera of primeraCompraPorEstudiante.values()) {
    if (primera >= desdeISO && primera <= hastaISO) clientesNuevos++
  }

  return {
    ventasNuevas,
    valorVendido,
    facturacionCobrada,
    netoRecibido,
    costes,
    porcentajeCostes: facturacionCobrada > 0 ? costes / facturacionCobrada : null,
    clientesNuevos,
    ticketPromedio: ventasNuevas > 0 ? valorVendido / ventasNuevas : null,
    ventasContado,
    ventasPlazos,
    porcentajeContado: ventasNuevas > 0 ? ventasContado / ventasNuevas : null,
    porcentajePlazos: ventasNuevas > 0 ? ventasPlazos / ventasNuevas : null,
    cuotasFuturasOriginadas: futuras,
    cuotasCobradas: cobradas,
  }
}

/** Fecha de la primera compra de cada estudiante, en día colombiano. */
export async function primerasCompras(): Promise<Map<string, string>> {
  const filas = await prisma.cursoEstudiante.groupBy({
    by: ['estudianteId'],
    _min: { fechaCompra: true },
  })
  const mapa = new Map<string, string>()
  for (const f of filas) {
    const dia = diaColombia(f._min.fechaCompra ?? null)
    if (dia) mapa.set(f.estudianteId, dia)
  }
  return mapa
}

/** Trae los pagos liquidados de un rango, con lo mínimo que usan los cálculos. */
export async function pagosDelRango(desde: Date, hasta: Date): Promise<PagoFinanzas[]> {
  return prisma.pago.findMany({
    where: { estado: 'PAGADO', fechaPago: { gte: desde, lte: hasta } },
    select: {
      monto: true, montoNeto: true, comisionHotmart: true, comisionAsesor: true,
      fechaPago: true, enPartes: true, cuotaNumero: true, cuotasTotal: true,
      estudianteId: true,
    },
  })
}

/**
 * Variación relativa entre dos cifras.
 * Devuelve null cuando no hay base de comparación: es distinto de "0%".
 */
export function variacion(actual: number, anterior: number): number | null {
  if (anterior <= 0) return null
  return actual / anterior - 1
}

/**
 * Rango del mes anterior recortado al mismo día del mes.
 * Sin el recorte, el 21 de julio se compararía contra junio completo y el mes
 * en curso siempre parecería peor de lo que va.
 */
export function mesAnteriorAIgualDia(desde: Date, corte: Date): { desde: Date; hasta: Date } {
  const anteriorDesde = new Date(desde)
  anteriorDesde.setMonth(anteriorDesde.getMonth() - 1)

  const diaCorte = corte.getDate()
  // Un 31 no existe en todos los meses: si el mes anterior es más corto se
  // recorta a su último día en vez de desbordarse al siguiente.
  const ultimoDiaAnterior = new Date(anteriorDesde.getFullYear(), anteriorDesde.getMonth() + 1, 0).getDate()
  const anteriorHasta = new Date(
    anteriorDesde.getFullYear(),
    anteriorDesde.getMonth(),
    Math.min(diaCorte, ultimoDiaAnterior),
    23, 59, 59, 999,
  )
  return { desde: anteriorDesde, hasta: anteriorHasta }
}
