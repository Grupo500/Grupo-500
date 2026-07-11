// Endpoints de solo lectura para integraciones externas (autenticadas por API key,
// ver middleware/apiKeyAuth.ts). No exponen campos sensibles (documento, teléfono,
// comisiones internas) y no permiten crear/editar/borrar nada.

import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse, parsePagination } from '../utils/response'

export async function listarEstudiantes(req: Request, res: Response) {
  const { nombre } = req.query
  const { page, limit, skip } = parsePagination(req.query)

  const where = {
    ...(nombre && { nombre: { contains: String(nombre), mode: 'insensitive' as const } }),
  }

  const [estudiantes, total] = await Promise.all([
    prisma.estudiante.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        email: true,
        verificado: true,
        createdAt: true,
        cursos: { select: { curso: { select: { nombre: true } }, fechaCompra: true } },
        asesor: { select: { nombre: true } },
      },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.estudiante.count({ where }),
  ])

  return ApiResponse.paginated(res, estudiantes, total, page, limit)
}

export async function listarPagos(req: Request, res: Response) {
  const { estado, desde, hasta } = req.query
  const { page, limit, skip } = parsePagination(req.query)

  const where = {
    ...(estado && { estado: String(estado) as any }),
    ...(desde && hasta && { fechaPago: { gte: new Date(String(desde)), lte: new Date(String(hasta)) } }),
  }

  const [pagos, total] = await Promise.all([
    prisma.pago.findMany({
      where,
      select: {
        id: true,
        monto: true,
        estado: true,
        metodo: true,
        fechaPago: true,
        referenciaPago: true,
        estudiante: { select: { nombre: true } },
        asesor: { select: { nombre: true } },
      },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.pago.count({ where }),
  ])

  return ApiResponse.paginated(res, pagos, total, page, limit)
}

export async function listarCursos(_req: Request, res: Response) {
  const cursos = await prisma.curso.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, precio: true, tipoCurso: true, duracionHoras: true },
    orderBy: { nombre: 'asc' },
  })
  return ApiResponse.success(res, cursos)
}

export async function resumen(_req: Request, res: Response) {
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  const [totalEstudiantes, ventasMes, pagosPendientes] = await Promise.all([
    prisma.estudiante.count(),
    prisma.pago.aggregate({
      where: { estado: 'PAGADO', fechaPago: { gte: inicioMes } },
      _sum: { monto: true },
      _count: true,
    }),
    prisma.pago.count({ where: { estado: 'PENDIENTE' } }),
  ])

  return ApiResponse.success(res, {
    totalEstudiantes,
    ventasMes: { total: ventasMes._sum.monto ?? 0, cantidad: ventasMes._count },
    pagosPendientes,
  })
}
