import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { ForbiddenError, NotFoundError } from '../utils/errors'
import { z } from 'zod'

const SELECT_MIEMBRO = { id: true, nombre: true, activo: true, user: { select: { image: true } } }

// ── Miembros del equipo ──────────────────────────────────────────────────────
export async function listarMiembros(req: Request, res: Response) {
  const soloActivos = req.query.activo !== 'false'
  const miembros = await prisma.miembroMarketing.findMany({
    where: soloActivos ? { activo: true } : {},
    select: SELECT_MIEMBRO,
    orderBy: { nombre: 'asc' },
  })
  return ApiResponse.success(res, miembros)
}

// ── Contenidos (calendario) ──────────────────────────────────────────────────
const rangoSchema = z.object({
  desde: z.string(),
  hasta: z.string(),
})

export async function listarContenidos(req: Request, res: Response) {
  const { desde, hasta } = rangoSchema.parse(req.query)
  const contenidos = await prisma.contenidoMarketing.findMany({
    where: {
      fecha: {
        gte: new Date(desde + 'T00:00:00'),
        lte: new Date(hasta + 'T23:59:59'),
      },
    },
    include: {
      asignadoA: { select: SELECT_MIEMBRO },
      guion: { select: { id: true, titulo: true } },
      entregables: true,
    },
    orderBy: { fecha: 'asc' },
  })
  return ApiResponse.success(res, contenidos)
}

const TIPO_CONTENIDO = ['VIDEO', 'VSL', 'CARRUSEL', 'CARRUMEME', 'TIKTOKERO', 'GUION', 'PUBLICACION', 'OTRO'] as const
const DESTINO = ['SEBASTIAN_PERSONAL', 'ANDRES_PERSONAL', 'PREICFES', 'PREMEDICO'] as const
const CLASIFICACION = ['ORGANICO', 'PAUTA'] as const

const crearContenidoSchema = z.object({
  titulo:        z.string().min(2),
  tipo:          z.enum(TIPO_CONTENIDO),
  destino:       z.enum(DESTINO).optional().nullable(),
  clasificacion: z.enum(CLASIFICACION).optional(),
  fecha:         z.string(),
  asignadoAId:   z.string().optional().nullable(),
  guionId:       z.string().optional().nullable(),
  notas:         z.string().optional().nullable(),
})

export async function crearContenido(req: Request, res: Response) {
  const data = crearContenidoSchema.parse(req.body)
  const contenido = await prisma.contenidoMarketing.create({
    data: { ...data, fecha: new Date(data.fecha) },
    include: { asignadoA: { select: SELECT_MIEMBRO }, guion: { select: { id: true, titulo: true } }, entregables: true },
  })
  return ApiResponse.created(res, contenido)
}

const actualizarContenidoSchema = z.object({
  titulo:        z.string().min(2).optional(),
  tipo:          z.enum(TIPO_CONTENIDO).optional(),
  destino:       z.enum(DESTINO).optional().nullable(),
  clasificacion: z.enum(CLASIFICACION).optional(),
  fecha:         z.string().optional(),
  estado:        z.enum(['PLANIFICADO', 'EN_PROCESO', 'PUBLICADO']).optional(),
  asignadoAId:   z.string().optional().nullable(),
  guionId:       z.string().optional().nullable(),
  notas:         z.string().optional().nullable(),
})

export async function actualizarContenido(req: Request, res: Response) {
  const data = actualizarContenidoSchema.parse(req.body)
  const contenido = await prisma.contenidoMarketing.update({
    where: { id: req.params.id },
    data: { ...data, ...(data.fecha ? { fecha: new Date(data.fecha) } : {}) },
    include: { asignadoA: { select: SELECT_MIEMBRO }, guion: { select: { id: true, titulo: true } }, entregables: true },
  })
  return ApiResponse.success(res, contenido)
}

// Solo ADMIN o el propio asignado pueden borrar un contenido.
export async function eliminarContenido(req: Request, res: Response) {
  const contenido = await prisma.contenidoMarketing.findUnique({ where: { id: req.params.id } })
  if (!contenido) throw new NotFoundError('Contenido no encontrado')

  if (req.userRole !== 'ADMIN') {
    const miembro = await prisma.miembroMarketing.findUnique({ where: { userId: req.userId } })
    if (!miembro || contenido.asignadoAId !== miembro.id) {
      throw new ForbiddenError('Solo puedes eliminar contenido asignado a ti')
    }
  }

  await prisma.contenidoMarketing.delete({ where: { id: req.params.id } })
  return ApiResponse.noContent(res)
}

