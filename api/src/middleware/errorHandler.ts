import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import * as Sentry from '@sentry/node'
import { AppError, ValidationError } from '../utils/errors'
import { logger } from '../utils/logger'

type ReqWithId = Request & { reqId?: string }

export function errorHandler(err: Error, req: ReqWithId, res: Response, _next: NextFunction) {
  const reqId = req.reqId

  // Errores de validación Zod → 400 (no reportar a Sentry, son errores del cliente)
  if (err instanceof ZodError) {
    const messages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    return res.status(400).json({
      success: false,
      error: `Datos inválidos: ${messages}`,
      errors: err.errors,
    })
  }

  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(err.errors && { errors: err.errors }),
    })
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    })
  }

  // Error inesperado — loguear con reqId y reportar a Sentry
  logger.error({ reqId, error: err.message, stack: err.stack, url: req.url, method: req.method })

  if (process.env.SENTRY_DSN) {
    Sentry.withScope(scope => {
      scope.setTag('reqId', reqId ?? 'unknown')
      scope.setContext('request', { url: req.url, method: req.method })
      Sentry.captureException(err)
    })
  }

  return res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message,
  })
}

export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
