const REQUIRED_VARS = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'ALLOWED_ORIGINS',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
]

export function validateEnv() {
  const missing = REQUIRED_VARS.filter(v => !process.env[v])
  if (missing.length > 0) {
    console.error(`[FATAL] Variables de entorno faltantes: ${missing.join(', ')}`)
    process.exit(1)
  }

  // Validar fortaleza mínima del secret
  const secret = process.env.NEXTAUTH_SECRET!
  if (secret.length < 32) {
    console.error('[FATAL] NEXTAUTH_SECRET debe tener al menos 32 caracteres. Genera uno con: openssl rand -base64 32')
    process.exit(1)
  }
}
