import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'

const router = Router()
router.use(authenticate)

// ── Schema de campos ──────────────────────────────────────────────────────────
const campoSchema = z.object({
  id:          z.string(),
  tipo:        z.enum(['texto', 'textarea', 'email', 'telefono', 'fecha', 'select', 'checkbox', 'archivo', 'seccion', 'numero']),
  label:       z.string().min(1),
  placeholder: z.string().optional(),
  descripcion: z.string().optional(),
  requerido:   z.boolean().default(false),
  opciones:    z.array(z.string()).optional(),
})

const formularioSchema = z.object({
  nombre:          z.string().min(2),
  descripcion:     z.string().optional(),
  campos:          z.array(campoSchema).default([]),
  activo:          z.boolean().optional(),
  visibleEnLanding: z.boolean().optional(),
  cursoId:         z.string().optional().nullable(),
})

// ── GET /api/formularios — listar todos ───────────────────────────────────────
router.get('/', asyncHandler(async (_req, res) => {
  const formularios = await prisma.formulario.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return ApiResponse.success(res, formularios)
}))

// ── GET /api/formularios/:id ──────────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  const form = await prisma.formulario.findUnique({ where: { id: req.params.id } })
  if (!form) return res.status(404).json({ success: false, error: 'Formulario no encontrado' })
  return ApiResponse.success(res, form)
}))

// ── POST /api/formularios — crear ─────────────────────────────────────────────
router.post('/', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const data = formularioSchema.parse(req.body)
  const form = await prisma.formulario.create({ data: { ...data, campos: data.campos as any } })
  return ApiResponse.created(res, form)
}))

// ── PATCH /api/formularios/:id — actualizar ───────────────────────────────────
router.patch('/:id', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const data = formularioSchema.partial().parse(req.body)
  const form = await prisma.formulario.update({
    where: { id: req.params.id },
    data:  { ...data, ...(data.campos ? { campos: data.campos as any } : {}) },
  })
  return ApiResponse.success(res, form)
}))

// ── DELETE /api/formularios/:id ───────────────────────────────────────────────
router.delete('/:id', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  await prisma.formulario.delete({ where: { id: req.params.id } })
  return ApiResponse.noContent(res)
}))

export default router