// ── Entregables ───────────────────────────────────────────────────────────
const crearEntregableSchema = z.object({
  plataforma: z.enum(['YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'DRIVE', 'OTRO']),
  url:        z.string().url().optional().nullable(),
  videoUrl:   z.string().url().optional().nullable(),
}).refine(d => d.url || d.videoUrl, { message: 'Se requiere un link o un video subido' })

export async function crearEntregable(req: Request, res: Response) {
  const data = crearEntregableSchema.parse(req.body)
  const contenido = await prisma.contenidoMarketing.findUnique({ where: { id: req.params.id } })
  if (!contenido) throw new NotFoundError('Contenido no encontrado')

  const entregable = await prisma.entregable.create({
    data: { ...data, contenidoId: req.params.id },
  })
  // Publicar un entregable implica que el contenido ya quedó listo.
  await prisma.contenidoMarketing.update({ where: { id: req.params.id }, data: { estado: 'PUBLICADO' } })
  return ApiResponse.created(res, entregable)
}

export async function eliminarEntregable(req: Request, res: Response) {
  await prisma.entregable.delete({ where: { id: req.params.id } })
  return ApiResponse.noContent(res)
}

export async function listarEntregables(req: Request, res: Response) {
  const { desde, hasta, plataforma } = req.query
  const entregables = await prisma.entregable.findMany({
    where: {
      ...(desde && hasta ? {
        publicadoEn: { gte: new Date(String(desde) + 'T00:00:00'), lte: new Date(String(hasta) + 'T23:59:59') },
      } : {}),
      ...(plataforma ? { plataforma: String(plataforma) as any } : {}),
    },
    include: {
      contenido: { include: { asignadoA: { select: SELECT_MIEMBRO } } },
    },
    orderBy: { publicadoEn: 'desc' },
  })
  return ApiResponse.success(res, entregables)
}

// ── Guiones ───────────────────────────────────────────────────────────────
export async function listarGuiones(req: Request, res: Response) {
  const q = String(req.query.q ?? '').trim()
  const guiones = await prisma.guion.findMany({
    where: q ? { titulo: { contains: q, mode: 'insensitive' } } : {},
    include: { autor: { select: SELECT_MIEMBRO } },
    orderBy: { updatedAt: 'desc' },
  })
  return ApiResponse.success(res, guiones)
}

const crearGuionSchema = z.object({
  titulo:    z.string().min(2),
  contenido: z.string().min(1),
})

export async function crearGuion(req: Request, res: Response) {
  const data = crearGuionSchema.parse(req.body)
  const miembro = await prisma.miembroMarketing.findUnique({ where: { userId: req.userId } })
  if (!miembro) throw new ForbiddenError('Tu usuario no tiene un perfil de marketing asociado')

  const guion = await prisma.guion.create({
    data: { ...data, autorId: miembro.id },
    include: { autor: { select: SELECT_MIEMBRO } },
  })
  return ApiResponse.created(res, guion)
}

const actualizarGuionSchema = z.object({
  titulo:    z.string().min(2).optional(),
  contenido: z.string().min(1).optional(),
})

export async function actualizarGuion(req: Request, res: Response) {
  const data = actualizarGuionSchema.parse(req.body)
  const guion = await prisma.guion.update({
    where: { id: req.params.id },
    data,
    include: { autor: { select: SELECT_MIEMBRO } },
  })
  return ApiResponse.success(res, guion)
}

// Solo ADMIN o el propio autor pueden borrar un guion.
export async function eliminarGuion(req: Request, res: Response) {
  const guion = await prisma.guion.findUnique({ where: { id: req.params.id } })
  if (!guion) throw new NotFoundError('Guion no encontrado')

  if (req.userRole !== 'ADMIN') {
    const miembro = await prisma.miembroMarketing.findUnique({ where: { userId: req.userId } })
    if (!miembro || guion.autorId !== miembro.id) {
      throw new ForbiddenError('Solo puedes eliminar guiones propios')
    }
  }

  await prisma.guion.delete({ where: { id: req.params.id } })
  return ApiResponse.noContent(res)
}
