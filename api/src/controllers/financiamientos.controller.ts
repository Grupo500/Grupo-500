import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse, parsePagination } from '../utils/response'
import { NotFoundError } from '../utils/errors'
import { auditLog } from '../utils/auditLogger'
import { z } from 'zod'

const cuotaItemSchema = z.object({
  monto:            z.number().positive(),
  fechaVencimiento: z.string(),
})

const crearSchema = z.object({
  estudianteId: z.string(),
  montoTotal:   z.number().positive(),
  cuotas:       z.array(cuotaItemSchema).min(1).max(24),
})

export async function listar(req: Request, res: Response) {
  const { estudianteId, estado, nombre } = req.query
  const { page, limit, skip } = parsePagination(req.query)

  const where = {
    ...(estudianteId && { estudianteId: String(estudianteId) }),
    ...(estado && { estado: String(estado) as any }),
    ...(nombre && { estudiante: { nombre: { contains: String(nombre), mode: 'insensitive' as const } } }),
  }

  const [financiamientos, total] = await Promise.all([
    prisma.financiamiento.findMany({
      where,
      include: { cuotas: true, estudiante: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.financiamiento.count({ where }),
  ])

  return ApiResponse.paginated(res, financiamientos, total, page, limit)
}

export async function crear(req: Request, res: Response) {
  const { estudianteId, montoTotal, cuotas } = crearSchema.parse(req.body)

  const financiamiento = await prisma.financiamiento.create({
    data: {
      estudianteId,
      montoTotal,
      cuotas: {
        create: cuotas.map((c, i) => ({
          numero:           i + 1,
          monto:            Number(c.monto.toFixed(2)),
          fechaVencimiento: new Date(c.fechaVencimiento),
        })),
      },
    },
    include: { cuotas: true },
  })

  return ApiResponse.created(res, financiamiento)
}

export async function obtener(req: Request, res: Response) {
  const financiamiento = await prisma.financiamiento.findUnique({
    where: { id: req.params.id },
    include: { cuotas: { orderBy: { numero: 'asc' } }, estudiante: true },
  })

  if (!financiamiento) throw new NotFoundError('Financiamiento no encontrado')
  return ApiResponse.success(res, financiamiento)
}

const actualizarSchema = z.object({
  estado: z.enum(['ACTIVO', 'COMPLETADO', 'CANCELADO']).optional(),
})

export async function actualizar(req: Request, res: Response) {
  const data = actualizarSchema.parse(req.body)
  const financiamiento = await prisma.financiamiento.update({
    where: { id: req.params.id },
    data,
  })
  auditLog(req, 'UPDATE', 'financiamiento', req.params.id, { cambios: data })
  return ApiResponse.success(res, financiamiento)
}
