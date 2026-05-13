import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { NotFoundError } from '../utils/errors'
import { z } from 'zod'

const crearSchema = z.object({
  estudianteId: z.string(),
  montoTotal: z.number().positive(),
  numeroCuotas: z.number().int().min(1).max(24),
  fechaPrimeraCuota: z.string(),
})

export async function listar(req: Request, res: Response) {
  const { estudianteId, estado } = req.query

  const financiamientos = await prisma.financiamiento.findMany({
    where: {
      ...(estudianteId && { estudianteId: String(estudianteId) }),
      ...(estado && { estado: String(estado) as any }),
    },
    include: { cuotas: true, estudiante: true },
    orderBy: { createdAt: 'desc' },
  })

  return ApiResponse.success(res, financiamientos)
}

export async function crear(req: Request, res: Response) {
  const { estudianteId, montoTotal, numeroCuotas, fechaPrimeraCuota } = crearSchema.parse(req.body)

  const montoCuota = montoTotal / numeroCuotas
  const fechaBase = new Date(fechaPrimeraCuota)

  const financiamiento = await prisma.financiamiento.create({
    data: {
      estudianteId,
      montoTotal,
      cuotas: {
        create: Array.from({ length: numeroCuotas }, (_, i) => {
          const fecha = new Date(fechaBase)
          fecha.setMonth(fecha.getMonth() + i)
          return {
            numero: i + 1,
            monto: Number(montoCuota.toFixed(2)),
            fechaVencimiento: fecha,
          }
        }),
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

export async function actualizar(req: Request, res: Response) {
  const financiamiento = await prisma.financiamiento.update({
    where: { id: req.params.id },
    data: req.body,
  })
  return ApiResponse.success(res, financiamiento)
}
