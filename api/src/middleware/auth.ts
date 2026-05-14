import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '@clerk/backend'
import { prisma } from '../config/prisma'
import { UnauthorizedError, ForbiddenError } from '../utils/errors'
import { Role, User, Asesor } from '@prisma/client'

type UserWithAsesor = User & { asesor: Asesor | null }

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

    const { sub: clerkId } = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    })

    // Buscar usuario en DB — solo usuarios pre-registrados por el admin tienen acceso
    const user: UserWithAsesor | null = await prisma.user.findUnique({
      where: { clerkId },
      include: { asesor: true },
    })

    if (!user) {
      // Usuario autenticado en Clerk pero NO registrado en el sistema
      return next(new ForbiddenError('USUARIO_NO_REGISTRADO'))
    }

    req.userId   = user.id
    req.userRole = user.role
    req.asesorId = user.asesor?.id

    next()
  } catch (error) {
    next(error instanceof UnauthorizedError || error instanceof ForbiddenError
      ? error
      : new UnauthorizedError())
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
