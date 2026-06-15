// Reconciliación automática de asesores.
//
// Red de seguridad: aunque el webhook no capture el afiliado de una venta,
// este proceso revisa las ventas recientes contra la API de Hotmart (que sí
// trae el email del afiliado de forma confiable) y completa la atribución
// que haya quedado sin asesor.

import { prisma } from '../config/prisma'
import { logger } from '../utils/logger'
import { getAccessToken } from '../controllers/hotmart.controller'

const DIAS_ATRAS = 3 // ventana de revisión

async function fetchAll(token: string, url: string): Promise<any[]> {
  const items: any[] = []
  let page: string | undefined
  let guard = 0
  do {
    const u = url + (url.includes('?') ? '&' : '?') + 'max_results=50' + (page ? `&page_token=${page}` : '')
    const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) break
    const json = (await res.json()) as any
    items.push(...(json.items ?? []))
    page = json.page_info?.next_page_token
    guard++
  } while (page && guard < 50)
  return items
}

export async function reconciliarAsesores(): Promise<void> {
  if (!process.env.HOTMART_CLIENT_ID || !process.env.HOTMART_CLIENT_SECRET) {
    logger.warn('[Reconciliación] Hotmart no configurado — omitida')
    return
  }

  try {
    const token = await getAccessToken()

    const ahora = Date.now()
    const desde = ahora - DIAS_ATRAS * 24 * 60 * 60 * 1000

    // Afiliados por transacción en la ventana reciente
    const users = await fetchAll(
      token,
      `https://developers.hotmart.com/payments/api/v1/sales/users?transaction_status=APPROVED&start_date=${desde}&end_date=${ahora}`
    )
    const txAfiliado = new Map<string, string>()
    for (const u of users) {
      const a = u.users?.find((x: any) => x.role === 'AFFILIATE')?.user
      if (a?.email && u.transaction) txAfiliado.set(u.transaction, a.email.toLowerCase().trim())
    }
    if (txAfiliado.size === 0) {
      logger.info('[Reconciliación] Sin afiliados en la ventana reciente')
      return
    }

    // Pagos recientes SIN asesor que sí tienen afiliado en Hotmart
    const pagos = await prisma.pago.findMany({
      where: {
        asesorId: null,
        referenciaPago: { in: [...txAfiliado.keys()] },
      },
      select: { id: true, referenciaPago: true, estudianteId: true },
    })
    if (pagos.length === 0) {
      logger.info('[Reconciliación] Nada por atribuir — todo al día')
      return
    }

    // Mapa email afiliado -> asesor
    const asesores = await prisma.asesor.findMany({ select: { id: true, email: true } })
    const emailAsesor = new Map(asesores.map(a => [a.email.toLowerCase().trim(), a.id]))

    let atribuidos = 0
    const sinAsesor = new Set<string>()

    for (const p of pagos) {
      const email = txAfiliado.get(p.referenciaPago!)
      if (!email) continue
      const asesorId = emailAsesor.get(email)
      if (!asesorId) { sinAsesor.add(email); continue }
      await prisma.pago.update({ where: { id: p.id }, data: { asesorId } })
      // Completar el asesor del estudiante solo si aún no tiene uno
      await prisma.estudiante.updateMany({ where: { id: p.estudianteId, asesorId: null }, data: { asesorId } })
      atribuidos++
    }

    logger.info(`[Reconciliación] ${atribuidos} venta(s) atribuida(s)`)
    if (sinAsesor.size > 0) {
      logger.warn(`[Reconciliación] Afiliados sin asesor en la app (crear manualmente): ${[...sinAsesor].join(', ')}`)
    }
  } catch (e: any) {
    logger.error(`[Reconciliación] Error: ${e?.message}`)
  }
}
