// Detecta cambios en el ranking de asesores del mes y notifica (push) al
// asesor que pierde posición: lo superaron, salió del podio o perdió el #1.
import { prisma } from '../config/prisma'
import { logger } from '../utils/logger'
import { sendPushToUser } from './push'

export async function evaluarRankingYNotificar(): Promise<void> {
  try {
    const hoy = new Date()
    const mes    = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const fin    = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59)

    const asesores = await prisma.asesor.findMany({
      select: { id: true, nombre: true, userId: true, posicionRanking: true, posicionMes: true },
    })

    // Ventas del mes por asesor
    const pagos = await prisma.pago.groupBy({
      by: ['asesorId'],
      where: { estado: 'PAGADO', fechaPago: { gte: inicio, lte: fin }, asesorId: { not: null } },
      _sum: { monto: true },
    })
    const ventas = new Map<string, number>()
    for (const p of pagos) ventas.set(p.asesorId as string, p._sum.monto ?? 0)

    // Orden determinista: ventas desc, desempate por id (evita rebotes por empates)
    const orden = [...asesores].sort((a, b) =>
      (ventas.get(b.id) ?? 0) - (ventas.get(a.id) ?? 0) || a.id.localeCompare(b.id)
    )
    const nuevoRank = new Map<string, number>()
    orden.forEach((a, i) => nuevoRank.set(a.id, i + 1))

    for (const a of orden) {
      const nuevo     = nuevoRank.get(a.id)!
      const mismoMes  = a.posicionMes === mes
      const anterior  = mismoMes ? a.posicionRanking : null
      const misVentas = ventas.get(a.id) ?? 0

      // Notificar solo si el asesor compite (tiene ventas) y BAJÓ de posición
      if (anterior != null && nuevo > anterior && misVentas > 0 && a.userId) {
        const arriba = orden[nuevo - 2]          // quien quedó justo encima
        let title = '📉 Te superaron en el ranking'
        let body: string

        if (anterior === 1) {
          const lider = orden[0]
          title = '👑 Perdiste el primer lugar'
          body  = `${lider?.nombre ?? 'Otro asesor'} es ahora el #1. Vas en el puesto #${nuevo}.`
        } else if (anterior <= 3 && nuevo > 3) {
          title = '🏆 Saliste del podio'
          body  = `Bajaste al puesto #${nuevo}.${arriba ? ` ${arriba.nombre} te superó.` : ''}`
        } else {
          body  = `${arriba ? arriba.nombre : 'Otro asesor'} te superó. Ahora vas en el puesto #${nuevo}.`
        }

        await sendPushToUser(a.userId, { title, body, url: '/dashboard' })
      }

      // Guardar el snapshot de posición
      if (!mismoMes || anterior !== nuevo) {
        await prisma.asesor.update({ where: { id: a.id }, data: { posicionRanking: nuevo, posicionMes: mes } })
      }
    }
  } catch (e: any) {
    logger.error(`[Ranking] Error evaluando notificaciones: ${e?.message}`)
  }
}
