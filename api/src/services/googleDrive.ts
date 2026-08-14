// Subida de archivos a Google Drive.
//
// Se entra como el DUEÑO de la carpeta, no como cuenta de servicio. Se intentó
// primero con la cuenta de servicio de Sheets —era la opción sin fricción, ya
// existía y la carpeta se le puede compartir— y Google la rechaza:
//
//   403 · Service Accounts do not have storage quota
//
// Una cuenta de servicio no tiene almacenamiento propio, así que el archivo que
// crea en "Mi unidad" de alguien no tiene a quién cobrarle el espacio. Las dos
// salidas que da Google son unidades compartidas (no existen en una cuenta
// personal) o entrar en nombre del usuario. Esta es la segunda: un refresh
// token de la cuenta dueña, igual que ya se hace con Google Ads. Los archivos
// quedan a nombre de David, que es como si los hubiera subido a mano.
//
// Requiere en el entorno:
//   DRIVE_OAUTH_CLIENT_ID / DRIVE_OAUTH_CLIENT_SECRET / DRIVE_OAUTH_REFRESH_TOKEN
//   DRIVE_CUENTAS_COBRO_FOLDER_ID   carpeta destino
// El refresh token se saca una sola vez con `scripts/autorizar-drive.ts`.

import { logger } from '../utils/logger'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://www.googleapis.com/drive/v3'
const SUBIDA = 'https://www.googleapis.com/upload/drive/v3/files'

export function driveConfigurado(): boolean {
  return Boolean(
    process.env.DRIVE_OAUTH_CLIENT_ID &&
    process.env.DRIVE_OAUTH_CLIENT_SECRET &&
    process.env.DRIVE_OAUTH_REFRESH_TOKEN &&
    process.env.DRIVE_CUENTAS_COBRO_FOLDER_ID,
  )
}

let cacheToken: { token: string; expira: number } | null = null

async function accessToken(): Promise<string> {
  if (cacheToken && Date.now() < cacheToken.expira) return cacheToken.token
  if (!driveConfigurado()) throw new Error('Google Drive no está configurado')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.DRIVE_OAUTH_CLIENT_ID!,
      client_secret: process.env.DRIVE_OAUTH_CLIENT_SECRET!,
      refresh_token: process.env.DRIVE_OAUTH_REFRESH_TOKEN!,
      grant_type:    'refresh_token',
    }),
  })
  const cuerpo = await res.json() as any
  if (!res.ok || !cuerpo.access_token) {
    throw new Error(`No pude autenticarme con Google Drive: ${cuerpo.error_description ?? cuerpo.error ?? res.status}`)
  }
  // Se renueva un minuto antes de vencer para no cortar una subida a medias.
  cacheToken = { token: cuerpo.access_token, expira: Date.now() + ((cuerpo.expires_in ?? 3600) - 60) * 1000 }
  return cacheToken.token
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/** "2026-08 Agosto", igual a como ya están nombradas las carpetas a mano. */
export function nombreCarpetaMes(fecha: Date): string {
  const m = fecha.getMonth()
  return `${fecha.getFullYear()}-${String(m + 1).padStart(2, '0')} ${MESES[m]}`
}

/**
 * La subcarpeta del mes dentro de la carpeta madre; la crea si no existe.
 * Se busca por nombre y no se guarda el id: así sigue funcionando si alguien
 * arma la carpeta a mano en Drive, que es como vienen las de julio y agosto.
 */
async function carpetaDelMes(token: string, padre: string, fecha: Date): Promise<string> {
  const nombre = nombreCarpetaMes(fecha)
  const q = [
    `'${padre}' in parents`,
    `name = '${nombre.replace(/'/g, "\\'")}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    'trashed = false',
  ].join(' and ')

  const busca = await fetch(
    `${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } })
  const encontrado = await busca.json() as any
  if (busca.ok && encontrado.files?.[0]?.id) return encontrado.files[0].id

  const crea = await fetch(`${API}/files?supportsAllDrives=true&fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name: nombre, mimeType: 'application/vnd.google-apps.folder', parents: [padre] }),
  })
  const creada = await crea.json() as any
  if (!crea.ok) throw new Error(`No pude crear la carpeta ${nombre}: ${creada.error?.message ?? crea.status}`)
  return creada.id
}

export interface ArchivoEnDrive { id: string; url: string; carpeta: string }

/** Sube un PDF a la subcarpeta del mes y devuelve su enlace para ver. */
export async function subirCuentaDeCobro(
  nombreArchivo: string,
  pdf: Buffer,
  fecha: Date,
): Promise<ArchivoEnDrive> {
  if (!driveConfigurado()) throw new Error('Google Drive no está configurado')
  const token = await accessToken()
  const padre = process.env.DRIVE_CUENTAS_COBRO_FOLDER_ID!
  const carpeta = await carpetaDelMes(token, padre, fecha)

  // Subida multipart: los metadatos y el archivo en una sola petición.
  const limite = '-------grupo500' + Math.random().toString(36).slice(2)
  const meta = JSON.stringify({ name: nombreArchivo, parents: [carpeta] })
  const cuerpo = Buffer.concat([
    Buffer.from(`--${limite}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
    Buffer.from(`--${limite}\r\ncontent-type: application/pdf\r\n\r\n`),
    pdf,
    Buffer.from(`\r\n--${limite}--\r\n`),
  ])

  const res = await fetch(`${SUBIDA}?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': `multipart/related; boundary=${limite}` },
    body: cuerpo,
  })
  const json = await res.json() as any
  if (!res.ok) {
    logger.error({ status: res.status, error: json.error }, 'Drive rechazó la cuenta de cobro')
    throw new Error(json.error?.message ?? `Drive respondió ${res.status}`)
  }
  return { id: json.id, url: json.webViewLink, carpeta: nombreCarpetaMes(fecha) }
}
