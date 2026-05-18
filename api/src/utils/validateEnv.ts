const REQUIRED_VARS = [
  'DATABASE_URL',
  'DIRECT_URL',
  'CLERK_SECRET_KEY',
  'ALLOWED_ORIGINS',
]

export function validateEnv() {
  const missing = REQUIRED_VARS.filter(v => !process.env[v])
  if (missing.length > 0) {
    console.error(`[FATAL] Variables de entorno faltantes: ${missing.join(', ')}`)
    process.exit(1)
  }
}
