// Envío de notificaciones push (Web Push / VAPID).
import webpush from 'web-push'
import { prisma } from '../config/prisma'
import { logger } from '../utils/logger'

const PUBLIC  = process.env.VAPID_PUBLIC_KEY
const PRIVATE = process.env.VAPID_PRIVATE_KEY
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:pregrupo500@gmail.com'

let configurado = false
function asegurarConfig(): boolean {
  if (configurado) return true
  if (!PUBLIC || !PRIVATE) {
    logger.warn('[Push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no configuradas — push deshabilitado')
    return false
  }
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE)
  configurado = true
  return true
}

export interface PushPayload {
  title: string
  body: string
  url?: string
}

// Envía una notificación a todos los dispositivos suscritos de un usuario.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!asegurarConfig()) return
  const subs = await prisma.pushSubscription.findMany({ where: { userId } })

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      )
    } catch (e: any) {
      // 404/410 → la suscripción ya no existe en el navegador; la borramos
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {})
      } else {
        logger.warn(`[Push] Error enviando a ${userId}: ${e?.message}`)
      }
    }
  }))
}
