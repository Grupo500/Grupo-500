/**
 * La papelera de Apuntes: lo borrado se recupera durante 30 días; después
 * se va de verdad. Corre una vez al día desde index.ts.
 */

import { prisma } from '../config/prisma'
import { logger } from '../utils/logger'

const DIAS = 30

export async function purgarApuntes() {
  try {
    const limite = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000)
    const { count } = await prisma.apunte.deleteMany({ where: { eliminadoEn: { lt: limite } } })
    if (count > 0) logger.info(`[Apuntes] Papelera: ${count} apunte(s) con más de ${DIAS} días eliminados del todo`)
  } catch (e: any) {
    logger.error(`[Apuntes] Purga de papelera: ${e?.message ?? e}`)
  }
}
