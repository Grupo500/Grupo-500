import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'

// El certificado lo firma solo el representante legal. Hubo una segunda
// firma configurable, pero la plantilla nunca la imprimio y no habia pantalla
// para subirla (Hotman, 21-ago).
const CLAVE_FIRMA = 'firma_andres'

export async function getFirmas(_req: Request, res: Response) {
  const config = await prisma.configApp.findUnique({ where: { clave: CLAVE_FIRMA } })

  return ApiResponse.success(res, { firmaAndres: config?.valor ?? null })
}

export async function subirFirma(req: Request, res: Response) {
  const file = req.file as Express.Multer.File & { path: string }
  if (!file) return res.status(400).json({ error: 'No se recibió imagen' })

  await prisma.configApp.upsert({
    where:  { clave: CLAVE_FIRMA },
    update: { valor: file.path },
    create: { clave: CLAVE_FIRMA, valor: file.path },
  })

  return ApiResponse.success(res, { url: file.path })
}
