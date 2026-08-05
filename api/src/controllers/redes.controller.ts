import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { NotFoundError } from '../utils/errors'
import { z } from 'zod'
import { getMetaConfig, intercambiarCodigo, vincularCuentas, META_SCOPES } from '../services/metaGraph.service'

// El accessToken de las cuentas jamás sale del API
const SELECT_CUENTA = {
  id: true, plataforma: true, nombre: true, externalId: true,
  fotoUrl: true, activa: true, creadaEn: true,
} as const

const SELECT_PUBLICACION = {
  id: true, tipo: true, caption: true, mediaUrl: true, mediaEsVideo: true,
  programadaPara: true, estado: true, error: true, externalId: true,
  publicadaEn: true, creadaEn: true,
  cuenta: { select: SELECT_CUENTA },
} as const

// ── Configuración de la App de Meta ──────────────────────────────────────────

export async function estadoConfig(req: Request, res: Response) {
  const { appId, configId, configurada } = await getMetaConfig()
  return ApiResponse.success(res, { configurada, appId, configId })
}

const configSchema = z.object({
  appId: z.string().min(5).regex(/^\d+$/, 'El App ID de Meta es numérico'),
  appSecret: z.string().min(16),
  configId: z.string().regex(/^\d*$/, 'El Config ID de Meta es numérico').optional(),
})

export async function guardarConfig(req: Request, res: Response) {
  const { appId, appSecret, configId } = configSchema.parse(req.body)
  const upsert = (clave: string, valor: string) =>
    prisma.configApp.upsert({ where: { clave }, create: { clave, valor }, update: { valor } })
  const ops = [upsert('META_APP_ID', appId), upsert('META_APP_SECRET', appSecret)]
  if (configId !== undefined) {
    ops.push(configId
      ? upsert('META_CONFIG_ID', configId)
      : prisma.configApp.upsert({ where: { clave: 'META_CONFIG_ID' }, create: { clave: 'META_CONFIG_ID', valor: '' }, update: { valor: '' } }))
  }
  await prisma.$transaction(ops)
  return ApiResponse.success(res, { configurada: true, appId, configId: configId ?? null })
}

// ── OAuth ────────────────────────────────────────────────────────────────────

const oauthUrlSchema = z.object({ redirectUri: z.string().url().startsWith('https://') })

export async function oauthUrl(req: Request, res: Response) {
  const { redirectUri } = oauthUrlSchema.parse(req.query)
  const { appId, configId, configurada } = await getMetaConfig()
  if (!configurada) return ApiResponse.error(res, 'Primero configura el App ID y App Secret de Meta', 409)
  const qs = new URLSearchParams({
    client_id: appId!,
    redirect_uri: redirectUri,
    response_type: 'code',
    // sin esto, una autorización previa hace que Meta salte la pantalla de
    // selección de páginas y devuelva un token sin activos (cero páginas)
    auth_type: 'rerequest',
  })
  // Apps tipo Negocios (Login for Business): permisos vía Configuración; scopes sueltos dan "Invalid Scopes"
  if (configId) qs.set('config_id', configId)
  else qs.set('scope', META_SCOPES)
  return ApiResponse.success(res, { url: `https://www.facebook.com/v21.0/dialog/oauth?${qs}` })
}

const conectarSchema = z.object({
  code: z.string().min(5),
  redirectUri: z.string().url().startsWith('https://'),
})

export async function conectar(req: Request, res: Response) {
  const { code, redirectUri } = conectarSchema.parse(req.body)
  const userToken = await intercambiarCodigo(code, redirectUri)
  const cuentas = await vincularCuentas(userToken)
  return ApiResponse.success(res, { vinculadas: cuentas.length })
}

// ── Cuentas ──────────────────────────────────────────────────────────────────

export async function listarCuentas(req: Request, res: Response) {
  const cuentas = await prisma.redSocialCuenta.findMany({
    where: { activa: true },
    select: SELECT_CUENTA,
    orderBy: [{ plataforma: 'asc' }, { nombre: 'asc' }],
  })
  return ApiResponse.success(res, cuentas)
}

