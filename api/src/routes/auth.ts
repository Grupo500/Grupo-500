import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { ApiResponse } from '../utils/response'
import { auditLog } from '../utils/auditLogger'
import { logSecurityEvent } from '../utils/logger'
import { prisma } from '../config/prisma'
import { z } from 'zod'

const router = Router()

// ── Perfil del usuario autenticado ──────────────────────────────────────────
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { asesor: true },
  })
  return ApiResponse.success(res, { data: { role: user?.role } })
}))

// ── Listar todos los usuarios (solo ADMIN) ───────────────────────────────────
router.get('/usuarios', authenticate, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const usuarios = await prisma.user.findMany({
    include: {
      asesor: {
        include: { _count: { select: { estudiantes: true, pagos: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return ApiResponse.success(res, usuarios)
}))

const crearSchema = z.object({
  email:    z.string().email().transform(e => e.toLowerCase().trim()),
  password: z.string().min(8),
  nombre:   z.string().min(2),
  telefono: z.string().min(7).optional(),
  role:     z.enum(['ADMIN', 'VENDEDOR']).default('VENDEDOR'),
})

// ── Crear usuario (solo ADMIN) ───────────────────────────────────────────────
router.post('/usuarios', authenticate, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const data = crearSchema.parse(req.body)

  // Email ya normalizado a minúsculas por el schema; buscar insensible por si acaso
  const existe = await prisma.user.findFirst({
    where: { email: { equals: data.email, mode: 'insensitive' } },
  })
  if (existe) return res.status(409).json({ error: 'El usuario ya está registrado' })

  const hashedPassword = await bcrypt.hash(data.password, 12)

  const user = await prisma.user.create({
    data: {
      email:  data.email,
      nombre: data.nombre,
      role:   data.role,
      hashedPassword,
      asesor: {
        create: {
          nombre:   data.nombre,
          email:    data.email,
          telefono: data.telefono ?? '000-000-0000',
        },
      },
    },
    include: { asesor: true },
  })

  const { hashedPassword: _, ...userSafe } = user
  return ApiResponse.created(res, userSafe)
}))

// ── Cambiar rol (solo ADMIN) ─────────────────────────────────────────────────
router.patch('/usuarios/:id/rol', authenticate, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { role } = req.body
  if (!['ADMIN', 'VENDEDOR'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido' })
  }
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { role } })
  auditLog(req, 'UPDATE', 'usuario_rol', req.params.id, { nuevoRol: role })
  return ApiResponse.success(res, user)
}))

// ── Cambiar contraseña ───────────────────────────────────────────────────────
router.patch('/usuarios/:id/password', authenticate, asyncHandler(async (req, res) => {
  // Solo el propio usuario o un ADMIN puede cambiar la contraseña
  if (req.userId !== req.params.id && req.userRole !== 'ADMIN') {
    logSecurityEvent('UNAUTHORIZED_PASSWORD_CHANGE', {
      requesterId: req.userId,
      targetId:    req.params.id,
      ip:          req.ip,
    })
    return res.status(403).json({ error: 'No autorizado' })
  }

  const { password } = req.body
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  await prisma.user.update({ where: { id: req.params.id }, data: { hashedPassword } })
  auditLog(req, 'UPDATE', 'usuario_password', req.params.id)
  return ApiResponse.success(res, { message: 'Contraseña actualizada' })
}))

// ── Eliminar usuario (solo ADMIN) ────────────────────────────────────────────
router.delete('/usuarios/:id', authenticate, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
  await prisma.user.delete({ where: { id: user.id } })
  auditLog(req, 'DELETE', 'usuario', req.params.id, { email: user.email })
  return ApiResponse.success(res, { message: 'Usuario eliminado correctamente' })
}))

export default router
