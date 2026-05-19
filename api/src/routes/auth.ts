import { Router } from 'express'
import { createClerkClient } from '@clerk/backend'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { ApiResponse } from '../utils/response'
import { prisma } from '../config/prisma'

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
const router = Router()

// ── Perfil del usuario autenticado ──────────────────────────────────────────
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { asesor: true },
  })
  return ApiResponse.success(res, user)
}))

// ── Listar todos los usuarios (solo ADMIN) ───────────────────────────────────
// Enriquece imageUrl y nombre con datos frescos de Clerk para mantener sincronía
router.get('/usuarios', authenticate, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const usuarios = await prisma.user.findMany({
    include: {
      asesor: {
        include: { _count: { select: { estudiantes: true, pagos: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Obtener datos frescos de Clerk en paralelo
  const enriquecidos = await Promise.all(
    usuarios.map(async (u) => {
      try {
        const clerkUser = await clerk.users.getUser(u.clerkId)
        const imageUrl = clerkUser.imageUrl ?? u.imageUrl
        const nombre   = `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim()
                         || u.nombre || u.email.split('@')[0]

        // Actualizar DB si hay diferencia (en background, sin bloquear)
        if (imageUrl !== u.imageUrl || nombre !== u.nombre) {
          prisma.user.update({ where: { id: u.id }, data: { imageUrl, nombre } }).catch(() => {})
        }

        return { ...u, imageUrl, nombre }
      } catch {
        return u
      }
    })
  )

  return ApiResponse.success(res, enriquecidos)
}))

// ── Registrar usuario (solo ADMIN) ───────────────────────────────────────────
// Busca al usuario en Clerk por email y lo crea en la DB con el rol indicado
router.post('/usuarios', authenticate, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { email, role = 'VENDEDOR' } = req.body
  if (!email) return res.status(400).json({ error: 'Email requerido' })
  if (!['ADMIN', 'VENDEDOR'].includes(role)) return res.status(400).json({ error: 'Rol inválido' })

  // Verificar que no exista ya en DB
  const existe = await prisma.user.findFirst({ where: { email } })
  if (existe) return res.status(409).json({ error: 'El usuario ya está registrado en el sistema' })

  // Buscar en Clerk por email
  const clerkList = await clerk.users.getUserList({ emailAddress: [email] })
  if (!clerkList.data.length) {
    return res.status(404).json({ error: 'No existe ningún usuario con ese email en Clerk. El usuario debe registrarse primero.' })
  }

  const clerkUser = clerkList.data[0]
  const nombre    = `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim()
                    || email.split('@')[0]
  const imageUrl  = clerkUser.imageUrl ?? null

  // Crear en DB con Asesor
  const user = await prisma.user.create({
    data: {
      clerkId:  clerkUser.id,
      email:    clerkUser.emailAddresses[0]?.emailAddress ?? email,
      nombre,
      imageUrl,
      role,
      asesor: {
        create: {
          nombre:   nombre.charAt(0).toUpperCase() + nombre.slice(1),
          email:    clerkUser.emailAddresses[0]?.emailAddress ?? email,
          telefono: clerkUser.phoneNumbers?.[0]?.phoneNumber ?? '000-000-0000',
        },
      },
    },
    include: { asesor: true },
  })

  // Sincronizar rol en Clerk publicMetadata
  await clerk.users.updateUserMetadata(clerkUser.id, {
    publicMetadata: { role },
  })

  return ApiResponse.success(res, user)
}))

// ── Cambiar rol (solo ADMIN) — sincroniza DB + Clerk ────────────────────────
router.patch('/usuarios/:id/rol', authenticate, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { role } = req.body
  if (!['ADMIN', 'VENDEDOR'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido. Usa ADMIN o VENDEDOR' })
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role },
  })

  await clerk.users.updateUserMetadata(user.clerkId, {
    publicMetadata: { role },
  })

  return ApiResponse.success(res, user)
}))

// ── Eliminar usuario (solo ADMIN) — sincroniza DB + Clerk ───────────────────
router.delete('/usuarios/:id', authenticate, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

  // Eliminar de DB (cascade elimina el Asesor también)
  await prisma.user.delete({ where: { id: user.id } })

  // Eliminar de Clerk
  try {
    await clerk.users.deleteUser(user.clerkId)
  } catch {
    // Si ya no existe en Clerk, ignorar el error
  }

  return ApiResponse.success(res, { message: 'Usuario eliminado correctamente' })
}))

export default router
