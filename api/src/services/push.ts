// Envío de notificaciones push (Web Push / VAPID).
// Si las llaves VAPID no están configuradas, el servicio queda inactivo
// silenciosamente (no rompe nada).

import webpush from 'web-push'
import { prisma } from '../config/prisma'
import { logger } from '../utils/logger'

const PUBLIC  = process.env.VAPID_PUBLIC_KEY
const PRIVATE = process.env.VAPID_PRIVATE_KEY
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:pregrupo500@gmail.com'

let configurado = false
if (PUBLIC && PRIVATE) {
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE)
  configurado = true
} else {
  logger.warn('[Push] VAPID no configurado — notificaciones push desactivadas')
}

export interface PushPayload {
  title: string
  body:  string
  url?:  string
}

/** Envía una notificación push a todos los usuarios ADMIN. */
export async function sendPushToAdmins(payload: PushPayload): Promise<void> {
  if (!configurado) return
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
  await Promise.all(admins.map(a => sendPushToUser(a.id, payload)))
}

/** Envía una notificación push a todos los asesores (rol VENDEDOR). */
export async function sendPushToAsesores(payload: PushPayload): Promise<void> {
  if (!configurado) return
  const users = await prisma.user.findMany({ where: { role: 'VENDEDOR' }, select: { id: true } })
  await Promise.all(users.map(u => sendPushToUser(u.id, payload)))
}

/** Envía una notificación push a todas las suscripciones de un usuario. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!configurado) return

  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subs.length === 0) return

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      )
    } catch (e: any) {
      // 404/410 = suscripción expirada o revocada → eliminarla
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { endpoint: s.endpoint } }).catch(() => {})
      } else {
        logger.warn(`[Push] Error enviando a ${userId}: ${e?.message}`)
      }
    }
  }))
}
