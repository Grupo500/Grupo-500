// Cliente de la API de Google Ads.
//
// Solo lectura: trae el gasto diario por campaña para alimentar el módulo de
// Finanzas. Se autentica con un refresh token permanente generado una sola vez
// por el dueño de la cuenta; no hay navegador ni redirección en tiempo de
// ejecución, es servidor contra servidor.

import { logger } from '../utils/logger'

const VERSION = 'v21'
const BASE = `https://googleads.googleapis.com/${VERSION}`

export interface FilaCampania {
  campaniaId: string
  campania: string
  estado: string
  fecha: string // YYYY-MM-DD
  gastoCOP: number
  impresiones: number
  clics: number
  conversiones: number
}

export function googleAdsConfigurado(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN &&
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    process.env.GOOGLE_ADS_CUSTOMER_ID
  )
}

// El access token dura una hora; se guarda en memoria para no pedir uno nuevo
// en cada consulta.
let cache: { token: string; expira: number } | null = null

async function accessToken(): Promise<string> {
  if (cache && Date.now() < cache.expira) return cache.token

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  })

  const datos = (await res.json()) as { access_token?: string; error_description?: string }
  if (!datos.access_token) {
    throw new Error(`Google Ads: no se pudo renovar el acceso — ${datos.error_description ?? 'sin detalle'}`)
  }

  // Se descuenta un minuto de margen para no usarlo justo al vencer.
  cache = { token: datos.access_token, expira: Date.now() + 59 * 60 * 1000 }
  return datos.access_token
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Gasto diario por campaña entre dos fechas (inclusive).
 *
 * Devuelve una fila por campaña y día. Se omiten las que no gastaron ni se
 * mostraron: la cuenta arrastra decenas de campañas pausadas que solo
 * ensuciarían la tabla.
 */
export async function gastoDiarioPorCampania(desde: Date, hasta: Date): Promise<FilaCampania[]> {
  const token = await accessToken()
  const cuenta = process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/\D/g, '')

  const query = `
    SELECT campaign.id, campaign.name, campaign.status, segments.date,
           metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${ymd(desde)}' AND '${ymd(hasta)}'`

  const filas: FilaCampania[] = []
  let pageToken: string | undefined
  let guarda = 0

  do {
    const res = await fetch(`${BASE}/customers/${cuenta}/googleAds:search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
        'Content-Type': 'application/json',
        // La cabecera de administradora solo va si la cuenta cuelga de una MCC.
        // Con cuentas independientes Google responde 403 si se manda.
        ...(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
          ? { 'login-customer-id': process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/\D/g, '') }
          : {}),
      },
      body: JSON.stringify({ query, ...(pageToken ? { pageToken } : {}) }),
    })

    if (!res.ok) {
      const detalle = await res.text()
      throw new Error(`Google Ads respondió ${res.status}: ${detalle.slice(0, 400)}`)
    }

    const datos = (await res.json()) as { results?: any[]; nextPageToken?: string }

    for (const r of datos.results ?? []) {
      const costo = Number(r.metrics?.costMicros ?? 0)
      const impresiones = Number(r.metrics?.impressions ?? 0)
      if (costo === 0 && impresiones === 0) continue

      filas.push({
        campaniaId: String(r.campaign.id),
        campania: r.campaign.name,
        estado: r.campaign.status,
        fecha: r.segments.date,
        // El costo llega en micros: millonésimas de la moneda de la cuenta,
        // que en esta es COP, así que no hay conversión de por medio.
        gastoCOP: costo / 1_000_000,
        impresiones,
        clics: Number(r.metrics?.clicks ?? 0),
        conversiones: Math.round(Number(r.metrics?.conversions ?? 0)),
      })
    }

    pageToken = datos.nextPageToken
    guarda++
  } while (pageToken && guarda < 50)

  logger.info(`[Google Ads] ${filas.length} filas de gasto entre ${ymd(desde)} y ${ymd(hasta)}`)
  return filas
}
