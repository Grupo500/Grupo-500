import { Router, Request, Response } from 'express'
import { Webhook } from 'svix'
import { prisma } from '../config/prisma'
import { logger } from '../utils/logger'

const router = Router()

// Este endpoint recibe raw body — se registra ANTES del JSON middleware en index.ts
router.post('/clerk', async (req: Request, res: Response) => {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) {
    logger.error('CLERK_WEBHOOK_SECRET no configurado')
    return res.status(500).json({ error: 'Webhook secret no configurado' })
  }

  // Headers requeridos por Svix para verificación
  const svixId        = req.headers['svix-id'] as string
  const svixTimestamp = req.headers['svix-timestamp'] as string
  const svixSignature = req.headers['svix-signature'] as string

  if (!svixId || !svixTimestamp || !svixSignature) {
    return res.status(400).json({ error: 'Headers de svix faltantes' })
  }

  // Verificar firma del webhook
  let event: any
  try {
    const wh = new Webhook(WEBHOOK_SECRET)
    event = wh.verify(req.body, {
      'svix-id':        svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    })
  } catch (err) {
    logger.error({ err }, 'Webhook signature inválida')
    return res.status(400).json({ error: 'Firma inválida' })
  }

  const { type, data } = event
  logger.info(`Webhook Clerk recibido: ${type}`)

  try {
    switch (type) {

      // ── Usuario creado en Clerk ──────────────────────────────────────────
      // IMPORTANTE: NO se crea el usuario en DB aquí. El acceso al sistema solo
      // se otorga cuando un ADMIN lo registra manualmente desde el módulo Usuarios.
      // Este evento solo actualiza datos si el usuario YA existe en DB (caso: admin
      // registró primero y luego el usuario completó su perfil en Clerk).
      case 'user.created': {
        const clerkId  = data.id as string
        const email    = data.email_addresses?.[0]?.email_address ?? ''
        const imageUrl = data.image_url ?? data.profile_image_url ?? null
        const nombre   = `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim()
                         || email.split('@')[0]

        // Solo actualizar si el admin ya lo registró en DB
        const user = await prisma.user.findUnique({ where: { clerkId } })
        if (user) {
          await prisma.user.update({
            where: { clerkId },
            data:  { imageUrl, nombre },
          })
          logger.info(`Datos sincronizados para usuario pre-registrado: ${email}`)
        } else {
          logger.info(`Registro en Clerk ignorado (no pre-registrado por admin): ${email}`)
        }
        break
      }

      // ── Usuario actualizado en Clerk ─────────────────────────────────────
      case 'user.updated': {
        const clerkId  = data.id as string
        const email    = data.email_addresses?.[0]?.email_address ?? ''
        const imageUrl = data.image_url ?? data.profile_image_url ?? null
        const nombre   = `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim() || undefined

        await prisma.user.updateMany({
          where: { clerkId },
          data:  { email, imageUrl, ...(nombre && { nombre }) },
        })
        logger.info(`Usuario actualizado en DB: ${email} (${clerkId})`)
        break
      }

      // ── Usuario eliminado en Clerk ───────────────────────────────────────
      case 'user.deleted': {
        const clerkId = data.id as string

        // Eliminar en cascada (Prisma maneja relaciones con onDelete: Cascade)
        await prisma.user.deleteMany({ where: { clerkId } })
        logger.info(`Usuario eliminado de DB: ${clerkId}`)
        break
      }

      default:
        logger.info(`Evento no manejado: ${type}`)
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    logger.error({ err }, 'Error procesando webhook')
    return res.status(500).json({ error: 'Error interno procesando evento' })
  }
})

export default router
