import { prisma } from '../config/prisma'
import type { PublicacionRed, RedSocialCuenta } from '@prisma/client'

// ── Meta Graph API: OAuth de cuentas y publicación de posts/historias/reels ──
// La App de Meta (developers.facebook.com) se configura desde Marketing > Redes;
// el App ID y el App Secret viven en ConfigApp (claves META_APP_ID / META_APP_SECRET).

const GRAPH = 'https://graph.facebook.com/v21.0'

export const META_SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_content_publish',
  'business_management',
].join(',')

export async function getMetaConfig() {
  const filas = await prisma.configApp.findMany({
    where: { clave: { in: ['META_APP_ID', 'META_APP_SECRET', 'META_CONFIG_ID'] } },
  })
  const valor = (clave: string) => filas.find(f => f.clave === clave)?.valor ?? null
  const appId = valor('META_APP_ID')
  const appSecret = valor('META_APP_SECRET')
  // Config ID de "Facebook Login for Business": las apps tipo Negocios no aceptan
  // scopes sueltos en el diálogo OAuth (da "Invalid Scopes") — exigen una
  // Configuración creada en el producto, que agrupa los permisos.
  const configId = valor('META_CONFIG_ID')
  return { appId, appSecret, configId, configurada: Boolean(appId && appSecret) }
}

interface GraphError { error?: { message?: string; error_user_msg?: string } }

async function graph<T>(path: string, params: Record<string, string>, init?: RequestInit): Promise<T> {
  const qs = new URLSearchParams(params)
  const res = await fetch(`${GRAPH}${path}?${qs}`, init)
  const json = (await res.json()) as T & GraphError
  if (!res.ok || json.error) {
    const msg = json.error?.error_user_msg || json.error?.message || `Meta respondió ${res.status}`
    throw new Error(msg)
  }
  return json
}

const graphPost = <T>(path: string, params: Record<string, string>) =>
  graph<T>(path, params, { method: 'POST' })

// ── OAuth: código → token de usuario larga duración → páginas + cuentas IG ───

export async function intercambiarCodigo(code: string, redirectUri: string) {
  const { appId, appSecret, configurada } = await getMetaConfig()
  if (!configurada) throw new Error('La App de Meta no está configurada (App ID / Secret)')

  const corto = await graph<{ access_token: string }>('/oauth/access_token', {
    client_id: appId!, client_secret: appSecret!, redirect_uri: redirectUri, code,
  })
  const largo = await graph<{ access_token: string }>('/oauth/access_token', {
    grant_type: 'fb_exchange_token', client_id: appId!, client_secret: appSecret!,
    fb_exchange_token: corto.access_token,
  })
  return largo.access_token
}

interface PaginaMeta {
  id: string
  name: string
  access_token: string
  picture?: { data?: { url?: string } }
  instagram_business_account?: { id: string; username?: string; profile_picture_url?: string }
}

/** Vincula (upsert) todas las páginas FB del usuario y sus cuentas IG profesionales. */
export async function vincularCuentas(userToken: string) {
  const { data } = await graph<{ data: PaginaMeta[] }>('/me/accounts', {
    access_token: userToken,
    fields: 'id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}',
    limit: '100',
  })
  if (!data.length) {
    // diagnóstico: saber quién autorizó y qué permisos concedió realmente Meta
    let detalle = ''
    try {
      const me = await graph<{ name?: string; id?: string }>('/me', { access_token: userToken, fields: 'name' })
      const perms = await graph<{ data: { permission: string; status: string }[] }>('/me/permissions', { access_token: userToken })
      const lista = perms.data.map(p => `${p.permission}=${p.status}`).join(', ') || 'NINGUNO'
      detalle = ` Autorizó: ${me.name ?? me.id ?? '?'}. Permisos concedidos: ${lista}.`
    } catch { /* el diagnóstico es opcional */ }
    throw new Error(`Meta no devolvió páginas.${detalle} Si faltan permisos pages_*/instagram_*, la Configuración del Login for Business no los incluye o no se seleccionaron páginas al autorizar.`)
  }

  const cuentas = []
  for (const pagina of data) {
    cuentas.push(await prisma.redSocialCuenta.upsert({
      where: { plataforma_externalId: { plataforma: 'FACEBOOK', externalId: pagina.id } },
      create: {
        plataforma: 'FACEBOOK', externalId: pagina.id, nombre: pagina.name,
        accessToken: pagina.access_token, fotoUrl: pagina.picture?.data?.url ?? null,
      },
      update: { nombre: pagina.name, accessToken: pagina.access_token, fotoUrl: pagina.picture?.data?.url ?? null, activa: true },
    }))
    const ig = pagina.instagram_business_account
    if (ig) {
      cuentas.push(await prisma.redSocialCuenta.upsert({
        where: { plataforma_externalId: { plataforma: 'INSTAGRAM', externalId: ig.id } },
        create: {
          plataforma: 'INSTAGRAM', externalId: ig.id, nombre: ig.username ? `@${ig.username}` : pagina.name,
          accessToken: pagina.access_token, fotoUrl: ig.profile_picture_url ?? null,
        },
        update: {
          nombre: ig.username ? `@${ig.username}` : pagina.name,
          accessToken: pagina.access_token, fotoUrl: ig.profile_picture_url ?? null, activa: true,
        },
      }))
    }
  }
  return cuentas
}

// ── Publicación ──────────────────────────────────────────────────────────────

