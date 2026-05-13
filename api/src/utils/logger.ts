import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
})

export function logSecurityEvent(event: string, details: Record<string, unknown>) {
  logger.warn({ type: 'security', event, ...details, timestamp: new Date().toISOString() })
}
