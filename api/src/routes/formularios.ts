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
  tipo:        z.enum([
    'texto', 'textarea', 'email', 'telefono', 'fecha', 'numero',
    'select', 'radio', 'checkbox_multi', 'si_no',
    'escala', 'nps', 'archivo', 'seccion', 'parrafo',
    // internos
    'checkbox', 'header_image',
  ]),
  label:       z.string().min(1),
  placeholder: z.string().optional(),
  descripcion: z.string().optional(),
  requerido:   z.boolean().default(false),
  opciones:    z.array(z.string()).optional(),
  // Nuevos campos
  minLength:   z.number().optional(),
  maxLength:   z.number().optional(),
  min:         z.number().optional(),
  max:         z.number().optional(),
  escalaMax:   z.union([z.literal(5), z.literal(10)]).optional(),
  aceptar:     z.string().optional(),
  contenido:   z.string().optional(),
  url:         z.string().optional(),
  logica: z.object({
    campoId:  z.string(),
    operador: z.enum(['igual', 'no_igual', 'contiene', 'no_vacio']),
    valor:    z.string(),
  }).optional(),
})

const metaSchema = z.object({
  colorPrimario:     z.string().optional(),
  colorSecundario:   z.string().optional(),
  mensajeBienvenida: z.string().optional(),
  mensajeExito:      z.string().optional(),
  icono:             z.enum(['check', 'star', 'trophy', 'heart', 'rocket']).optional(),
}).optional()

const formularioSchema = z.object({
  nombre:          z.string().min(2),
  descripcion:     z.string().optional(),
  campos:          z.array(campoSchema).default([]),
  meta:            metaSchema,
  activo:          z.boolean().optional(),
  visibleEnLanding: z.boolean().optional(),
  cursoId:         z.string().optional().nullable(),
})

// ── GET /api/formularios — listar todos ───────────────────────────────────────
router.get('/', asyncHandler(async (_req, res) => {
  const formularios = await prisma.formulario.findMany({
    orderBy: { createdAt: 'desc' },
  })

  // Agregar conteo de respuestas (registros en FuenteContacto con ese formId)
  const conRespuestas = await Promise.all(formularios.map(async (f) => {
    const respuestas = await prisma.fuenteContacto.count({
      where: { formId: f.id },
    })
    return { ...f, respuestas }
  }))

  return ApiResponse.success(res, conRespuestas)
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
  const form = await prisma.formulario.create({ data: { ...data, campos: data.campos as any, meta: data.meta as any ?? undefined } })
  return ApiResponse.created(res, form)
}))

// ── PATCH /api/formularios/:id — actualizar ───────────────────────────────────
router.patch('/:id', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const data = formularioSchema.partial().parse(req.body)
  const form = await prisma.formulario.update({
    where: { id: req.params.id },
    data:  { ...data, ...(data.campos ? { campos: data.campos as any } : {}), ...(data.meta !== undefined ? { meta: data.meta as any } : {}) },
  })
  return ApiResponse.success(res, form)
}))

// ── DELETE /api/formularios/:id ───────────────────────────────────────────────
router.delete('/:id', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  await prisma.formulario.delete({ where: { id: req.params.id } })
  return ApiResponse.noContent(res)
}))

export default router
