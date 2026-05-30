import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireRole } from '../middleware/auth'
import { uploadFirma } from '../middleware/upload'
import { getFirmas, subirFirma } from '../controllers/config.controller'
import { asyncHandler } from '../middleware/errorHandler'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'

const router = Router()

router.use(authenticate)

// Cualquier usuario autenticado puede leer las firmas (para generar el PDF)
router.get('/firmas', asyncHandler(getFirmas))

// Solo ADMIN puede subir firmas
router.post('/firmas/sebastian', requireRole('ADMIN'), uploadFirma.single('firma'), asyncHandler(subirFirma('sebastian')))
router.post('/firmas/andres',    requireRole('ADMIN'), uploadFirma.single('firma'), asyncHandler(subirFirma('andres')))

// ── PATCH /api/config/precios — configurar precios de un curso ────────────────
router.patch('/precios', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const schema = z.object({
    cursoId:          z.string(),
    precioGeneral:    z.number().positive(),
    preciosPromo:     z.array(z.number().positive()).default([]),
    cuposDisponibles: z.number().int().min(0).nullable().optional(),
  })
  const { cursoId, precioGeneral, preciosPromo, cuposDisponibles } = schema.parse(req.body)

  await Promise.all([
    prisma.configApp.upsert({
      where:  { clave: `precio_general_${cursoId}` },
      update: { valor: String(precioGeneral) },
      create: { clave: `precio_general_${cursoId}`, valor: String(precioGeneral) },
    }),
    prisma.configApp.upsert({
      where:  { clave: `precio_promo_${cursoId}` },
      update: { valor: preciosPromo.join(',') },
      create: { clave: `precio_promo_${cursoId}`, valor: preciosPromo.join(',') },
    }),
    // También actualiza el precio base del curso en el modelo
    prisma.curso.update({
      where: { id: cursoId },
      data:  {
        precio: precioGeneral,
        ...(cuposDisponibles !== undefined ? { cuposDisponibles } : {}),
      },
    }),
  ])

  return ApiResponse.success(res, { mensaje: 'Precios actualizados correctamente' })
}))

export default router
