import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { NotFoundError } from '../utils/errors'
import { z } from 'zod'

const crearSchema = z.object({
  nombre: z.string().min(2),
  email: z.string().email(),
  telefono: z.string().min(7),
  fechaNacimiento: z.string(),
  colegioId: z.string().optional(),
  acudiente: z.object({
    nombre: z.string().min(2),
    email: z.string().email(),
    telefono: z.string().min(7),
    relacion: z.string(),
  }).optional(),
})

export async function listar(req: Request, res: Response) {
  const { page = '1', limit = '20', nombre, colegioId, asesorId } = req.query
  const skip = (Number(page) - 1) * Number(limit)

  const where = {
    ...(nombre && { nombre: { contains: String(nombre), mode: 'insensitive' as const } }),
    ...(colegioId && { colegioId: String(colegioId) }),
    ...(asesorId && { asesorId: String(asesorId) }),
  }

  const [estudiantes, total] = await Promise.all([
    prisma.estudiante.findMany({
      where,
      include: { colegio: true, acudiente: true, asesor: true },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.estudiante.count({ where }),
  ])

  return ApiResponse.paginated(res, estudiantes, total, Number(page), Number(limit))
}

export async function crear(req: Request, res: Response) {
  const data = crearSchema.parse(req.body)

  const estudiante = await prisma.estudiante.create({
    data: {
      nombre: data.nombre,
      email: data.email,
      telefono: data.telefono,
      fechaNacimiento: new Date(data.fechaNacimiento),
      ...(data.colegioId && { colegioId: data.colegioId }),
      ...(req.asesorId && { asesorId: req.asesorId }),
      ...(data.acudiente && { acudiente: { create: data.acudiente } }),
    },
    include: { acudiente: true, colegio: true },
  })

  return ApiResponse.created(res, estudiante)
}

export async function obtener(req: Request, res: Response) {
  const estudiante = await prisma.estudiante.findUnique({
    where: { id: req.params.id },
    include: {
      colegio: true,
      acudiente: true,
      asesor: true,
      cursos: { include: { curso: true } },
      pagos: { orderBy: { createdAt: 'desc' } },
      financiamientos: { include: { cuotas: true } },
      certificados: true,
    },
  })

  if (!estudiante) throw new NotFoundError('Estudiante no encontrado')
  return ApiResponse.success(res, estudiante)
}

export async function actualizar(req: Request, res: Response) {
  const estudiante = await prisma.estudiante.update({
    where: { id: req.params.id },
    data: req.body,
  })
  return ApiResponse.success(res, estudiante)
}

export async function eliminar(req: Request, res: Response) {
  await prisma.estudiante.delete({ where: { id: req.params.id } })
  return ApiResponse.noContent(res)
}

export async function rendimiento(req: Request, res: Response) {
  const simulacros = await prisma.simulacroEstudiante.findMany({
    where: { estudianteId: req.params.id },
    include: { simulacro: true },
    orderBy: { fechaAnalisis: 'desc' },
  })
  return ApiResponse.success(res, simulacros)
}