const ESPERA_VIDEO_MS = 15_000
const MAX_INTENTOS_VIDEO = 20 // ~5 min: los videos de IG se procesan antes de poder publicarse

async function esperarMediaLista(creationId: string, token: string) {
  for (let i = 0; i < MAX_INTENTOS_VIDEO; i++) {
    const { status_code } = await graph<{ status_code: string }>(`/${creationId}`, {
      access_token: token, fields: 'status_code',
    })
    if (status_code === 'FINISHED') return
    if (status_code === 'ERROR') throw new Error('Meta no pudo procesar el video (formato/duración)')
    await new Promise(r => setTimeout(r, ESPERA_VIDEO_MS))
  }
  throw new Error('El video sigue procesándose en Meta; reintenta en unos minutos')
}

// Instagram es estricto: imágenes solo JPEG y video MP4/H.264+AAC. Como el media
// vive en Cloudinary, se fuerza la transformación en la URL y el archivo original
// puede ser PNG/WebP/MOV sin que la publicación falle.
function mediaUrlParaIG(url: string, esVideo: boolean) {
  if (!url.includes('res.cloudinary.com')) return url
  if (esVideo) return url.replace('/video/upload/', '/video/upload/vc_h264,ac_aac,f_mp4/')
  return url.replace('/image/upload/', '/image/upload/f_jpg,q_auto:good/')
}

async function publicarInstagram(pub: PublicacionRed, cuenta: RedSocialCuenta): Promise<string> {
  const token = cuenta.accessToken
  const igId = cuenta.externalId
  const params: Record<string, string> = { access_token: token }
  const mediaUrl = pub.mediaUrl ? mediaUrlParaIG(pub.mediaUrl, pub.mediaEsVideo) : undefined

  if (pub.tipo === 'HISTORIA') {
    params.media_type = 'STORIES'
    if (pub.mediaEsVideo) params.video_url = mediaUrl!
    else params.image_url = mediaUrl!
  } else if (pub.tipo === 'REEL' || (pub.tipo === 'POST' && pub.mediaEsVideo)) {
    // los videos de feed en IG se publican como REELS (así lo exige la API actual)
    params.media_type = 'REELS'
    params.video_url = mediaUrl!
    if (pub.caption) params.caption = pub.caption
  } else {
    params.image_url = mediaUrl!
    if (pub.caption) params.caption = pub.caption
  }

  const { id: creationId } = await graphPost<{ id: string }>(`/${igId}/media`, params)
  if (pub.mediaEsVideo) await esperarMediaLista(creationId, token)
  const { id } = await graphPost<{ id: string }>(`/${igId}/media_publish`, {
    access_token: token, creation_id: creationId,
  })
  return id
}

async function publicarHistoriaVideoFB(pub: PublicacionRed, cuenta: RedSocialCuenta): Promise<string> {
  const token = cuenta.accessToken
  const inicio = await graphPost<{ video_id: string; upload_url: string }>(
    `/${cuenta.externalId}/video_stories`, { access_token: token, upload_phase: 'start' },
  )
  // fase de subida "hosted file": Meta descarga el video desde la URL de Cloudinary
  const up = await fetch(inicio.upload_url, {
    method: 'POST',
    headers: { Authorization: `OAuth ${token}`, file_url: pub.mediaUrl! },
  })
  const upJson = (await up.json()) as { success?: boolean } & GraphError
  if (!up.ok || upJson.error) throw new Error(upJson.error?.message ?? 'Meta no pudo descargar el video de la historia')
  const fin = await graphPost<{ post_id?: string }>(`/${cuenta.externalId}/video_stories`, {
    access_token: token, upload_phase: 'finish', video_id: inicio.video_id,
  })
  return fin.post_id ?? inicio.video_id
}

async function publicarFacebook(pub: PublicacionRed, cuenta: RedSocialCuenta): Promise<string> {
  const token = cuenta.accessToken
  const pageId = cuenta.externalId

  if (pub.tipo === 'HISTORIA') {
    if (pub.mediaEsVideo) return publicarHistoriaVideoFB(pub, cuenta)
    const foto = await graphPost<{ id: string }>(`/${pageId}/photos`, {
      access_token: token, url: pub.mediaUrl!, published: 'false',
    })
    const { post_id } = await graphPost<{ post_id: string }>(`/${pageId}/photo_stories`, {
      access_token: token, photo_id: foto.id,
    })
    return post_id
  }

  if (pub.mediaUrl && pub.mediaEsVideo) {
    const { id } = await graphPost<{ id: string }>(`/${pageId}/videos`, {
      access_token: token, file_url: pub.mediaUrl, description: pub.caption ?? '',
    })
    return id
  }
  if (pub.mediaUrl) {
    const { post_id, id } = await graphPost<{ post_id?: string; id: string }>(`/${pageId}/photos`, {
      access_token: token, url: pub.mediaUrl, caption: pub.caption ?? '',
    })
    return post_id ?? id
  }
  const { id } = await graphPost<{ id: string }>(`/${pageId}/feed`, {
    access_token: token, message: pub.caption ?? '',
  })
  return id
}

/** Publica en la red que corresponda y devuelve el id externo del post. */
export async function publicarEnRed(pub: PublicacionRed & { cuenta: RedSocialCuenta }): Promise<string> {
  if (pub.cuenta.plataforma === 'INSTAGRAM') return publicarInstagram(pub, pub.cuenta)
  return publicarFacebook(pub, pub.cuenta)
}
