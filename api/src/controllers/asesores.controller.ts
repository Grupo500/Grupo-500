import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { auditLog } from '../utils/auditLogger'

export async function listar(_req: Request, res: Response) {
  const [asesores, cursosXAsesor] = await Promise.all([
    prisma.asesor.findMany({
      where: { user: { role: 'VENDEDOR' } },
      include: {
        user: { select: { role: true, email: true } },
        _count: { select: { estudiantes: true, pagos: true } },
      },
      orderBy: { nombre: 'asc' },
    }),
    // Contar cuántos CursoEstudiante tiene cada asesor (via estudiante.asesorId)
    prisma.cursoEstudiante.groupBy({
      by: ['estudianteId'],
      _count: true,
    }).then(async () => {
      // Query directa: contar cursos agrupados por asesorId del estudiante
      const rows = await prisma.$queryRaw<{ asesor_id: string; total: bigint }[]>`
        SELECT e."asesorId" as asesor_id, COUNT(ce.id) as total
        FROM "CursoEstudiante" ce
        INNER JOIN "Estudiante" e ON e.id = ce."estudianteId"
        WHERE e."asesorId" IS NOT NULL
        GROUP BY e."asesorId"
      `
      return new Map(rows.map(r => [r.asesor_id, Number(r.total)]))
    }),
  ])

  const result = asesores.map(a => ({
    ...a,
    _count: {
      ...a._count,
      cursos: cursosXAsesor.get(a.id) ?? 0,
    },
  }))

  return ApiResponse.success(res, result)
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

export async function me(req: Request, res: Response) {
  if (!req.asesorId) return res.status(404).json({ success: false, error: 'No encontrado' })
  const asesor = await prisma.asesor.findUnique({
    where: { id: req.asesorId },
    select: { id: true, nombre: true },
  })
  if (!asesor) return res.status(404).json({ success: false, error: 'Asesor no encontrado' })
  return ApiResponse.success(res, asesor)
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

  auditLog(req, 'UPDATE', 'asesor', id, { cambios: { nombre, telefono, email } })
  return ApiResponse.success(res, asesor)
}
