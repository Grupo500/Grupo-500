import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { NotFoundError } from '../utils/errors'
import { z } from 'zod'

const schema = z.object({
  nombre:       z.string().min(2),
  descripcion:  z.string().optional(),
  precio:       z.number().positive(),
  duracionHoras: z.number().int().positive(),
  tipoCurso:    z.enum(['INDIVIDUAL', 'COMBO']).optional(),
  fechaInicio:  z.string().datetime().optional().nullable(),
  fechaFin:     z.string().datetime().optional().nullable(),
})

export async function listar(_req: Request, res: Response) {
  const cursos = await prisma.curso.findMany({
    include: { _count: { select: { estudiantes: true } } },
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
  })
  return ApiResponse.success(res, cursos)
}

export async function crear(req: Request, res: Response) {
  const data = schema.parse(req.body)
  const curso = await prisma.curso.create({ data })
  return ApiResponse.created(res, curso)
}

export async function obtener(req: Request, res: Response) {
  // VENDEDOR → solo sus estudiantes en el curso; ADMIN → todos
  const filtroAsesor = req.userRole === 'VENDEDOR' && req.asesorId ? req.asesorId : undefined
  const whereEst = filtroAsesor ? { estudiante: { asesorId: filtroAsesor } } : {}

  const curso = await prisma.curso.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { estudiantes: { where: whereEst } } },
      estudiantes: {
        where: whereEst,
        orderBy: { fechaCompra: 'desc' },
        select: {
          id: true,
          fechaCompra: true,
          precioAcordado: true,
          estudiante: {
            select: {
              id: true, nombre: true, email: true, telefono: true,
              ciudad: true, verificado: true,
              asesor: { select: { nombre: true } },
            },
          },
        },
      },
    },
  })
  if (!curso) throw new NotFoundError('Curso no encontrado')
  return ApiResponse.success(res, curso)
}

const actualizarSchema = z.object({
  nombre:           z.string().min(2).optional(),
  descripcion:      z.string().optional(),
  precio:           z.number().positive().optional(),
  duracionHoras:    z.number().int().positive().optional(),
  calendario:       z.enum(['A', 'B']).optional(),
  fechaInicio:      z.string().datetime().optional().nullable(),
  fechaFin:         z.string().datetime().optional().nullable(),
  fechaIcfes:       z.string().datetime().optional().nullable(),
  simulacros:       z.number().int().min(0).optional().nullable(),
  activo:           z.boolean().optional(),
  tipoCurso:        z.enum(['INDIVIDUAL', 'COMBO']).optional(),
  visibleEnLanding: z.boolean().optional(),
  cuposDisponibles: z.number().int().min(0).optional().nullable(),
})

export async function actualizar(req: Request, res: Response) {
  const data = actualizarSchema.parse(req.body)
  const curso = await prisma.curso.update({ where: { id: req.params.id }, data })
  return ApiResponse.success(res, curso)
}

export async function eliminar(req: Request, res: Response) {
  await prisma.curso.update({ where: { id: req.params.id }, data: { activo: false } })
  return ApiResponse.noContent(res)
}

export async function asignarACurso(req: Request, res: Response) {
  const { estudianteId, cursoId } = z.object({
    estudianteId: z.string(),
    cursoId: z.string(),
  }).parse(req.body)

  const asignacion = await prisma.cursoEstudiante.create({
    data: { estudianteId, cursoId },
    include: { curso: true, estudiante: true },
  })

  return ApiResponse.created(res, asignacion)
}
