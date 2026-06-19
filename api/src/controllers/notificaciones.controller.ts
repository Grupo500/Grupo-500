import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'

// Guarda (o actualiza) la suscripción push del navegador del usuario logueado.
export async function suscribir(req: Request, res: Response) {
  const userId = req.userId
  if (!userId) return res.status(401).json({ success: false, error: 'No autenticado' })

  const { endpoint, keys } = req.body ?? {}
  const p256dh = keys?.p256dh
  const auth   = keys?.auth
  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ success: false, error: 'Suscripción inválida' })
  }

  await prisma.pushSubscription.upsert({
    where:  { endpoint },
    update: { userId, p256dh, auth },
    create: { userId, endpoint, p256dh, auth },
  })

  return ApiResponse.success(res, { ok: true })
}

// Elimina una suscripción (al desactivar notificaciones).
export async function desuscribir(req: Request, res: Response) {
  const { endpoint } = req.body ?? {}
  if (endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } })
  }
  return ApiResponse.success(res, { ok: true })
}
