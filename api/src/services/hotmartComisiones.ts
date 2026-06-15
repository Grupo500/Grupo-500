// Servicio de comisiones de Hotmart.
// Trae, por transacción, cuánto recibió el productor (PRODUCER) y el
// afiliado/asesor (AFFILIATE), en USD. La conversión a COP y el cálculo
// de la comisión de Hotmart se hace en quien consume este servicio.

import { getAccessToken } from '../controllers/hotmart.controller'
import { logger } from '../utils/logger'

export interface ComisionTx {
  productorUSD: number
  afiliadoUSD: number
}

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
  } while (page && guard < 100)
  return items
}

/**
 * Devuelve un mapa transacción -> comisiones (USD) para el rango dado.
 * @param desde timestamp en ms
 * @param hasta timestamp en ms
 */
export async function getComisiones(desde: number, hasta: number): Promise<Map<string, ComisionTx>> {
  const token = await getAccessToken()
  const items = await fetchAll(
    token,
    `https://developers.hotmart.com/payments/api/v1/sales/commissions?start_date=${desde}&end_date=${hasta}`
  )

  const mapa = new Map<string, ComisionTx>()
  for (const it of items) {
    const tx = it.transaction
    if (!tx) continue
    let productorUSD = 0
    let afiliadoUSD = 0
    for (const c of it.commissions ?? []) {
      const val = c.commission?.value ?? 0
      if (c.source === 'PRODUCER')  productorUSD += val
      if (c.source === 'AFFILIATE') afiliadoUSD  += val
    }
    mapa.set(tx, { productorUSD, afiliadoUSD })
  }
  logger.info(`[Comisiones] ${mapa.size} transacciones con comisión en el rango`)
  return mapa
}
