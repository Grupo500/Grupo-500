import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'

export async function calendario(req: Request, res: Response) {
  const { fecha, desde, hasta, asesorId } = req.query

  let fechaInicio: Date
  let fechaFin: Date

  if (fecha) {
    fechaInicio = new Date(String(fecha))
    fechaFin = new Date(fechaInicio)
    fechaFin.setDate(fechaFin.getDate() + 1)
  } else {
    fechaInicio = desde ? new Date(String(desde)) : new Date()
    fechaFin = hasta
      ? new Date(String(hasta))
      : new Date(fechaInicio.getTime() + 30 * 24 * 60 * 60 * 1000)
  }

  const cuotas = await prisma.cuota.findMany({
    where: {
      fechaVencimiento: { gte: fechaInicio, lt: fechaFin },
      pagado: false,
      financiamiento: {
        estudiante: asesorId ? { asesorId: String(asesorId) } : undefined,
      },
    },
    include: {
      financiamiento: {
        include: {
          estudiante: { include: { acudiente: true, asesor: true } },
        },
      },
    },
    orderBy: { fechaVencimiento: 'asc' },
  })

  // Agrupar por día para la vista de calendario
  const agrupado = cuotas.reduce((acc, cuota) => {
    const key = cuota.fechaVencimiento.toISOString().split('T')[0]
    if (!acc[key]) acc[key] = []
    acc[key].push(cuota)
    return acc
  }, {} as Record<string, typeof cuotas>)

  return ApiResponse.success(res, agrupado)
}

export async function proximos(req: Request, res: Response) {
  const dias = Number(req.query.dias) || 7

  const hasta = new Date()
  hasta.setDate(hasta.getDate() + dias)

  const cuotas = await prisma.cuota.findMany({
    where: {
      fechaVencimiento: { gte: new Date(), lte: hasta },
      pagado: false,
    },
    include: {
      financiamiento: {
        include: { estudiante: { include: { acudiente: true } } },
      },
    },
    orderBy: { fechaVencimiento: 'asc' },
    take: 50,
  })

  return ApiResponse.success(res, cuotas)
}
