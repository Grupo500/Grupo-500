import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { NotFoundError } from '../utils/errors'
import { generarApiKey } from '../utils/apiKeys'

const crearSchema = z.object({
  nombre: z.string().min(1),
  scopes: z.array(z.string()).default([]),
})

export async function crear(req: Request, res: Response) {
  const { nombre, scopes } = crearSchema.parse(req.body)
  const { key, hash, prefijo } = generarApiKey()

  const apiKey = await prisma.apiKey.create({
    data: { nombre, scopes, keyHash: hash, prefijo, creadaPorId: req.userId! },
  })

  // El secreto solo se devuelve en esta respuesta — nunca más se puede recuperar
  return ApiResponse.created(res, { ...apiKey, key })
}

export async function listar(_req: Request, res: Response) {
  const keys = await prisma.apiKey.findMany({
    select: {
      id: true, nombre: true, prefijo: true, scopes: true, activa: true,
      ultimoUso: true, createdAt: true, revocadaAt: true,
      creadaPor: { select: { nombre: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return ApiResponse.success(res, keys)
}

export async function revocar(req: Request, res: Response) {
  const apiKey = await prisma.apiKey.findUnique({ where: { id: req.params.id } })
  if (!apiKey) throw new NotFoundError('API key no encontrada')

  await prisma.apiKey.update({
    where: { id: req.params.id },
    data: { activa: false, revocadaAt: new Date() },
  })
  return ApiResponse.noContent(res)
}
