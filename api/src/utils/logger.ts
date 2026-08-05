import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // Segunda red, por si alguien vuelve a loguear un objeto con credenciales
  // dentro. La primera es redactarUrl() en los puntos que registran la URL.
  redact: {
    paths: [
      'token', '*.token', 'accessToken', '*.accessToken',
      'secreto', '*.secreto', 'secret', '*.secret',
      'password', '*.password', 'clave', '*.clave',
      'authorization', '*.authorization', 'headers.authorization',
      'privateKey', '*.privateKey', 'GOOGLE_SHEETS_SA_PRIVATE_KEY',
    ],
    censor: '***',
  },
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
})

export function logSecurityEvent(event: string, details: Record<string, unknown>) {
  logger.warn({ type: 'security', event, ...details, timestamp: new Date().toISOString() })
}
