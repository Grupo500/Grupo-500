import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { NotFoundError } from '../utils/errors'
import { z } from 'zod'
import crypto from 'crypto'

const generarSchema = z.object({
  estudianteId: z.string(),
  tipo: z.enum(['CURSANDO', 'COMPLETADO']),
})

function generarNumeroSerie(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `G500-${timestamp}-${random}`
}

export async function listar(_req: Request, res: Response) {
  const certificados = await prisma.certificado.findMany({
    include: {
      estudiante: {
        include: {
          colegio: true,
          cursos: { include: { curso: true }, orderBy: { fechaCompra: 'asc' }, take: 1 },
        },
      },
    },
    orderBy: { fechaEmision: 'desc' },
  })
  return ApiResponse.success(res, certificados)
}

export async function generar(req: Request, res: Response) {
  const { estudianteId, tipo } = generarSchema.parse(req.body)

  const estudiante = await prisma.estudiante.findUnique({
    where: { id: estudianteId },
    include: { cursos: { include: { curso: true } } },
  })

  if (!estudiante) throw new NotFoundError('Estudiante no encontrado')

  // Por ahora se genera con URL placeholder — Cloudinary en siguiente fase
  const certificado = await prisma.certificado.create({
    data: {
      estudianteId,
      tipo,
      numeroSerie: generarNumeroSerie(),
      archivoUrl: '', // Se poblará con Cloudinary
    },
    include: { estudiante: true },
  })

  return ApiResponse.created(res, certificado)
}

export async function obtener(req: Request, res: Response) {
  const certificado = await prisma.certificado.findUnique({
    where: { id: req.params.id },
    include: { estudiante: true },
  })
  if (!certificado) throw new NotFoundError('Certificado no encontrado')
  return ApiResponse.success(res, certificado)
}

export async function porEstudiante(req: Request, res: Response) {
  const certificados = await prisma.certificado.findMany({
    where: { estudianteId: req.params.estudianteId },
    orderBy: { fechaEmision: 'desc' },
  })
  return ApiResponse.success(res, certificados)
}
