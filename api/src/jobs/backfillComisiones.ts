// Completa el desglose de comisiones (en COP) de los pagos de Hotmart que
// aún no lo tengan. Corre en el servidor (Railway), donde la conexión a la
// BD es estable y la red a Hotmart es rápida.
//
//   montoNeto       = PRODUCER_USD  × TRM(fecha)
//   comisionAsesor  = AFFILIATE_USD × TRM(fecha)
//   comisionHotmart = monto(bruto COP) − montoNeto − comisionAsesor

import { prisma } from '../config/prisma'
import { logger } from '../utils/logger'
import { getComisiones } from '../services/hotmartComisiones'
import { getTRM } from '../services/trm'

export async function backfillComisiones(): Promise<void> {
  if (!process.env.HOTMART_CLIENT_ID || !process.env.HOTMART_CLIENT_SECRET) {
    logger.warn('[Comisiones] Hotmart no configurado — omitido')
    return
  }

  try {
    // Pagos de Hotmart que aún no tienen desglose
    const pagos = await prisma.pago.findMany({
      where: { referenciaPago: { not: null }, estado: 'PAGADO', comisionAsesor: null },
      select: { id: true, referenciaPago: true, fechaPago: true, monto: true },
    })
    if (pagos.length === 0) {
      logger.info('[Comisiones] Nada por completar — todo al día')
      return
    }

    // Traer comisiones de Hotmart agrupando por mes
    const meses = new Set<string>()
    for (const p of pagos) {
      const f = p.fechaPago ?? new Date()
      meses.add(`${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`)
    }
    const comis = new Map<string, { productorUSD: number; afiliadoUSD: number }>()
    for (const mes of meses) {
      const [y, m] = mes.split('-').map(Number)
      const desde = new Date(y, m - 1, 1).getTime()
      const hasta = new Date(y, m, 0, 23, 59, 59).getTime()
      const mapa = await getComisiones(desde, hasta)
      for (const [tx, v] of mapa) comis.set(tx, v)
    }

    let ok = 0
    for (const p of pagos) {
      const c = comis.get(p.referenciaPago!)
      if (!c) continue
      const trm = await getTRM(p.fechaPago ?? new Date())
      if (!trm) continue

      const montoNeto       = Math.round(c.productorUSD * trm)
      const comisionAsesor  = Math.round(c.afiliadoUSD * trm)
      const comisionHotmart = Math.max(0, Math.round(p.monto - montoNeto - comisionAsesor))

      await prisma.pago.update({
        where: { id: p.id },
        data: { montoNeto, comisionAsesor, comisionHotmart, trm },
      })
      ok++
    }

    logger.info(`[Comisiones] ${ok} de ${pagos.length} pago(s) completados con desglose`)
  } catch (e: any) {
    logger.error(`[Comisiones] Error: ${e?.message}`)
  }
}
