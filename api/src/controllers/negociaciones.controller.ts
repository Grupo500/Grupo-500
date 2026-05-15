import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { NotFoundError } from '../utils/errors'
import { z } from 'zod'

const etapas = ['PROSPECTO','CONTACTO_INICIAL','VISITA_PROGRAMADA','PROPUESTA_ENVIADA','EN_NEGOCIACION','CONVENIO_FIRMADO','DESCARTADO'] as const

const crearSchema = z.object({
  colegioId:          z.string(),
  asesorId:           z.string(),
  etapa:              z.enum(etapas).optional(),
  notas:              z.string().optional(),
  fechaContacto:      z.string().optional(),
  fechaVisita:        z.string().optional(),
  fechaProxContacto:  z.string().optional(),
})

const actualizarSchema = crearSchema.partial()

const include = {
  colegio: true,
  asesor:  { include: { user: { select: { email: true } } } },
}

export async function listar(_req: Request, res: Response) {
  const negociaciones = await prisma.negociacion.findMany({
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
      fechaContacto:     data.fechaContacto     ? new Date(data.fechaContacto)     : null,
      fechaVisita:       data.fechaVisita        ? new Date(data.fechaVisita)        : null,
      fechaProxContacto: data.fechaProxContacto  ? new Date(data.fechaProxContacto)  : null,
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
      ...(data.fechaVisita       && { fechaVisita:        new Date(data.fechaVisita)        }),
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
