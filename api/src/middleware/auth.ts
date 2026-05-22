import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../config/prisma'
import { UnauthorizedError, ForbiddenError } from '../utils/errors'
import { logSecurityEvent } from '../utils/logger'
import { Role, User, Asesor } from '@prisma/client'

type UserWithAsesor = User & { asesor: Asesor | null }

declare global {
  namespace Express {
    interface Request {
      userId?:   string
      userRole?: Role
      asesorId?: string
      userName?: string
    }
  }
}

interface JwtPayload {
  sub: string   // userId de la DB
  email: string
  role: Role
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) throw new UnauthorizedError('Token requerido')

    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) throw new UnauthorizedError('Configuración de auth inválida')

    const payload = jwt.verify(token, secret) as JwtPayload

    const user: UserWithAsesor | null = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { asesor: true },
    })

    if (!user) return next(new ForbiddenError('USUARIO_NO_REGISTRADO'))

    req.userId   = user.id
    req.userRole = user.role
    req.asesorId = user.asesor?.id
    req.userName = user.asesor?.nombre ?? user.nombre ?? user.email

    next()
  } catch (error) {
    logSecurityEvent('AUTH_FAILURE', {
      ip:        req.ip,
      userAgent: req.headers['user-agent'],
      url:       req.originalUrl,
      method:    req.method,
      reason:    error instanceof Error ? error.message : 'token_invalid',
    })
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      return next(error)
    }
    next(new UnauthorizedError())
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      logSecurityEvent('ACCESS_DENIED', {
        userId:        req.userId,
        userRole:      req.userRole,
        requiredRoles: roles,
        ip:            req.ip,
        url:           req.originalUrl,
        method:        req.method,
      })
      return next(new ForbiddenError('No tienes permisos para esta acción'))
    }
    next()
  }
}
