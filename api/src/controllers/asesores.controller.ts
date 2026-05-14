import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'

export async function listar(_req: Request, res: Response) {
  const asesores = await prisma.asesor.findMany({
    where: { user: { role: 'VENDEDOR' } },
    include: {
      user: { select: { role: true, email: true } },
      _count: { select: { estudiantes: true, pagos: true } },
    },
    orderBy: { nombre: 'asc' },
  })
  return ApiResponse.success(res, asesores)
}

export async function estadisticas(req: Request, res: Response) {
  const { id } = req.params
  const { desde, hasta } = req.query

  const asesor = await prisma.asesor.findUnique({
    where: { id },
    include: {
      pagos: {
        where: {
          estado: 'PAGADO',
          ...(desde && hasta && { fechaPago: { gte: new Date(String(desde)), lte: new Date(String(hasta)) } }),
        },
      },
      _count: { select: { estudiantes: true } },
    },
  })

  const totalVentas = asesor?.pagos.reduce((sum, p) => sum + p.monto, 0) ?? 0

  return ApiResponse.success(res, {
    asesor,
    estadisticas: {
      totalVentas,
      cantidadPagos: asesor?.pagos.length ?? 0,
      totalEstudiantes: asesor?._count.estudiantes ?? 0,
    },
  })
}

export async function misEstadisticas(req: Request, res: Response) {
  if (!req.asesorId) return ApiResponse.success(res, null)
  req.params.id = req.asesorId
  return estadisticas(req, res)
}

export async function actualizar(req: Request, res: Response) {
  const { id } = req.params
  const { nombre, telefono, email } = req.body

  const asesor = await prisma.asesor.update({
    where: { id },
    data: {
      ...(nombre   && { nombre:   nombre.trim() }),
      ...(telefono && { telefono: telefono.trim() }),
      ...(email    && { email:    email.trim() }),
    },
  })

  return ApiResponse.success(res, asesor)
}
