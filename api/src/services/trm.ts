// Servicio de TRM (Tasa Representativa del Mercado) oficial de Colombia.
// Fuente: datos.gov.co (dataset 32sa-8pi3). Convierte USD → COP usando la
// tasa vigente en la fecha de cada venta.

import { logger } from '../utils/logger'

const BASE = 'https://www.datos.gov.co/resource/32sa-8pi3.json'

// Caché en memoria por fecha (YYYY-MM-DD) para no repetir consultas
const cache = new Map<string, number>()

function ymd(date: Date): string {
  // En hora de Colombia (TZ del proceso ya es America/Bogota)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * Devuelve la TRM (COP por USD) vigente en la fecha dada, o null si no se pudo obtener.
 */
export async function getTRM(date: Date): Promise<number | null> {
  const key = ymd(date)
  if (cache.has(key)) return cache.get(key)!

  const fecha = `${key}T00:00:00`
  const where = encodeURIComponent(`vigenciadesde <= '${fecha}' AND vigenciahasta >= '${fecha}'`)
  const url = `${BASE}?$where=${where}&$limit=1`

  try {
    const res = await fetch(url)
    if (!res.ok) {
      logger.warn(`[TRM] Respuesta ${res.status} para ${key}`)
      return null
    }
    const data = (await res.json()) as { valor?: string }[]
    const valor = data?.[0]?.valor ? parseFloat(data[0].valor) : null
    if (valor && valor > 0) {
      cache.set(key, valor)
      return valor
    }
    // Fallback: tomar la TRM más reciente anterior a la fecha
    const whereBack = encodeURIComponent(`vigenciadesde <= '${fecha}'`)
    const urlBack = `${BASE}?$where=${whereBack}&$order=vigenciadesde DESC&$limit=1`
    const resBack = await fetch(urlBack)
    if (resBack.ok) {
      const back = (await resBack.json()) as { valor?: string }[]
      const v = back?.[0]?.valor ? parseFloat(back[0].valor) : null
      if (v && v > 0) { cache.set(key, v); return v }
    }
    logger.warn(`[TRM] Sin TRM para ${key}`)
    return null
  } catch (e: any) {
    logger.error(`[TRM] Error al consultar ${key}: ${e?.message}`)
    return null
  }
}
