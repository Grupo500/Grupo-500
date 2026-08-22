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
import { datosFinancierosDe } from '../utils/cuentaCobro'
import { broadcast } from '../utils/sseManager'
import { ValidationError } from '../utils/errors'

const router = Router()

// ── Perfil del usuario autenticado ──────────────────────────────────────────
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { asesor: true, marketing: true },
  })
  // Sin envolver de más: esto respondía `{ data: { data: {...} } }` y la
  // pantalla de Ajustes leía un nivel de menos, así que el correo y el
  // teléfono salían en blanco aunque estuvieran en la base.
  return ApiResponse.success(res, {
    role:    user?.role,
    email:   user?.email,
    nombre:  user?.nombre,
    image:   user?.image,
    telefono: user?.asesor?.telefono,
    esMarketing: !!user?.marketing,
    // Los datos fijos de la cuenta de cobro. Solo vienen para marketing.
    financieros: user?.marketing ? datosFinancierosDe(user.marketing) : null,
  })
}))

// ── Editar el propio perfil ─────────────────────────────────────────────────
//
// Ajustes usaba `PATCH /asesores/:id`, que solo existe para quien tiene ficha
// de asesor: el equipo de marketing no la tiene y se quedaba sin poder cambiar
// ni su nombre. Este endpoint escribe donde corresponda según quién sea, y no
// pide id — siempre es el del token, así que nadie puede editar a otro.
const textoOpcional = z.string().max(120).optional().nullable()
const miPerfilSchema = z.object({
  nombre:   z.string().min(2).optional(),
  // El correo no entra aquí a propósito: es la llave con la que se entra y con
  // la que Google reconoce la cuenta. Lo cambia un admin desde Usuarios.
  telefono: z.string().min(3).optional(),
  // Los datos de la cuenta de cobro. Se aceptan sueltos y a medias a
  // propósito: la persona guarda lo que tenga a mano y vuelve por el resto.
  nombreCompleto:   textoOpcional,
  cedula:           textoOpcional,
  ciudadExpedicion: textoOpcional,
  ciudad:           textoOpcional,
  celular:          textoOpcional,
  rut:              textoOpcional,
  banco:            textoOpcional,
  tipoCuenta:       z.enum(['AHORROS', 'CORRIENTE']).optional().nullable(),
  numeroCuenta:     textoOpcional,
  firmaUrl:         z.string().url().optional().nullable(),
})

/** '' y null valen lo mismo: borrar el dato. `undefined` es "no lo tocaste". */
function limpio<T extends Record<string, unknown>>(datos: T) {
  const salida: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(datos)) {
    if (v === undefined) continue
    salida[k] = typeof v === 'string' && v.trim() === '' ? null : v
  }
  return salida
}

router.patch('/me', authenticate, asyncHandler(async (req, res) => {
  const { nombre, telefono, ...financieros } = miPerfilSchema.parse(req.body)

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
    if (user.marketing) {
      const datos = { ...(nombre ? { nombre } : {}), ...limpio(financieros) }
      if (Object.keys(datos).length > 0) {
        await tx.miembroMarketing.update({ where: { id: user.marketing.id }, data: datos })
      }
    }
  })

  // El resto del equipo tiene estos datos en pantalla ahora mismo: quien
  // reparte trabajo ve el nombre en el Planificador y la líder ve en Cobros
  // qué le falta a cada quien para poder pagarle. Sin este aviso había que
  // recargar para enterarse de que un dato ya estaba puesto.
  broadcast('perfil-actualizado', { userId: user.id })

  auditLog(req, 'UPDATE', 'mi_perfil', user.id)
  return ApiResponse.success(res, { ok: true })
}))

// ── Editar el perfil de otro (solo ADMIN) ───────────────────────────────────
//
// Usuarios ofrecía "editar" solo a quien tuviera ficha de asesor, porque
// escribía contra `PATCH /asesores/:id`. El equipo de marketing no la tiene, así
// que sus tarjetas salían sin lápiz: un nombre mal escrito o un correo viejo no
// había forma de arreglarlos (Hotman, 20-ago). Esto escribe donde corresponda
// según quién sea, igual que `PATCH /me` hace con el propio.
const perfilAjenoSchema = z.object({
  nombre:   z.string().min(2).optional(),
  email:    z.string().email().transform(e => e.toLowerCase().trim()).optional(),
  telefono: z.string().min(3).optional().nullable(),
})

