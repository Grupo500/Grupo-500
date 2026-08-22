import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../config/prisma'
import { UnauthorizedError, ForbiddenError } from '../utils/errors'
import { logSecurityEvent } from '../utils/logger'
import { redactarUrl } from '../utils/redactar'
import { Role, User, Asesor } from '@prisma/client'

type UserWithAsesor = User & { asesor: Asesor | null }

declare global {
  namespace Express {
    interface Request {
      userId?:   string
      userRole?: Role
      /** La sesión (SesionActiva.sid) del token, si lo trae. */
      sid?:      string
      asesorId?: string
      userName?: string
    }
  }
}

interface JwtPayload {
  sub: string   // userId de la DB
  email: string
  role: Role
  sid?: string  // sesión abierta; si está cerrada, el token no vale
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

    // Cuenta suspendida: el registro existe pero el acceso está cortado.
    // Se valida aquí —y no solo en el login— para que la suspensión aplique
    // de inmediato aunque la persona tenga una sesión abierta.
    if (user.suspendido) return next(new ForbiddenError('CUENTA_SUSPENDIDA'))

    // Sesión cerrada desde Ajustes ("cerrar las demás", o al cambiar la
    // contraseña): el token sigue firmado pero ya no vale.
    if (payload.sid) {
      const sesion = await prisma.sesionActiva.findUnique({ where: { sid: payload.sid }, select: { cerradaEn: true } })
      if (sesion?.cerradaEn) return next(new UnauthorizedError('SESION_CERRADA'))
    }

    req.sid      = payload.sid
    req.userId   = user.id
    req.userRole = user.role
    req.asesorId = user.asesor?.id
    req.userName = user.asesor?.nombre ?? user.nombre ?? user.email

    next()
  } catch (error) {
    // Decodificar sin verificar para extraer identidad del intento (auditoría)
    const token = req.headers.authorization?.replace('Bearer ', '')
    const rawPayload = token ? jwt.decode(token) as JwtPayload | null : null

    logSecurityEvent('AUTH_FAILURE', {
      email:     rawPayload?.email ?? 'desconocido',
      userId:    rawPayload?.sub   ?? 'desconocido',
      ip:        req.ip,
      userAgent: req.headers['user-agent'],
      // Redactada: si algún día un endpoint con credencial en el query usa este
      // middleware, un fallo de auth escribiría el secreto justo aquí.
      url:       redactarUrl(req.originalUrl),
      method:    req.method,
      reason:    error instanceof Error ? error.message : 'token_invalid',
    })
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      return next(error)
    }
    // Errores de JWT (token inválido/expirado) → 401. Cualquier OTRO error
    // (ej: fallo de BD) NO debe disfrazarse de 401: se propaga como 500 para
    // no enmascarar problemas reales como un "sin datos" engañoso.
    const jwtErrorNames = ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError']
    if (error instanceof Error && jwtErrorNames.includes(error.name)) {
      return next(new UnauthorizedError())
    }
    return next(error)
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
