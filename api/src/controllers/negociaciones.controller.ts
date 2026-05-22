import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { NotFoundError } from '../utils/errors'
import { z } from 'zod'

const etapas = ['PROSPECTO','CONTACTO','PROPUESTA','REUNION','CONVENIO','DESCARTADO'] as const

const crearSchema = z.object({
  colegioId:          z.string(),
  asesorId:           z.string(),
  etapa:              z.enum(etapas).optional(),
  notas:              z.string().optional(),
  fechaContacto:      z.string().optional(),
  fechaReunion:       z.string().optional(),
  fechaProxContacto:  z.string().optional(),
})

const actualizarSchema = crearSchema.partial()

const include = {
  colegio: true,
  asesor:  { include: { user: { select: { email: true } } } },
}

export async function listar(req: Request, res: Response) {
  const isAdmin = req.userRole === 'ADMIN'
  // VENDEDOR solo ve sus propias negociaciones
  const where = !isAdmin && req.asesorId ? { asesorId: req.asesorId } : {}

  const negociaciones = await prisma.negociacion.findMany({
    where,
    include,
    orderBy: { updatedAt: 'desc' },
  })
  return ApiResponse.success(res, negociaciones)
}

export async function crear(req: Request, res: Response) {
  const data = crearSchema.parse(req.body)
  const negociacion = await prisma.negociacion.create({
    data: {
      colegioId:         data.colegioId,
      asesorId:          data.asesorId,
      etapa:             data.etapa ?? 'PROSPECTO',
      notas:             data.notas,
      fechaContacto:     data.fechaContacto  ? new Date(data.fechaContacto)  : null,
      fechaReunion:      data.fechaReunion   ? new Date(data.fechaReunion)   : null,
      fechaProxContacto: data.fechaProxContacto ? new Date(data.fechaProxContacto) : null,
    },
    include,
  })
  return ApiResponse.created(res, negociacion)
}

export async function actualizar(req: Request, res: Response) {
  const data = actualizarSchema.parse(req.body)
  const negociacion = await prisma.negociacion.update({
    where: { id: req.params.id },
    data: {
      ...(data.asesorId          && { asesorId: data.asesorId }),
      ...(data.etapa             && { etapa: data.etapa }),
      ...(data.notas !== undefined && { notas: data.notas }),
      ...(data.fechaContacto     && { fechaContacto:     new Date(data.fechaContacto)     }),
      ...(data.fechaReunion      && { fechaReunion:       new Date(data.fechaReunion)       }),
      ...(data.fechaProxContacto && { fechaProxContacto:  new Date(data.fechaProxContacto)  }),
    },
    include,
  })
  return ApiResponse.success(res, negociacion)
}

export async function eliminar(req: Request, res: Response) {
  const neg = await prisma.negociacion.findUnique({ where: { id: req.params.id } })
  if (!neg) throw new NotFoundError('Negociación no encontrada')
  await prisma.negociacion.delete({ where: { id: req.params.id } })
  return ApiResponse.success(res, { message: 'Negociación eliminada' })
}
