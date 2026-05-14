import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { z } from 'zod'

const registrarSchema = z.object({
  estudianteId: z.string(),
  monto: z.number().positive(),
  metodo: z.enum(['TRANSFERENCIA', 'TARJETA', 'EFECTIVO', 'OTRO']),
  fechaVencimiento: z.string(),
  notas: z.string().optional(),
})

export async function listar(req: Request, res: Response) {
  const { estudianteId, asesorId, estado, desde, hasta, page = '1', limit = '20' } = req.query
  const skip = (Number(page) - 1) * Number(limit)

  const where = {
    ...(estudianteId && { estudianteId: String(estudianteId) }),
    ...(asesorId && { asesorId: String(asesorId) }),
    ...(estado && { estado: String(estado) as any }),
    ...(desde && hasta && { fechaVencimiento: { gte: new Date(String(desde)), lte: new Date(String(hasta)) } }),
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

  return ApiResponse.paginated(res, pagos, total, Number(page), Number(limit))
}

export async function registrar(req: Request, res: Response) {
  const data = registrarSchema.parse(req.body)

  const pago = await prisma.pago.create({
    data: {
      ...data,
      fechaVencimiento: new Date(data.fechaVencimiento),
      ...(req.asesorId && { asesorId: req.asesorId }),
    },
    include: { estudiante: true },
  })

  return ApiResponse.created(res, pago)
}

export async function actualizar(req: Request, res: Response) {
  const { id } = req.params
  const { monto, metodo, estado, fechaVencimiento, comprobante } = req.body

  const pago = await prisma.pago.update({
    where: { id },
    data: {
      ...(monto !== undefined       && { monto: Number(monto) }),
      ...(metodo                    && { metodo }),
      ...(estado                    && { estado }),
      ...(fechaVencimiento          && { fechaVencimiento: new Date(fechaVencimiento) }),
      ...(comprobante !== undefined  && { comprobante }),
      ...(estado === 'PAGADO'       && { fechaPago: new Date() }),
    },
    include: { estudiante: true, asesor: true },
  })
  return ApiResponse.success(res, pago)
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
