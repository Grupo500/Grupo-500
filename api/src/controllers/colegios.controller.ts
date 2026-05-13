import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { NotFoundError } from '../utils/errors'
import { z } from 'zod'

const schema = z.object({
  nombre: z.string().min(2),
  ciudad: z.string().min(2),
})

export async function listar(req: Request, res: Response) {
  const { nombre } = req.query

  const colegios = await prisma.colegio.findMany({
    where: nombre ? { nombre: { contains: String(nombre), mode: 'insensitive' } } : undefined,
    include: { _count: { select: { estudiantes: true } } },
    orderBy: { nombre: 'asc' },
  })

  return ApiResponse.success(res, colegios)
}

export async function crear(req: Request, res: Response) {
  const data = schema.parse(req.body)
  const colegio = await prisma.colegio.create({ data })
  return ApiResponse.created(res, colegio)
}

export async function obtener(req: Request, res: Response) {
  const colegio = await prisma.colegio.findUnique({
    where: { id: req.params.id },
    include: { estudiantes: true, _count: { select: { estudiantes: true } } },
  })
  if (!colegio) throw new NotFoundError('Colegio no encontrado')
  return ApiResponse.success(res, colegio)
}

export async function actualizar(req: Request, res: Response) {
  const colegio = await prisma.colegio.update({ where: { id: req.params.id }, data: req.body })
  return ApiResponse.success(res, colegio)
}

export async function eliminar(req: Request, res: Response) {
  await prisma.colegio.delete({ where: { id: req.params.id } })
  return ApiResponse.noContent(res)
}
