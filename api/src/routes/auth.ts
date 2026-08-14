import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { ApiResponse } from '../utils/response'
import { auditLog } from '../utils/auditLogger'
import { logSecurityEvent } from '../utils/logger'
import { prisma } from '../config/prisma'
import { z } from 'zod'
import * as ROLES from '../utils/roles'

const router = Router()

// ── Perfil del usuario autenticado ──────────────────────────────────────────
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { asesor: true, marketing: true },
  })
  return ApiResponse.success(res, {
    data: {
      role:    user?.role,
      email:   user?.email,
      nombre:  user?.nombre,
      image:   user?.image,
      telefono: user?.asesor?.telefono,
      // Solo viene con contenido para el equipo de marketing; el RUT es lo que
      // se necesita para pagarles un freelance.
      rut:     user?.marketing?.rut ?? null,
      esMarketing: !!user?.marketing,
    },
  })
}))

// ── Editar el propio perfil ─────────────────────────────────────────────────
//
// Ajustes usaba `PATCH /asesores/:id`, que solo existe para quien tiene ficha
// de asesor: el equipo de marketing no la tiene y se quedaba sin poder cambiar
// ni su nombre. Este endpoint escribe donde corresponda según quién sea, y no
// pide id — siempre es el del token, así que nadie puede editar a otro.
const miPerfilSchema = z.object({
  nombre:   z.string().min(2).optional(),
  telefono: z.string().min(3).optional(),
  rut:      z.string().max(40).optional().nullable(),
})

router.patch('/me', authenticate, asyncHandler(async (req, res) => {
  const { nombre, telefono, rut } = miPerfilSchema.parse(req.body)

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, asesor: { select: { id: true } }, marketing: { select: { id: true } } },
  })
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

  await prisma.$transaction(async tx => {
    if (nombre) await tx.user.update({ where: { id: user.id }, data: { nombre } })

    // El nombre vive en dos sitios (la cuenta y la ficha del área) y se guardan
    // juntos: si se desincronizan, la persona aparece con un nombre en Usuarios
    // y con otro en el calendario de marketing.
    if (user.asesor && (nombre || telefono)) {
      await tx.asesor.update({
        where: { id: user.asesor.id },
        data: { ...(nombre ? { nombre } : {}), ...(telefono ? { telefono } : {}) },
      })
    }
    if (user.marketing && (nombre || rut !== undefined)) {
      await tx.miembroMarketing.update({
        where: { id: user.marketing.id },
        data: { ...(nombre ? { nombre } : {}), ...(rut !== undefined ? { rut: rut || null } : {}) },
      })
    }
  })

  auditLog(req, 'UPDATE', 'mi_perfil', user.id)
  return ApiResponse.success(res, { ok: true })
}))

// ── Actualizar foto de perfil ────────────────────────────────────────────────
router.patch('/usuarios/:id/foto', authenticate, asyncHandler(async (req, res) => {
  // Solo el propio usuario o un ADMIN puede cambiar la foto
  if (req.userId !== req.params.id && req.userRole !== 'ADMIN') {
    return res.status(403).json({ error: 'No autorizado' })
  }
  const { image } = req.body
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'URL de imagen inválida' })
  }
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { image } })
  auditLog(req, 'UPDATE', 'usuario_foto', req.params.id)
  return ApiResponse.success(res, { image: user.image })
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

// Roles que operan dentro del área de Marketing y usan un perfil MiembroMarketing
// (no Asesor) — EDITOR/COMMUNITY tienen el mismo acceso que MARKETING, solo
// cambia la etiqueta del rol para distinguir la especialidad de cada uno.
const ROLES_MARKETING = ROLES.MARKETING

const crearSchema = z.object({
  email:    z.string().email().transform(e => e.toLowerCase().trim()),
  password: z.string().min(8),
  nombre:   z.string().min(2),
  telefono: z.string().min(7).optional(),
  role:     z.enum(ROLES.TODOS as [ROLES.RolTrabajo, ...ROLES.RolTrabajo[]]).default('VENDEDOR'),
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
      // Los roles de Marketing no tienen perfil de Asesor (no venden ni gestionan
      // estudiantes); ADMIN/VENDEDOR sí, como siempre.
      ...((ROLES_MARKETING as readonly string[]).includes(data.role)
        ? { marketing: { create: { nombre: data.nombre } } }
        : { asesor: { create: { nombre: data.nombre, email: data.email, telefono: data.telefono ?? '000-000-0000' } } }),
    },
    include: { asesor: true, marketing: true },
  })

  const { hashedPassword: _, ...userSafe } = user
  return ApiResponse.created(res, userSafe)
}))

// ── Cambiar rol (solo ADMIN) ─────────────────────────────────────────────────
router.patch('/usuarios/:id/rol', authenticate, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { role } = req.body
  if (!(ROLES.TODOS as string[]).includes(role)) {
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
