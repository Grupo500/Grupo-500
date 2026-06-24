import { Router, Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { asyncHandler } from '../middleware/errorHandler'
import { logger } from '../utils/logger'
import { emailKey } from '../services/ranking'

const router = Router()

// ============================================================
// Webhook de Trengo — leads en tiempo real.
// Trengo llama aquí cada vez que una conversación se ASIGNA a un asesor.
// Persistimos { ticketId, agentEmail } y mantenemos firstAssignedAt
// para distinguir un lead nuevo de una reasignación.
//
// URL pública:
//   https://api-production-79572.up.railway.app/api/trengo/webhook?secreto=<TRENGO_WEBHOOK_SECRET>
// ============================================================

type Cuerpo = Record<string, unknown>

function leerString(c: Cuerpo, ...keys: string[]): string {
  for (const k of keys) {
    const v = c[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

// Trengo verifica la URL con un GET de salud
router.get('/webhook', (_req: Request, res: Response) => {
  res.json({ ok: true, mensaje: 'Webhook de Trengo activo' })
})

router.post('/webhook', asyncHandler(async (req: Request, res: Response) => {
  const secretoEsperado = process.env.TRENGO_WEBHOOK_SECRET
  if (!secretoEsperado) {
    logger.error('TRENGO_WEBHOOK_SECRET no configurado — webhook deshabilitado')
    return res.status(503).json({ error: 'Webhook deshabilitado' })
  }
  if (req.query.secreto !== secretoEsperado) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  const cuerpo = (req.body ?? {}) as Cuerpo
  const ticketId   = leerString(cuerpo, 'ticket_id', 'ticketId', 'id')
  const emailCrudo = leerString(cuerpo, 'user_email', 'userEmail', 'agent_email', 'agentEmail')

  // Solo nos interesa cuando hay conversación + asesor (TICKET_ASSIGNED)
  if (!ticketId || !emailCrudo) {
    return res.json({ ok: true, ignorado: true })
  }

  const email = emailKey(emailCrudo)

  // Buscar asignación anterior para no contar doble
  const previo = await prisma.trengoTicket.findUnique({
    where: { ticketId },
    select: { agentEmail: true },
  })

  if (previo?.agentEmail === email) {
    return res.json({ ok: true, sinCambio: true })
  }

  // Upsert: si es la primera vez, firstAssignedAt = now (default).
  // Si ya existía, conservamos firstAssignedAt y solo actualizamos agentEmail.
  await prisma.trengoTicket.upsert({
    where: { ticketId },
    create: { ticketId, agentEmail: email },
    update: { agentEmail: email },
  })

  logger.info({ ticketId, email, esNuevo: !previo }, 'Trengo lead registrado')
  return res.json({ ok: true, esNuevo: !previo })
}))

export default router
