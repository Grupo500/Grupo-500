import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { NotFoundError } from '../utils/errors'
import { auditLog } from '../utils/auditLogger'
import { z } from 'zod'

const schema = z.object({
  nombre:           z.string().min(2),
  ciudad:           z.string().min(2),
  contactoNombre:   z.string().optional(),
  contactoEmail:    z.string().email().optional().or(z.literal('')),
  contactoTelefono: z.string().optional(),
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

const actualizarSchema = z.object({
  nombre:           z.string().min(2).optional(),
  ciudad:           z.string().min(2).optional(),
  contactoNombre:   z.string().optional(),
  contactoEmail:    z.string().email().optional().or(z.literal('')),
  contactoTelefono: z.string().optional(),
})

export async function actualizar(req: Request, res: Response) {
  const data = actualizarSchema.parse(req.body)
  const colegio = await prisma.colegio.update({ where: { id: req.params.id }, data })
  auditLog(req, 'UPDATE', 'colegio', req.params.id, { cambios: data })
  return ApiResponse.success(res, colegio)
}

export async function eliminar(req: Request, res: Response) {
  await prisma.colegio.delete({ where: { id: req.params.id } })
  auditLog(req, 'DELETE', 'colegio', req.params.id)
  return ApiResponse.noContent(res)
}
