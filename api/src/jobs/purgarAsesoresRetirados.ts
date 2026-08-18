// ============================================================
// Purga definitiva de asesores retirados (decisión de Hotman,
// 18-ago-2026): al retirar a alguien (Asesor.activo = false) se
// guarda retiradoEn y se conserva 60 días por si vuelve. Pasado
// ese plazo, este job borra su cuenta completa.
//
// Qué pasa con su rastro: el User se elimina y el Asesor cae en
// cascada; los pagos y estudiantes que tenía atribuidos QUEDAN
// (los totales históricos no cambian) pero pasan a "sin asesor",
// igual que una venta orgánica. Por eso el plazo de gracia: la
// atribución individual no se puede reconstruir después.
// ============================================================
import { prisma } from '../config/prisma'
import { logger } from '../utils/logger'

const DIAS_GRACIA = 60

export async function purgarAsesoresRetirados(): Promise<void> {
  const limite = new Date(Date.now() - DIAS_GRACIA * 24 * 60 * 60 * 1000)
  const vencidos = await prisma.asesor.findMany({
    where: { activo: false, retiradoEn: { not: null, lt: limite } },
    select: { id: true, userId: true, nombre: true, retiradoEn: true },
  })
  if (vencidos.length === 0) return

  for (const a of vencidos) {
    try {
      // Borrar el User arrastra el Asesor (onDelete: Cascade); las relaciones
      // opcionales (pagos, estudiantes) quedan con el campo en null.
      await prisma.user.delete({ where: { id: a.userId } })
      logger.info(`[Purga] Asesor retirado eliminado tras ${DIAS_GRACIA} días: ${a.nombre} (retirado el ${a.retiradoEn?.toISOString().slice(0, 10)})`)
    } catch (e: any) {
      logger.error(`[Purga] No se pudo eliminar a ${a.nombre}: ${e?.message}`)
    }
  }
}
