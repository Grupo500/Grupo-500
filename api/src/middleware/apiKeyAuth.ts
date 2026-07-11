import { Request, Response, NextFunction } from 'express'
import { prisma } from '../config/prisma'
import { UnauthorizedError } from '../utils/errors'
import { logSecurityEvent } from '../utils/logger'
import { hashApiKey } from '../utils/apiKeys'

declare global {
  namespace Express {
    interface Request {
      apiKeyId?: string
    }
  }
}

export async function authenticateApiKey(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers['x-api-key'] ?? req.headers.authorization?.replace('Bearer ', '')
    const key = Array.isArray(header) ? header[0] : header
    if (!key) throw new UnauthorizedError('API key requerida')

    const apiKey = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(key) } })
    if (!apiKey || !apiKey.activa) {
      logSecurityEvent('API_KEY_INVALIDA', { ip: req.ip, url: req.originalUrl, method: req.method })
      throw new UnauthorizedError('API key inválida o revocada')
    }

    req.apiKeyId = apiKey.id
    void prisma.apiKey.update({ where: { id: apiKey.id }, data: { ultimoUso: new Date() } }).catch(() => {})

    next()
  } catch (error) {
    if (error instanceof UnauthorizedError) return next(error)
    return next(error)
  }
}
