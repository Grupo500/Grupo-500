import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { ApiResponse } from '../utils/response'
import { prisma } from '../config/prisma'
import { logger } from '../utils/logger'

const router = Router()

router.use(authenticate)

// Stub: registra el intento pero no envía real por ahora
router.post('/enviar', asyncHandler(async (req, res) => {
  const { cuotaId, telefono, mensaje } = req.body

  logger.info({ event: 'whatsapp_enviado_stub', cuotaId, telefono, mensaje })

  await prisma.reminderCobro.create({
    data: {
      cuotaId,
      fechaProgramada: new Date(),
      enviado: true,
      fechaEnvio: new Date(),
      mensajeEnviado: mensaje,
      numeroIntento: 1,
    },
  })

  return ApiResponse.success(res, { mensaje: 'Recordatorio registrado (modo stub).' })
}))

router.get('/historial', asyncHandler(async (req, res) => {
  const reminders = await prisma.reminderCobro.findMany({
    include: { cuota: { include: { financiamiento: { include: { estudiante: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return ApiResponse.success(res, reminders)
}))

export default router
