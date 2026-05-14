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
      case 'user.created': {
        const clerkId  = data.id as string
        const email    = data.email_addresses?.[0]?.email_address ?? ''
        const telefono = data.phone_numbers?.[0]?.phone_number ?? ''
        const nombre   = `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim()
                         || email.split('@')[0]

        // Evitar duplicados (por si el auto-sync del middleware ya lo creó)
        let user = await prisma.user.findUnique({ where: { clerkId } })

        if (!user) {
          user = await prisma.user.create({
            data: { clerkId, email, role: 'VENDEDOR' },
          })
          logger.info(`Usuario creado en DB: ${email} (${clerkId})`)
        }

        // Crear perfil Asesor si no existe — todos los usuarios son asesores por defecto
        const asesorExiste = await prisma.asesor.findUnique({ where: { userId: user.id } })
        if (!asesorExiste) {
          await prisma.asesor.create({
            data: {
              userId:   user.id,
              nombre:   nombre.charAt(0).toUpperCase() + nombre.slice(1),
              email:    user.email,
              telefono: telefono || '000-000-0000',
            },
          })
          logger.info(`Perfil Asesor creado para: ${email}`)
        }
        break
      }

      // ── Usuario actualizado en Clerk ─────────────────────────────────────
      case 'user.updated': {
        const clerkId = data.id as string
        const email   = data.email_addresses?.[0]?.email_address ?? ''

        await prisma.user.updateMany({
          where: { clerkId },
          data:  { email },
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
