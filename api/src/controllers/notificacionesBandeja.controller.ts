/**
 * La bandeja de la campana: lo que cada quien tiene sin leer.
 *
 * Separado de `notificaciones.controller`, que solo administra las
 * suscripciones al push del navegador — son dos cosas distintas que
 * comparten nombre.
 */

import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { ForbiddenError, NotFoundError } from '../utils/errors'

/** Cuántas caben en el panel sin que haya que hacerle scroll eterno. */
const TOPE = 30

export async function listar(req: Request, res: Response) {
  const [avisos, sinLeer] = await Promise.all([
    prisma.notificacion.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: TOPE,
      include: { autor: { select: { nombre: true, email: true, image: true } } },
    }),
    prisma.notificacion.count({ where: { userId: req.userId, leidaEn: null } }),
  ])
  return ApiResponse.success(res, { avisos, sinLeer })
}

/** Se marca sola al abrir el aviso; de ahí que no pida cuerpo. */
export async function marcarLeida(req: Request, res: Response) {
  const aviso = await prisma.notificacion.findUnique({
    where: { id: req.params.id },
    select: { userId: true },
  })
  if (!aviso) throw new NotFoundError('Aviso no encontrado')
  if (aviso.userId !== req.userId) throw new ForbiddenError('Ese aviso no es tuyo')

  await prisma.notificacion.update({
    where: { id: req.params.id },
    data: { leidaEn: new Date() },
  })
  return ApiResponse.success(res, { ok: true })
}

export async function marcarTodasLeidas(req: Request, res: Response) {
  const { count } = await prisma.notificacion.updateMany({
    where: { userId: req.userId, leidaEn: null },
    data: { leidaEn: new Date() },
  })
  return ApiResponse.success(res, { marcadas: count })
}
