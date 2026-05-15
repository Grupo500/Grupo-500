import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'

const CLAVES = {
  firmaSebastian: 'firma_sebastian',
  firmaAndres:    'firma_andres',
}

export async function getFirmas(_req: Request, res: Response) {
  const configs = await prisma.configApp.findMany({
    where: { clave: { in: Object.values(CLAVES) } },
  })

  const map = Object.fromEntries(configs.map(c => [c.clave, c.valor]))

  return ApiResponse.success(res, {
    firmaSebastian: map[CLAVES.firmaSebastian] ?? null,
    firmaAndres:    map[CLAVES.firmaAndres]    ?? null,
  })
}

export async function subirFirma(quien: 'sebastian' | 'andres') {
  return async (req: Request, res: Response) => {
    const file = req.file as Express.Multer.File & { path: string }
    if (!file) return res.status(400).json({ error: 'No se recibió imagen' })

    const clave = quien === 'sebastian' ? CLAVES.firmaSebastian : CLAVES.firmaAndres

    await prisma.configApp.upsert({
      where:  { clave },
      update: { valor: file.path },
      create: { clave, valor: file.path },
    })

    return ApiResponse.success(res, { url: file.path })
  }
}
