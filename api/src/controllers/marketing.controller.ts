import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors'
import { auditLog } from '../utils/auditLogger'
import { esLiderMarketing } from '../utils/roles'
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
      entregables: true,
    },
    orderBy: { fecha: 'asc' },
  })
  return ApiResponse.success(res, contenidos)
}

const TIPO_CONTENIDO = ['VIDEO', 'VSL', 'CARRUSEL', 'CARRUMEME', 'TIKTOKERO', 'GUION', 'PUBLICACION', 'OTRO'] as const
const DESTINO = ['SEBASTIAN_PERSONAL', 'ANDRES_PERSONAL', 'PREICFES', 'PREMEDICO'] as const
const CLASIFICACION = ['ORGANICO', 'PAUTA'] as const
const TIPO_TRABAJO  = ['EMPRESA', 'FREELANCE'] as const

// El valor solo tiene sentido en un freelance: en un trabajo de empresa se
// guarda null aunque el cliente lo mande, para que no queden importes colgando
// de trabajo interno. Se normaliza aquí y no en el formulario porque la API
// también la usan otros clientes.
function valorSegunTrabajo(
  tipoTrabajo: 'EMPRESA' | 'FREELANCE' | undefined,
  valor: number | null | undefined,
) {
  if (tipoTrabajo === 'FREELANCE') return valor ?? null
  return tipoTrabajo === 'EMPRESA' ? null : undefined
}

const crearContenidoSchema = z.object({
  titulo:        z.string().min(2),
  tipo:          z.enum(TIPO_CONTENIDO),
  destino:       z.enum(DESTINO).optional().nullable(),
  clasificacion: z.enum(CLASIFICACION).optional(),
  fecha:         z.string(),
  asignadoAId:   z.string().optional().nullable(),
  notas:         z.string().optional().nullable(),
  tipoTrabajo:   z.enum(TIPO_TRABAJO).optional(),
  valor:         z.number().int().min(0).optional().nullable(),
})

