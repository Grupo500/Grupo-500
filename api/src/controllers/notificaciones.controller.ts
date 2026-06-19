import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'

// Guarda (o actualiza) la suscripción push del usuario autenticado.
export async function suscribir(req: Request, res: Response) {
  const userId = req.userId!
  const { endpoint, keys } = req.body ?? {}

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ success: false, error: 'Suscripción inválida' })
  }

  await prisma.pushSubscription.upsert({
    where:  { endpoint },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth },
  })

  return ApiResponse.success(res, { ok: true })
}

// Elimina la suscripción (al desactivar notificaciones o cerrar sesión).
export async function desuscribir(req: Request, res: Response) {
  const { endpoint } = req.body ?? {}
  if (endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } })
  }
  return ApiResponse.success(res, { ok: true })
}