export async function eliminarCuenta(req: Request, res: Response) {
  const cuenta = await prisma.redSocialCuenta.findUnique({ where: { id: req.params.id } })
  if (!cuenta) throw new NotFoundError('Cuenta no encontrada')
  // desactivar (no borrar) para conservar el historial de publicaciones
  await prisma.redSocialCuenta.update({ where: { id: cuenta.id }, data: { activa: false } })
  return ApiResponse.noContent(res)
}

// ── Publicaciones programadas ────────────────────────────────────────────────

export async function listarPublicaciones(req: Request, res: Response) {
  const publicaciones = await prisma.publicacionRed.findMany({
    select: SELECT_PUBLICACION,
    orderBy: { programadaPara: 'desc' },
    take: 200,
  })
  return ApiResponse.success(res, publicaciones)
}

const crearSchema = z.object({
  tipo: z.enum(['POST', 'HISTORIA', 'REEL']),
  caption: z.string().max(2200).optional(),
  mediaUrl: z.string().url().optional(),
  mediaEsVideo: z.boolean().default(false),
  programadaPara: z.string().datetime({ offset: true }),
  cuentaIds: z.array(z.string()).min(1),
})

export async function crearPublicacion(req: Request, res: Response) {
  const datos = crearSchema.parse(req.body)
  const cuentas = await prisma.redSocialCuenta.findMany({
    where: { id: { in: datos.cuentaIds }, activa: true },
  })
  if (cuentas.length !== datos.cuentaIds.length) {
    return ApiResponse.error(res, 'Alguna de las cuentas seleccionadas no existe o está desvinculada', 400)
  }
  if ((datos.tipo === 'HISTORIA' || datos.tipo === 'REEL') && !datos.mediaUrl) {
    return ApiResponse.error(res, 'Las historias y reels necesitan una imagen o video', 400)
  }
  if (datos.tipo === 'REEL' && !datos.mediaEsVideo) {
    return ApiResponse.error(res, 'Un reel debe ser un video', 400)
  }
  const hayInstagram = cuentas.some(c => c.plataforma === 'INSTAGRAM')
  if (hayInstagram && datos.tipo === 'POST' && !datos.mediaUrl) {
    return ApiResponse.error(res, 'Instagram no permite posts de solo texto: agrega imagen o video', 400)
  }
  if (datos.tipo === 'POST' && !datos.mediaUrl && !datos.caption) {
    return ApiResponse.error(res, 'El post necesita texto o una imagen/video', 400)
  }

  const creadas = await prisma.$transaction(cuentas.map(cuenta =>
    prisma.publicacionRed.create({
      data: {
        tipo: datos.tipo,
        caption: datos.caption ?? null,
        mediaUrl: datos.mediaUrl ?? null,
        mediaEsVideo: datos.mediaEsVideo,
        programadaPara: new Date(datos.programadaPara),
        cuentaId: cuenta.id,
        creadaPorId: (req as Request & { user?: { id?: string } }).user?.id ?? null,
      },
      select: SELECT_PUBLICACION,
    }),
  ))
  return ApiResponse.created(res, creadas)
}

export async function cancelarPublicacion(req: Request, res: Response) {
  const { count } = await prisma.publicacionRed.updateMany({
    where: { id: req.params.id, estado: 'PROGRAMADA' },
    data: { estado: 'CANCELADA' },
  })
  if (!count) return ApiResponse.error(res, 'Solo se puede cancelar una publicación aún programada', 409)
  return ApiResponse.noContent(res)
}

export async function publicarAhora(req: Request, res: Response) {
  const { count } = await prisma.publicacionRed.updateMany({
    where: { id: req.params.id, estado: { in: ['PROGRAMADA', 'ERROR'] } },
    data: { estado: 'PROGRAMADA', programadaPara: new Date(), error: null },
  })
  if (!count) return ApiResponse.error(res, 'Esta publicación no se puede reenviar', 409)
  return ApiResponse.success(res, { enCola: true })
}

export async function eliminarPublicacion(req: Request, res: Response) {
  const pub = await prisma.publicacionRed.findUnique({ where: { id: req.params.id } })
  if (!pub) throw new NotFoundError('Publicación no encontrada')
  if (pub.estado === 'PUBLICANDO') return ApiResponse.error(res, 'Se está publicando en este momento', 409)
  await prisma.publicacionRed.delete({ where: { id: pub.id } })
  return ApiResponse.noContent(res)
}
