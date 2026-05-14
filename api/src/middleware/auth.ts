import { Request, Response, NextFunction } from 'express'
import { verifyToken, createClerkClient } from '@clerk/backend'
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

    const { sub: clerkId } = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    })

    // Auto-sincronizar usuario en DB si no existe (primer login)
    let user = await prisma.user.findUnique({ where: { clerkId }, include: { asesor: true } })
    if (!user) {
      const clerkUser = await clerk.users.getUser(clerkId)
      const email  = clerkUser.emailAddresses[0]?.emailAddress ?? ''
      const nombre = `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim()
                     || email.split('@')[0]

      user = await prisma.user.create({
        data: {
          clerkId,
          email,
          role: 'VENDEDOR',
          asesor: {
            create: {
              nombre:   nombre.charAt(0).toUpperCase() + nombre.slice(1),
              email,
              telefono: clerkUser.phoneNumbers?.[0]?.phoneNumber ?? '000-000-0000',
            },
          },
        },
        include: { asesor: true },
      }) as typeof user
    }

    // Si el User existe pero no tiene Asesor (usuarios creados antes de este fix)
    if (user && !user.asesor) {
      const asesor = await prisma.asesor.create({
        data: {
          userId:   user.id,
          nombre:   user.email.split('@')[0],
          email:    user.email,
          telefono: '000-000-0000',
        },
      })
      user = { ...user, asesor }
    }

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
