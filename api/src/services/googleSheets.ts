// Cliente de Google Sheets con cuenta de servicio.
//
// Lectura y ESCRITURA. Se autentica firmando un JWT con la llave privada de una
// cuenta de servicio y canjeándolo por un access token; es servidor contra
// servidor, sin navegador ni redirecciones (mismo enfoque que googleAds.ts).
//
// Requiere en el entorno:
//   GOOGLE_SHEETS_SA_EMAIL        correo de la cuenta de servicio
//   GOOGLE_SHEETS_SA_PRIVATE_KEY  llave privada PEM (los \n pueden ir escapados)
// y que el sheet esté compartido con ese correo como EDITOR.

import jwt from 'jsonwebtoken'
import { logger } from '../utils/logger'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

export function sheetsEscrituraConfigurada(): boolean {
  return Boolean(process.env.GOOGLE_SHEETS_SA_EMAIL && process.env.GOOGLE_SHEETS_SA_PRIVATE_KEY)
}

function llavePrivada(): string {
  const raw = process.env.GOOGLE_SHEETS_SA_PRIVATE_KEY ?? ''
  // Railway y Vercel guardan la llave en una sola línea con \n escapados.
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw
}

let cacheToken: { token: string; expira: number } | null = null

async function accessToken(): Promise<string> {
  if (cacheToken && Date.now() < cacheToken.expira) return cacheToken.token
  if (!sheetsEscrituraConfigurada()) {
    throw new Error('Falta la cuenta de servicio de Google Sheets (GOOGLE_SHEETS_SA_EMAIL / GOOGLE_SHEETS_SA_PRIVATE_KEY)')
  }

  const ahora = Math.floor(Date.now() / 1000)
  const assertion = jwt.sign(
    {
      iss: process.env.GOOGLE_SHEETS_SA_EMAIL,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: ahora,
      exp: ahora + 3600,
    },
    llavePrivada(),
    { algorithm: 'RS256' },
  )

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  const cuerpo = await res.json() as { access_token?: string; expires_in?: number; error_description?: string; error?: string }
  if (!res.ok || !cuerpo.access_token) {
    throw new Error(`No pude autenticarme con Google Sheets: ${cuerpo.error_description ?? cuerpo.error ?? res.status}`)
  }

  // Se renueva un minuto antes de vencer para no cortar una escritura a medias.
  cacheToken = {
    token: cuerpo.access_token,
    expira: Date.now() + ((cuerpo.expires_in ?? 3600) - 60) * 1000,
  }
  return cacheToken.token
}

async function llamar<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken()
  const res = await fetch(`${BASE}${ruta}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
  })
  const texto = await res.text()
  let cuerpo: unknown = null
  try { cuerpo = texto ? JSON.parse(texto) : null } catch { /* respuesta no JSON */ }

  if (!res.ok) {
    const detalle = (cuerpo as { error?: { message?: string } })?.error?.message ?? texto.slice(0, 200)
    if (res.status === 403) {
      throw new Error(`Google rechazó la operación (403). ¿El sheet está compartido como editor con ${process.env.GOOGLE_SHEETS_SA_EMAIL}? · ${detalle}`)
    }
    throw new Error(`Google Sheets respondió ${res.status}: ${detalle}`)
  }
  return cuerpo as T
}

// ── metadatos: gid → título de la pestaña ───────────────────────────────

interface Pestania { sheetId: number; title: string; filas: number; columnas: number }

const cachePestanias = new Map<string, { datos: Pestania[]; expira: number }>()

export async function pestanias(sheetId: string): Promise<Pestania[]> {
  const hit = cachePestanias.get(sheetId)
  if (hit && Date.now() < hit.expira) return hit.datos

  const r = await llamar<{ sheets: { properties: { sheetId: number; title: string; gridProperties?: { rowCount?: number; columnCount?: number } } }[] }>(
    `/${sheetId}?fields=sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))`,
  )
  const datos = (r.sheets ?? []).map(s => ({
    sheetId: s.properties.sheetId,
    title: s.properties.title,
    filas: s.properties.gridProperties?.rowCount ?? 1000,
    columnas: s.properties.gridProperties?.columnCount ?? 26,
  }))
  cachePestanias.set(sheetId, { datos, expira: Date.now() + 30 * 60 * 1000 })
  return datos
}

/** El API usa el título de la pestaña en los rangos A1, no el gid. */
export async function tituloDeGid(sheetId: string, gid: string): Promise<string> {
  const lista = await pestanias(sheetId)
  const p = lista.find(x => String(x.sheetId) === String(gid))
  if (!p) throw new Error(`El sheet no tiene una pestaña con gid=${gid}`)
  return p.title
}

// ── lectura ─────────────────────────────────────────────────────────────

/** Convierte un índice de columna en letras: 0 → A, 26 → AA. */
export function colALetra(indice: number): string {
  let n = indice + 1
  let s = ''
  while (n > 0) {
    const resto = (n - 1) % 26
    s = String.fromCharCode(65 + resto) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** Cita el título en un rango A1; los títulos con espacios lo necesitan. */
const citar = (titulo: string) => `'${titulo.replace(/'/g, "''")}'`

