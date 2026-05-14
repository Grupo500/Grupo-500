import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { ApiResponse } from '../utils/response'
import { prisma } from '../config/prisma'

const router = Router()

// Perfil del usuario autenticado
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { asesor: true },
  })
  return ApiResponse.success(res, user)
}))

// Listar usuarios (solo ADMIN)
router.get('/usuarios', authenticate, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const usuarios = await prisma.user.findMany({
    include: { asesor: true },
    orderBy: { createdAt: 'desc' },
  })
  return ApiResponse.success(res, usuarios)
}))

// Cambiar rol de un usuario (solo ADMIN)
router.patch('/usuarios/:id/rol', authenticate, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { role } = req.body
  if (!['ADMIN', 'VENDEDOR'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido. Usa ADMIN o VENDEDOR' })
  }
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role },
  })
  return ApiResponse.success(res, user)
}))

export default router
