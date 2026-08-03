import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { ForbiddenError } from '../utils/errors'

async function miAsesorId(req: Request): Promise<string> {
  if (req.asesorId) return req.asesorId
  const asesor = await prisma.asesor.findUnique({ where: { userId: req.userId } })
  if (!asesor) throw new ForbiddenError('Tu usuario no tiene un perfil de asesor asociado')
  return asesor.id
}

// Cursos activos con link de Hotmart configurado + si el asesor actual ya se marcó afiliado.
export async function listarMisAfiliaciones(req: Request, res: Response) {
  const asesorId = await miAsesorId(req)

  const [cursos, marcados] = await Promise.all([
    prisma.curso.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, linkAfiliacion: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.afiliacionAsesor.findMany({ where: { asesorId }, select: { cursoId: true } }),
  ])

  const afiliados = new Set(marcados.map(m => m.cursoId))
  return ApiResponse.success(res, cursos.map(c => ({ ...c, afiliado: afiliados.has(c.id) })))
}

export async function marcarAfiliacion(req: Request, res: Response) {
  const asesorId = await miAsesorId(req)
  await prisma.afiliacionAsesor.upsert({
    where: { asesorId_cursoId: { asesorId, cursoId: req.params.cursoId } },
    create: { asesorId, cursoId: req.params.cursoId },
    update: {},
  })
  return ApiResponse.success(res, { afiliado: true })
}

export async function desmarcarAfiliacion(req: Request, res: Response) {
  const asesorId = await miAsesorId(req)
  await prisma.afiliacionAsesor.deleteMany({ where: { asesorId, cursoId: req.params.cursoId } })
  return ApiResponse.success(res, { afiliado: false })
}

// Matriz asesor × curso, solo ADMIN — para ver de un vistazo a quién le falta qué.
export async function resumenEquipo(_req: Request, res: Response) {
  const [asesores, cursos, marcados] = await Promise.all([
    prisma.asesor.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    prisma.curso.findMany({
      where: { activo: true, linkAfiliacion: { not: null } },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.afiliacionAsesor.findMany({ select: { asesorId: true, cursoId: true } }),
  ])

  const set = new Set(marcados.map(m => `${m.asesorId}:${m.cursoId}`))
  return ApiResponse.success(res, {
    cursos,
    asesores: asesores.map(a => ({
      ...a,
      afiliados: cursos.filter(c => set.has(`${a.id}:${c.id}`)).length,
      total: cursos.length,
      cursos: cursos.map(c => set.has(`${a.id}:${c.id}`)),
    })),
  })
}