/**
 * Lee una pestaña completa como grilla de strings.
 *
 * Usa FORMATTED_VALUE a propósito, para que lo que llega sea idéntico a lo que
 * daba el CSV público y el parser existente siga sirviendo sin cambios.
 */
export async function leerPestania(sheetId: string, gid: string): Promise<string[][]> {
  const titulo = await tituloDeGid(sheetId, gid)
  const r = await llamar<{ values?: string[][] }>(
    `/${sheetId}/values/${encodeURIComponent(citar(titulo))}`
    + `?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`,
  )
  return r.values ?? []
}

/** Lee una sola celda por coordenadas base cero. */
export async function leerCelda(sheetId: string, gid: string, fila: number, columna: number): Promise<string> {
  const titulo = await tituloDeGid(sheetId, gid)
  const a1 = `${colALetra(columna)}${fila + 1}`
  const r = await llamar<{ values?: string[][] }>(
    `/${sheetId}/values/${encodeURIComponent(`${citar(titulo)}!${a1}`)}?valueRenderOption=FORMATTED_VALUE`,
  )
  return r.values?.[0]?.[0] ?? ''
}

// ── escritura ───────────────────────────────────────────────────────────

export interface Escritura {
  gid: string
  fila: number      // base cero
  columna: number   // base cero
  valor: string | number | null
}

/**
 * Escribe celdas sueltas.
 *
 * `RAW` en vez de `USER_ENTERED`: los montos se guardan como números limpios y
 * el formato de moneda que ya tiene la celda se encarga de mostrarlos. Con
 * USER_ENTERED un texto que empiece por "=" se interpretaría como fórmula.
 */
export async function escribirCeldas(sheetId: string, celdas: Escritura[]): Promise<number> {
  if (!celdas.length) return 0

  const data = await Promise.all(celdas.map(async c => {
    const titulo = await tituloDeGid(sheetId, c.gid)
    return {
      range: `${citar(titulo)}!${colALetra(c.columna)}${c.fila + 1}`,
      values: [[c.valor ?? '']],
    }
  }))

  const r = await llamar<{ totalUpdatedCells?: number }>(
    `/${sheetId}/values:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'RAW', data }),
    },
  )
  const n = r.totalUpdatedCells ?? 0
  logger.info({ type: 'sheets_write', sheetId, celdas: celdas.length, actualizadas: n }, 'escritura en Google Sheets')
  return n
}

/** Inserta una fila al final de un rango y devuelve el número de fila usado. */
export async function agregarFila(
  sheetId: string, gid: string, valores: (string | number | null)[], columnaInicial = 0,
): Promise<number> {
  const titulo = await tituloDeGid(sheetId, gid)
  const rango = `${citar(titulo)}!${colALetra(columnaInicial)}1`

  const r = await llamar<{ updates?: { updatedRange?: string } }>(
    `/${sheetId}/values/${encodeURIComponent(rango)}:append`
    + '?valueInputOption=RAW&insertDataOption=INSERT_ROWS',
    {
      method: 'POST',
      body: JSON.stringify({ values: [valores.map(v => v ?? '')] }),
    },
  )

  // updatedRange llega como "'Agencia 500'!A81:F81"
  const m = (r.updates?.updatedRange ?? '').match(/![A-Z]+(\d+)/)
  const fila = m ? Number(m[1]) - 1 : -1
  logger.info({ type: 'sheets_append', sheetId, gid, fila }, 'fila agregada en Google Sheets')
  return fila
}
