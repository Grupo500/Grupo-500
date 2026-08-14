// Subida de archivos a Google Drive con la misma cuenta de servicio de Sheets.
//
// Reutiliza `GOOGLE_SHEETS_SA_EMAIL` / `GOOGLE_SHEETS_SA_PRIVATE_KEY` —es la
// misma cuenta, solo cambia el scope— y pide además:
//   DRIVE_CUENTAS_COBRO_FOLDER_ID  carpeta destino, compartida con esa cuenta
//
// Dos cosas tienen que estar hechas del lado de Google o esto responde 403:
//   1. La Drive API habilitada en el proyecto de la cuenta de servicio.
//   2. La carpeta compartida con el correo de la cuenta como Editor.
//
// Ojo con dónde vive la carpeta: una cuenta de servicio no tiene cuota propia
// en "Mi unidad", así que subir ahí falla con storageQuotaExceeded. En una
// unidad compartida el archivo pertenece a la unidad y sí funciona.

import jwt from 'jsonwebtoken'
import { logger } from '../utils/logger'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/drive'
const API = 'https://www.googleapis.com/drive/v3'
const SUBIDA = 'https://www.googleapis.com/upload/drive/v3/files'

export function driveConfigurado(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEETS_SA_EMAIL &&
    process.env.GOOGLE_SHEETS_SA_PRIVATE_KEY &&
    process.env.DRIVE_CUENTAS_COBRO_FOLDER_ID,
  )
}

function llavePrivada(): string {
  const raw = process.env.GOOGLE_SHEETS_SA_PRIVATE_KEY ?? ''
  // Railway y Vercel guardan la llave en una sola línea con \n escapados.
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw
}

let cacheToken: { token: string; expira: number } | null = null

async function accessToken(): Promise<string> {
  if (cacheToken && Date.now() < cacheToken.expira) return cacheToken.token

  const ahora = Math.floor(Date.now() / 1000)
  const assertion = jwt.sign(
    { iss: process.env.GOOGLE_SHEETS_SA_EMAIL, scope: SCOPE, aud: TOKEN_URL, iat: ahora, exp: ahora + 3600 },
    llavePrivada(),
    { algorithm: 'RS256' },
  )

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  const cuerpo = await res.json() as any
  if (!res.ok || !cuerpo.access_token) {
    throw new Error(`No pude autenticarme con Google Drive: ${cuerpo.error_description ?? cuerpo.error ?? res.status}`)
  }
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
