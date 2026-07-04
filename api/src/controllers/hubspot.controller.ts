import { Request, Response } from 'express'
import { logger } from '../utils/logger'
import { ApiResponse } from '../utils/response'
import { sincronizarLeadsHubspot } from '../services/hubspot.service'

// Sincronizar leads de HubSpot → HubspotLead (solo ADMIN)
export async function sincronizar(_req: Request, res: Response) {
  if (!process.env.HUBSPOT_API_KEY) {
    logger.error('[HubSpot] HUBSPOT_API_KEY no configurada')
    return res.status(503).json({ success: false, error: 'HubSpot API no configurada' })
  }

  logger.info('[HubSpot] Iniciando sincronización de leads...')
  try {
    const resultado = await sincronizarLeadsHubspot()
    logger.info(
      `[HubSpot] Sincronización completada: ${resultado.sincronizados} leads, ` +
      `${resultado.sinOwnerReconocido} sin owner reconocido (de ${resultado.contactosVistos} contactos)`
    )
    return ApiResponse.success(res, resultado)
  } catch (e: any) {
    logger.error(`[HubSpot] Error al sincronizar: ${e?.message}`)
    return res.status(500).json({ success: false, error: `Error al sincronizar HubSpot: ${e?.message}` })
  }
}
