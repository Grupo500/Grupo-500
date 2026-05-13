import { Request, Response, NextFunction } from 'express'
import { createClerkClient } from '@clerk/backend'
import { prisma } from '../config/prisma'
import { UnauthorizedError, ForbiddenError } from '../utils/errors'
import { Role } from '@prisma/client'

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

declare global {
  namespace Express {
    interface Request {
      userId?: string
      userRole?: Role
      asesorId?: string
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) throw new UnauthorizedError('Token requerido')

    const { sub: clerkId } = await clerk.verifyToken(token)

    const user = await prisma.user.findUnique({ where: { clerkId }, include: { asesor: true } })
    if (!user) throw new UnauthorizedError('Usuario no encontrado')

    req.userId = user.id
    req.userRole = user.role
    req.asesorId = user.asesor?.id

    next()
  } catch (error) {
    next(error instanceof UnauthorizedError ? error : new UnauthorizedError())
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return next(new ForbiddenError('No tienes permisos para esta acción'))
    }
    next()
  }
}
