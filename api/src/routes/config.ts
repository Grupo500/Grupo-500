import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import multer from 'multer'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import { v2 as cloudinary } from 'cloudinary'
import { authenticate, requireRole } from '../middleware/auth'
import { uploadFirma } from '../middleware/upload'
import { getFirmas, subirFirma } from '../controllers/config.controller'
import { asyncHandler } from '../middleware/errorHandler'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'

// Storage para documentos T&C
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})
const tcStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'grupo500/documentos',
    resource_type:   'raw',
    use_filename:    false,
    public_id:       'terminos-condiciones-grupo500',
    overwrite:       true,
  } as any,
})
const uploadTC = multer({ storage: tcStorage, limits: { fileSize: 20 * 1024 * 1024 } })

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

// ── GET /api/config/terminos — URL pública del PDF de T&C ─────────────────────
// Accesible sin autenticación (lo necesita el formulario público)
router.get('/terminos', asyncHandler(async (_req, res) => {
  const cfg = await prisma.configApp.findUnique({ where: { clave: 'terminos_url' } })
  return ApiResponse.success(res, {
    url: cfg?.valor ?? 'https://res.cloudinary.com/dbc1cm3hq/raw/upload/v1780155655/grupo500/documentos/terminos-condiciones-grupo500.pdf',
  })
}))

// ── POST /api/config/terminos — subir nuevo PDF de T&C (solo ADMIN) ───────────
router.post(
  '/terminos',
  requireRole('ADMIN'),
  (req: Request, res: Response, next: NextFunction) => {
    uploadTC.single('file')(req, res, (err: any) => {
      if (err) return res.status(400).json({ success: false, error: err.message ?? 'Error al subir archivo' })
      next()
    })
  },
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'No se recibió ningún archivo' })
    const file = req.file as Express.Multer.File & { path: string }
    await prisma.configApp.upsert({
      where:  { clave: 'terminos_url' },
      update: { valor: file.path },
      create: { clave: 'terminos_url', valor: file.path },
    })
    return ApiResponse.success(res, { url: file.path, mensaje: 'Términos y condiciones actualizados' })
  })
)

export default router
