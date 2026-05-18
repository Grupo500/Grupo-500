import { Request } from 'express'
import { logger } from './logger'

type AuditAction =
  | 'CREATE' | 'UPDATE' | 'DELETE'
  | 'LOGIN'  | 'ACCESS_DENIED' | 'RATE_LIMITED'

export function auditLog(
  req: Request,
  action: AuditAction,
  resource: string,
  resourceId?: string,
  extra?: Record<string, unknown>,
) {
  logger.info({
    type:       'audit',
    action,
    resource,
    resourceId,
    userId:     req.userId,
    userRole:   req.userRole,
    asesorId:   req.asesorId,
    ip:         req.ip,
    userAgent:  req.headers['user-agent'],
    timestamp:  new Date().toISOString(),
    ...extra,
  })
}
