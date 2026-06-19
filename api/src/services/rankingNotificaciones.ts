// Evalúa el ranking de ventas del mes y notifica (push) a los asesores que
// fueron rebasados respecto al snapshot guardado. Se llama tras cada venta.
//
// Determinístico: ordena por ventas desc y, en empate, por id, para que la
// posición no oscile entre corridas con los mismos datos.

import { prisma } from '../config/prisma'
import { logger } from '../utils/logger'
import { sendPushToUser, sendPushToAdmins } from './push'

export async function evaluarRankingYNotificar(): Promise<void> {
  const hoy       = new Date()
  const mesKey    = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const finMes    = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59)

  // Ventas del mes por asesor
  const pagosMes = await prisma.pago.groupBy({
    by: ['asesorId'],
    where: { estado: 'PAGADO', fechaPago: { gte: inicioMes, lte: finMes }, asesorId: { not: null } },
    _sum: { monto: true },
  })

  // Ranking determinístico (ventas desc, id como desempate)
  const ranking = pagosMes
    .map(p => ({ asesorId: p.asesorId as string, ventas: p._sum.monto ?? 0 }))
    .sort((a, b) => b.ventas - a.ventas || a.asesorId.localeCompare(b.asesorId))

  if (ranking.length === 0) return

  // Snapshot previo de cada asesor
  const asesores = await prisma.asesor.findMany({
    select: { id: true, nombre: true, userId: true, posicionRanking: true, posicionMes: true },
  })
  const infoPorId = new Map(asesores.map(a => [a.id, a]))

  await Promise.all(ranking.map(async (r, idx) => {
    const nuevaPos = idx + 1
    const info     = infoPorId.get(r.asesorId)
    if (!info) return

    const mismaVentana = info.posicionMes === mesKey
    const anterior     = mismaVentana ? info.posicionRanking : null

    // Notificar solo si bajó de posición (lo rebasaron) y tiene ventas este mes
    if (anterior != null && nuevaPos > anterior && r.ventas > 0) {
      let title = '📊 Cambio en el ranking'
      let body: string

      if (anterior === 1) {
        title = '⚠️ Perdiste el primer lugar'
        body  = `Otro asesor te superó. Ahora estás en el puesto #${nuevaPos}.`
      } else if (anterior <= 3 && nuevaPos > 3) {
        title = '⚠️ Saliste del podio'
        body  = `Bajaste al puesto #${nuevaPos}. ¡Recupera tu lugar en el top 3!`
      } else {
        body  = `Te superaron: pasaste del puesto #${anterior} al #${nuevaPos}.`
      }

      await sendPushToUser(info.userId, { title, body, url: '/dashboard' })
    }
  }))

  // ── Notificaciones al ADMIN: nuevo #1 / cambio de podio ──
  // Estado previo (snapshot guardado de este mes)
  const prevMes  = asesores.filter(a => a.posicionMes === mesKey && a.posicionRanking != null)
  const prevTop1 = prevMes.find(a => a.posicionRanking === 1)?.id ?? null
  const prevTop3 = prevMes
    .filter(a => (a.posicionRanking as number) <= 3)
    .sort((a, b) => (a.posicionRanking as number) - (b.posicionRanking as number))
    .map(a => a.id)

  const newTop1 = ranking[0]?.asesorId ?? null
  const newTop3 = ranking.slice(0, 3).map(r => r.asesorId)
  const nombreDe = (id: string | null) => (id ? infoPorId.get(id)?.nombre ?? 'Asesor' : '')

  if (newTop1 && newTop1 !== prevTop1) {
    await sendPushToAdmins({
      title: '🏆 Nuevo líder del ranking',
      body:  `${nombreDe(newTop1)} tomó el primer lugar del mes.`,
      url:   '/dashboard',
    })
  } else if (prevTop3.length > 0 && JSON.stringify(newTop3) !== JSON.stringify(prevTop3)) {
    const lista = newTop3.map((id, i) => `${i + 1}. ${nombreDe(id)}`).join('   ')
    await sendPushToAdmins({
      title: '📊 Cambio de podio',
      body:  lista,
      url:   '/dashboard',
    })
  }

  // Actualizar snapshot de todos los del ranking
  await Promise.all(ranking.map((r, idx) =>
    prisma.asesor.update({
      where: { id: r.asesorId },
      data:  { posicionRanking: idx + 1, posicionMes: mesKey },
    }).catch((e: any) => logger.warn(`[Ranking] No se pudo actualizar snapshot de ${r.asesorId}: ${e?.message}`))
  ))
}
