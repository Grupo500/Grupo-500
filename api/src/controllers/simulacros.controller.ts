import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { NotFoundError } from '../utils/errors'

export async function listar(_req: Request, res: Response) {
  const simulacros = await prisma.simulacro.findMany({
    include: { _count: { select: { estudiantes: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return ApiResponse.success(res, simulacros)
}

export async function subir(req: Request, res: Response) {
  const { nombre, archivoUrl } = req.body

  const simulacro = await prisma.simulacro.create({
    data: { nombre, archivoUrl },
  })

  return ApiResponse.created(res, simulacro)
}

export async function analizar(req: Request, res: Response) {
  const { id } = req.params

  const simulacro = await prisma.simulacro.findUnique({ where: { id } })
  if (!simulacro) throw new NotFoundError('Simulacro no encontrado')

  // Análisis stub — integración real con parseo de PDF en siguiente fase
  await prisma.simulacro.update({ where: { id }, data: { procesado: true } })

  return ApiResponse.success(res, {
    mensaje: 'Análisis iniciado. Los resultados estarán disponibles pronto.',
    simulacroId: id,
  })
}

export async function resultados(req: Request, res: Response) {
  const resultados = await prisma.simulacroEstudiante.findMany({
    where: { simulacroId: req.params.id },
    include: { estudiante: true },
    orderBy: { puntajeTotal: 'desc' },
  })
  return ApiResponse.success(res, resultados)
}
