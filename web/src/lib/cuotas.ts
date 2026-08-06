// Plan de cuotas de una compra a plazos de Hotmart (Smart Installment).
//
// Hotmart solo avisa cuando efectivamente cobra, así que las cuotas que aún no
// se han cobrado NO existen como registro en la base. Sin proyectarlas, una
// cuota que debió llegar y no llegó es invisible para la plataforma.
//
// Se derivan en vez de guardarse: el módulo de Finanzas cuenta filas de pago
// para calcular facturación, y sembrar cuotas que todavía no ocurrieron
// contaminaría esas cifras. Derivado también significa que el estado siempre
// está al día, sin depender de que un proceso las marque.

import { addMonths, differenceInCalendarDays, startOfDay } from 'date-fns'

export interface PagoParaPlan {
  monto: number
  estado: string
  enPartes?: boolean
  cuotaNumero?: number | null
  cuotasTotal?: number | null
  fechaPago?: string | null
  fechaVencimiento?: string
}

export interface CuotaEsperada {
  numero: number
  monto: number
  fechaEsperada: Date
  vencida: boolean
  /** Días transcurridos desde la fecha esperada. 0 si aún no vence. */
  diasAtraso: number
}

export interface PlanCuotas {
  /** Falso cuando la compra fue de contado: no hay nada que proyectar. */
  enPlazos: boolean
  cuotasTotal: number
  cuotasPagadas: number
  montoCuota: number
  /** Lo realmente cobrado: la suma de los cargos que sí ocurrieron. */
  pagado: number
  /** Las cuotas que faltan por cobrar, con su fecha esperada. */
  esperadas: CuotaEsperada[]
  pendiente: number
  mora: number
}

const VACIO: PlanCuotas = {
  enPlazos: false, cuotasTotal: 0, cuotasPagadas: 0, montoCuota: 0,
  pagado: 0, esperadas: [], pendiente: 0, mora: 0,
}

export function planDeCuotas(pagos: PagoParaPlan[], hoy: Date = new Date()): PlanCuotas {
  const enPartes = pagos
    .filter(p => p.estado === 'PAGADO' && p.enPartes && (p.cuotasTotal ?? 0) > 1)
    .sort((a, b) => (a.cuotaNumero ?? 0) - (b.cuotaNumero ?? 0))

  if (enPartes.length === 0) return VACIO

  const cuotasTotal = Math.max(...enPartes.map(p => p.cuotasTotal ?? 1))
  const ultima = enPartes[enPartes.length - 1]
  const ultimoNumero = ultima.cuotaNumero ?? enPartes.length

  // Se cuentan números distintos: un reintento de Hotmart puede dejar dos
  // filas con la misma cuota, y contarlas dos veces adelantaría el plan.
  const cuotasPagadas = new Set(enPartes.map(p => p.cuotaNumero ?? 0)).size
  const pagado = enPartes.reduce((s, p) => s + p.monto, 0)

  // El monto de la cuota más reciente: si hubo ajuste de precio, el que rige
  // para lo que viene es el último cobrado.
  const montoCuota = ultima.monto

  // La referencia para proyectar es cuándo se cobró la última cuota. Usar la
  // fecha de la primera acumularía el desfase de los reintentos de Hotmart.
  const base = ultima.fechaPago ?? ultima.fechaVencimiento
  const desde = base ? new Date(base) : null

  const inicioHoy = startOfDay(hoy)
  const esperadas: CuotaEsperada[] = []

  if (desde) {
    for (let n = ultimoNumero + 1; n <= cuotasTotal; n++) {
      const fechaEsperada = addMonths(startOfDay(desde), n - ultimoNumero)
      const vencida = fechaEsperada < inicioHoy
      esperadas.push({
        numero: n,
        monto: montoCuota,
        fechaEsperada,
        vencida,
        diasAtraso: vencida ? differenceInCalendarDays(inicioHoy, fechaEsperada) : 0,
      })
    }
  }

  return {
    enPlazos: true,
    cuotasTotal,
    cuotasPagadas,
    montoCuota,
    pagado,
    esperadas,
    pendiente: esperadas.reduce((s, c) => s + c.monto, 0),
    mora: esperadas.filter(c => c.vencida).reduce((s, c) => s + c.monto, 0),
  }
}
