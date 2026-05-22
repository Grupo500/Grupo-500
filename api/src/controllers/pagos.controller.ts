import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse, parsePagination } from '../utils/response'
import { ValidationError } from '../utils/errors'
import { auditLog } from '../utils/auditLogger'
import { broadcast } from '../utils/sseManager'
import { z } from 'zod'

const registrarSchema = z.object({
  estudianteId: z.string(),
  monto: z.number().positive(),
  metodo: z.enum(['TRANSFERENCIA', 'TARJETA', 'EFECTIVO', 'OTRO']),
  fechaVencimiento: z.string(),
  notas: z.string().optional(),
})

export async function listar(req: Request, res: Response) {
  const { estudianteId, asesorId, estado, desde, hasta, nombre } = req.query
  const { page, limit, skip } = parsePagination(req.query)
  const isAdmin = req.userRole === 'ADMIN'

  const where = {
    // VENDEDORs only see their own payments
    ...(!isAdmin && req.asesorId && { asesorId: req.asesorId }),
    ...(estudianteId && { estudianteId: String(estudianteId) }),
    // Admins can filter by any asesorId; vendedors can't override the scope above
    ...(isAdmin && asesorId && { asesorId: String(asesorId) }),
    ...(estado && { estado: String(estado) as any }),
    ...(desde && hasta && { fechaVencimiento: { gte: new Date(String(desde)), lte: new Date(String(hasta)) } }),
    ...(nombre && { estudiante: { nombre: { contains: String(nombre), mode: 'insensitive' as const } } }),
  }

  const [pagos, total] = await Promise.all([
    prisma.pago.findMany({
      where,
      include: { estudiante: true, asesor: true },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.pago.count({ where }),
  ])

  return ApiResponse.paginated(res, pagos, total, page, limit)
}

export async function registrar(req: Request, res: Response) {
  const data = registrarSchema.parse(req.body)

  // Validar contra precio del curso
  const est = await prisma.estudiante.findUnique({
    where: { id: data.estudianteId },
    include: {
      cursos: { include: { curso: true } },
      financiamientos: { select: { montoTotal: true } },
      pagos: { select: { monto: true, estado: true } },
    },
  })
  if (est?.cursos.length) {
    const ce = est.cursos[0]
    // Usar precio base sin aplicar descuento — el descuento es informativo y
    // lo gestiona el admin. Evita que descuentoPorcentaje=100 bloquee pagos.
    const precioBase = ce.curso.precio
    // Solo contar pagos no cancelados contra el tope
    const yaRegistrado =
      est.financiamientos.reduce((s, f) => s + f.montoTotal, 0) +
      est.pagos.filter(p => (p as any).estado !== 'CANCELADO').reduce((s, p) => s + p.monto, 0)
    if (yaRegistrado + data.monto > precioBase + 1)
      throw new ValidationError(
        `El monto excede el precio del curso. Saldo disponible: $${Math.max(0, precioBase - yaRegistrado).toLocaleString('es-CO')}`
      )
  }

  const pago = await prisma.pago.create({
    data: {
      ...data,
      fechaVencimiento: new Date(data.fechaVencimiento),
      ...(req.asesorId && { asesorId: req.asesorId }),
    },
    include: { estudiante: true },
  })

  auditLog(req, 'CREATE', 'pago', pago.id, { estudianteId: data.estudianteId, monto: data.monto })
  broadcast('pago-registrado', { pagoId: pago.id, estudianteId: data.estudianteId })
  return ApiResponse.created(res, pago)
}

const actualizarSchema = z.object({
  monto:           z.number().positive().optional(),
  metodo:          z.enum(['TRANSFERENCIA', 'TARJETA', 'EFECTIVO', 'OTRO']).optional(),
  estado:          z.enum(['PENDIENTE', 'PAGADO', 'VENCIDO', 'CANCELADO']).optional(),
  fechaVencimiento: z.string().optional(),
  fechaPago:       z.string().optional(),   // fecha real del pago (no auto-now)
  comprobante:     z.string().nullable().optional(),  // URL o texto libre (Typeform permite texto)
  notas:           z.string().max(500).nullable().optional(),
})

export async function actualizar(req: Request, res: Response) {
  const { id } = req.params
  const data = actualizarSchema.parse(req.body)

  const pago = await prisma.pago.update({
    where: { id },
    data: {
      ...(data.monto !== undefined           && { monto: data.monto }),
      ...(data.metodo                        && { metodo: data.metodo }),
      ...(data.estado                        && { estado: data.estado }),
      ...(data.fechaVencimiento              && { fechaVencimiento: new Date(data.fechaVencimiento) }),
      ...(data.comprobante !== undefined     && { comprobante: data.comprobante }),
      ...(data.notas !== undefined           && { notas: data.notas }),
      // Usar la fecha real del body; si no viene pero se marca PAGADO, usar hoy
      ...(data.fechaPago
            ? { fechaPago: new Date(data.fechaPago) }
            : data.estado === 'PAGADO' && { fechaPago: new Date() }),
    },
    include: { estudiante: true, asesor: true },
  })
  auditLog(req, 'UPDATE', 'pago', id, { cambios: data })
  broadcast('pago-registrado', { pagoId: pago.id, estudianteId: pago.estudianteId })
  return ApiResponse.success(res, pago)
}

export async function eliminar(req: Request, res: Response) {
  const { id } = req.params
  await prisma.pago.delete({ where: { id } })
  return ApiResponse.success(res, { id })
}

export async function subirComprobante(req: Request, res: Response) {
  // Integración Cloudinary — se completa en siguiente fase
  const { id } = req.params
  const { comprobanteUrl } = req.body

  const pago = await prisma.pago.update({
    where: { id },
    data: { comprobante: comprobanteUrl },
  })

  return ApiResponse.success(res, pago)
}