export async function crearContenido(req: Request, res: Response) {
  const data = crearContenidoSchema.parse(req.body)
  const contenido = await prisma.contenidoMarketing.create({
    data: {
      ...data,
      fecha: new Date(data.fecha),
      valor: valorSegunTrabajo(data.tipoTrabajo, data.valor) ?? null,
    },
    include: { asignadoA: { select: SELECT_MIEMBRO }, entregables: true },
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
  notas:         z.string().optional().nullable(),
  tipoTrabajo:   z.enum(TIPO_TRABAJO).optional(),
  valor:         z.number().int().min(0).optional().nullable(),
})

export async function actualizarContenido(req: Request, res: Response) {
  const data = actualizarContenidoSchema.parse(req.body)
  const contenido = await prisma.contenidoMarketing.update({
    where: { id: req.params.id },
    data: {
      ...data,
      ...(data.fecha ? { fecha: new Date(data.fecha) } : {}),
      // Si el trabajo pasa a ser de empresa, el valor que tuviera se descarta.
      ...(valorSegunTrabajo(data.tipoTrabajo, data.valor) !== undefined
        ? { valor: valorSegunTrabajo(data.tipoTrabajo, data.valor) }
        : {}),
    },
    include: { asignadoA: { select: SELECT_MIEMBRO }, entregables: true },
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





// Solo ADMIN o el propio autor pueden borrar un guion.

// ───────────────────────────────────────────────────────────────────────────
// Cobros freelance
//
// El cobro no es una tabla aparte: es el contenido visto desde el dinero. Un
// trabajo freelance ES un cobro, así que separarlos obligaría a mantener dos
// filas sincronizadas para el mismo hecho.
//
// Quién ve qué: los líderes y el admin ven los de todo el equipo y son los que
// aprueban; el resto ve solo los suyos. Lo que cobra un editor no es asunto de
// los demás editores.
// ───────────────────────────────────────────────────────────────────────────

const SELECT_COBRO = {
  id: true, titulo: true, tipo: true, fecha: true, estado: true,
  valor: true, estadoCobro: true, aprobadoEn: true, pagadoEn: true,
  asignadoA:   { select: SELECT_MIEMBRO },
  aprobadoPor: { select: { id: true, nombre: true } },
  entregables: { select: { id: true, publicadoEn: true } },
}

/** El perfil de marketing de quien consulta, o null si no tiene. */
async function miMiembro(userId?: string) {
  if (!userId) return null
  return prisma.miembroMarketing.findUnique({ where: { userId }, select: { id: true } })
}

export async function listarCobros(req: Request, res: Response) {
  const { desde, hasta, estado } = req.query
  const lider = esLiderMarketing(req.userRole)

  // Sin perfil de marketing y sin ser líder no hay nada que mostrar. Se filtra
  // con un id imposible en vez de dejar el where vacío: ante la duda, nada.
  const yo = lider ? null : (await miMiembro(req.userId))?.id ?? '__sin_miembro__'

  const where = {
    tipoTrabajo: 'FREELANCE' as const,
    ...(yo ? { asignadoAId: yo } : {}),
    ...(estado ? { estadoCobro: String(estado) as any } : {}),
    ...(desde && hasta ? { fecha: { gte: new Date(String(desde)), lte: new Date(String(hasta)) } } : {}),
  }

  const cobros = await prisma.contenidoMarketing.findMany({
    where, select: SELECT_COBRO, orderBy: [{ estadoCobro: 'asc' }, { fecha: 'desc' }],
  })

  // Los totales se calculan sobre lo mismo que se lista, para que el número de
  // arriba siempre cuadre con las filas de abajo.
  const suma = (e: string) =>
    cobros.filter(c => c.estadoCobro === e).reduce((s, c) => s + (c.valor ?? 0), 0)

  return ApiResponse.success(res, {
    cobros,
    puedeAprobar: lider,
    totales: {
      porAprobar: suma('POR_APROBAR'),
      aprobado:   suma('APROBADO'),
      pagado:     suma('PAGADO'),
    },
  })
}

/** Aprobar y marcar pagado son del líder; el resto no puede ni intentarlo. */
async function cambiarEstadoCobro(
  req: Request, res: Response,
  destino: 'APROBADO' | 'PAGADO',
) {
  if (!esLiderMarketing(req.userRole)) {
    return res.status(403).json({ error: 'Solo la líder de edición o un administrador pueden hacer esto' })
  }
  const actual = await prisma.contenidoMarketing.findUnique({
    where: { id: req.params.id },
    select: { tipoTrabajo: true, estadoCobro: true },
  })
  if (!actual) throw new NotFoundError('Contenido no encontrado')
  if (actual.tipoTrabajo !== 'FREELANCE') {
    throw new ValidationError('Este trabajo no es freelance, no tiene cobro que aprobar')
  }
  // Se paga lo aprobado, no lo que está esperando visto bueno.
  if (destino === 'PAGADO' && actual.estadoCobro !== 'APROBADO') {
    throw new ValidationError('Hay que aprobar el cobro antes de marcarlo pagado')
  }

  const quien = await miMiembro(req.userId)
  const cobro = await prisma.contenidoMarketing.update({
    where: { id: req.params.id },
    data: destino === 'APROBADO'
      ? { estadoCobro: 'APROBADO', aprobadoEn: new Date(), ...(quien && { aprobadoPorId: quien.id }) }
      : { estadoCobro: 'PAGADO', pagadoEn: new Date() },
    select: SELECT_COBRO,
  })
  auditLog(req, 'UPDATE', 'cobro_marketing', cobro.id, { estado: destino, valor: cobro.valor })
  return ApiResponse.success(res, cobro)
}

export const aprobarCobro = (req: Request, res: Response) => cambiarEstadoCobro(req, res, 'APROBADO')
export const pagarCobro   = (req: Request, res: Response) => cambiarEstadoCobro(req, res, 'PAGADO')
