import crypto from 'crypto'

const PREFIJO = 'g500_live_'

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

/** Genera una API key nueva. El secreto en texto plano solo se devuelve aquí — nunca se persiste. */
export function generarApiKey(): { key: string; hash: string; prefijo: string } {
  const secreto = crypto.randomBytes(32).toString('base64url')
  const key = `${PREFIJO}${secreto}`
  return {
    key,
    hash: hashApiKey(key),
    prefijo: key.slice(0, 14), // "g500_live_" + 4 caracteres, suficiente para reconocerla en un listado
  }
}