router.patch('/usuarios/:id/perfil', authenticate, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { nombre, email, telefono } = perfilAjenoSchema.parse(req.body)

  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, asesor: { select: { id: true } }, marketing: { select: { id: true } } },
  })
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

  // El correo es la llave con la que se entra: dos cuentas con el mismo dejan
  // a una sin poder iniciar sesión.
  if (email) {
    const ocupado = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, id: { not: user.id } },
      select: { id: true },
    })
    if (ocupado) return res.status(409).json({ error: 'Ese correo ya está en uso' })
  }

  await prisma.$transaction(async tx => {
    if (nombre || email) {
      await tx.user.update({
        where: { id: user.id },
        data: { ...(nombre ? { nombre } : {}), ...(email ? { email } : {}) },
      })
    }
    // El nombre vive en dos sitios (la cuenta y la ficha del área) y se guardan
    // juntos: desincronizados, la persona sale con un nombre en Usuarios y con
    // otro en el calendario de marketing.
    if (user.asesor && (nombre || email || telefono)) {
      await tx.asesor.update({
        where: { id: user.asesor.id },
        data: {
          ...(nombre ? { nombre } : {}),
          ...(email ? { email } : {}),
          ...(telefono ? { telefono } : {}),
        },
      })
    }
    if (user.marketing && (nombre || telefono !== undefined)) {
      await tx.miembroMarketing.update({
        where: { id: user.marketing.id },
        data: {
          ...(nombre ? { nombre } : {}),
          // En marketing el teléfono es el celular de la cuenta de cobro: es el
          // único número que se le pide a esa persona.
          ...(telefono !== undefined ? { celular: telefono || null } : {}),
        },
      })
    }
  })

  broadcast('perfil-actualizado', { userId: user.id })
  auditLog(req, 'UPDATE', 'perfil_usuario', user.id)
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
  // Al cambiar la contraseña se cierran las demás sesiones de esa cuenta: si
  // alguien la cambia es porque quiere que lo que esté abierto por ahí deje
  // de valer (Hotman, 22-ago). La de quien la está cambiando sigue.
  await prisma.sesionActiva.updateMany({
    where: {
      userId: req.params.id, cerradaEn: null,
      ...(req.userId === req.params.id && req.sid ? { sid: { not: req.sid } } : {}),
    },
    data: { cerradaEn: new Date() },
  })
  auditLog(req, 'UPDATE', 'usuario_password', req.params.id)
  return ApiResponse.success(res, { message: 'Contraseña actualizada' })
}))

// ── Suspender / reactivar usuario (solo ADMIN) ───────────────────────────────
// Corta el acceso sin borrar nada: para gente que ya no trabaja aquí pero
// cuyo registro se quiere conservar. El middleware rechaza sus peticiones al
// instante (CUENTA_SUSPENDIDA), tenga o no una sesión abierta.
router.patch('/usuarios/:id/suspension', authenticate, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { suspendido } = z.object({ suspendido: z.boolean() }).parse(req.body)

  // Un admin no se suspende a sí mismo: sería cerrarse la puerta por dentro.
  if (req.params.id === req.userId) {
    return res.status(400).json({ error: 'No puedes suspender tu propia cuenta' })
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

  await prisma.user.update({
    where: { id: user.id },
    data: { suspendido, suspendidoEn: suspendido ? new Date() : null },
  })
  auditLog(req, 'UPDATE', 'usuario_suspension', user.id, { email: user.email, suspendido })
  return ApiResponse.success(res, { message: suspendido ? 'Acceso suspendido' : 'Acceso restablecido' })
}))

// ── Eliminar usuario (solo ADMIN) ────────────────────────────────────────────
router.delete('/usuarios/:id', authenticate, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
  await prisma.user.delete({ where: { id: user.id } })
  auditLog(req, 'DELETE', 'usuario', req.params.id, { email: user.email })
  return ApiResponse.success(res, { message: 'Usuario eliminado correctamente' })
}))

// ── Sesiones abiertas ─────────────────────────────────────────────────────────
// Cada entrada deja una fila en SesionActiva (la escribe el web en
// /api/auth/token, que se toca en cada carga de pantalla). Aquí se listan y
// se cierran; el middleware rechaza el token de una sesión cerrada.
router.get('/sesiones', authenticate, asyncHandler(async (req, res) => {
  const filas = await prisma.sesionActiva.findMany({
    where: { userId: req.userId!, cerradaEn: null },
    orderBy: { ultimaVezEn: 'desc' },
    select: { id: true, sid: true, navegador: true, dispositivo: true, creadaEn: true, ultimaVezEn: true },
  })
  return ApiResponse.success(res, filas.map(({ sid, ...f }) => ({ ...f, actual: sid === req.sid })))
}))

router.delete('/sesiones/:id', authenticate, asyncHandler(async (req, res) => {
  await prisma.sesionActiva.updateMany({
    where: { id: req.params.id, userId: req.userId! },
    data: { cerradaEn: new Date() },
  })
  return ApiResponse.noContent(res)
}))

router.post('/sesiones/cerrar-otras', authenticate, asyncHandler(async (req, res) => {
  const { count } = await prisma.sesionActiva.updateMany({
    where: { userId: req.userId!, cerradaEn: null, ...(req.sid ? { sid: { not: req.sid } } : {}) },
    data: { cerradaEn: new Date() },
  })
  auditLog(req, 'UPDATE', 'sesiones_cerradas', req.userId!, { cerradas: count })
  return ApiResponse.success(res, { cerradas: count })
}))

export default router
