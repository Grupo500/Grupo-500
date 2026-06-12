import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { logger } from '../utils/logger'
import { auditLog } from '../utils/auditLogger'

// ---------------------------------------------------------------------------
// Tipos del payload de Hotmart
// ---------------------------------------------------------------------------
interface HotmartBuyer {
  name: string
  email: string
  phone?: string
  document?: string
}

interface HotmartPurchase {
  transaction: string
  status: string
  price: { value: number; currencyValue: string }
  payment?: { type?: string }
  approved_date?: number
}

interface HotmartProduct {
  id: number | string
  name: string
}

interface HotmartAffiliate {
  affiliate_name: string
  affiliate_email?: string
  affiliate_code?: string
}

interface HotmartPayload {
  event: string
  hottok?: string
  data: {
    buyer: HotmartBuyer
    purchase: HotmartPurchase
    product: HotmartProduct
    affiliates?: HotmartAffiliate[]
  }
}

// ---------------------------------------------------------------------------
// Webhook — recibe eventos de compra desde Hotmart
// ---------------------------------------------------------------------------
export async function webhook(req: Request, res: Response) {
  let body: HotmartPayload

  try {
    body = typeof req.body === 'string' || Buffer.isBuffer(req.body)
      ? JSON.parse(req.body.toString())
      : req.body
  } catch {
    return res.status(400).json({ success: false, error: 'Payload inválido' })
  }

  // Verificar hottok
  const expectedToken = process.env.HOTMART_HOTTOK
  if (expectedToken) {
    const receivedToken = body.hottok ?? req.headers['x-hotmart-hottok']
    if (receivedToken !== expectedToken) {
      logger.warn('[Hotmart] Webhook rechazado: hottok inválido')
      return res.status(401).json({ success: false, error: 'No autorizado' })
    }
  }

  const { event, data } = body

  // Solo procesar compras completadas
  if (event !== 'PURCHASE_COMPLETE' && event !== 'PURCHASE_APPROVED') {
    logger.info(`[Hotmart] Evento ignorado: ${event}`)
    return res.status(200).json({ success: true, message: 'Evento ignorado' })
  }

  const { buyer, purchase, product, affiliates } = data
  const transaccion = purchase.transaction

  logger.info(`[Hotmart] Procesando compra ${transaccion} de ${buyer.email}`)

  // Idempotencia: si ya existe el pago con esta referencia, ignorar
  const pagoExistente = await prisma.pago.findFirst({
    where: { referenciaPago: transaccion },
  })
  if (pagoExistente) {
    logger.info(`[Hotmart] Pago ${transaccion} ya procesado — ignorando`)
    return res.status(200).json({ success: true, message: 'Ya procesado' })
  }

  // Buscar el curso por hotmartProductId
  const curso = await prisma.curso.findFirst({
    where: { hotmartProductId: String(product.id) },
  })
  if (!curso) {
    logger.warn(`[Hotmart] Producto ${product.id} (${product.name}) no tiene curso vinculado`)
  }

  // Buscar o crear estudiante
  let estudiante = await prisma.estudiante.findFirst({
    where: { email: { equals: buyer.email, mode: 'insensitive' } },
  })

  if (!estudiante) {
    estudiante = await prisma.estudiante.create({
      data: {
        nombre: buyer.name,
        email: buyer.email.toLowerCase(),
        telefono: buyer.phone ?? '',
        documento: buyer.document ?? '',
        fechaNacimiento: new Date('2000-01-01'), // se actualiza al verificar
        verificado: false,
        fuenteContacto: { create: { fuente: 'HOTMART' } },
      },
    })
    logger.info(`[Hotmart] Estudiante creado: ${estudiante.id} (${buyer.email})`)
  }

  // Identificar asesor por el afiliado de Hotmart
  let asesorId: string | undefined
  const affiliateEmail = affiliates?.[0]?.affiliate_email
  if (affiliateEmail) {
    const asesor = await prisma.asesor.findFirst({
      where: { email: { equals: affiliateEmail, mode: 'insensitive' } },
    })
    if (asesor) {
      asesorId = asesor.id
      logger.info(`[Hotmart] Asesor identificado: ${asesor.nombre} (${affiliateEmail})`)
      // Asignar al estudiante si aún no tiene asesor
      if (!estudiante.asesorId) {
        await prisma.estudiante.update({
          where: { id: estudiante.id },
          data: { asesorId },
        })
      }
    } else {
      logger.warn(`[Hotmart] Afiliado ${affiliateEmail} no encontrado como asesor en la app`)
    }
  }

  // Matricular al curso si no está ya matriculado
  if (curso) {
    await prisma.cursoEstudiante.upsert({
      where: { estudianteId_cursoId: { estudianteId: estudiante.id, cursoId: curso.id } },
      create: { estudianteId: estudiante.id, cursoId: curso.id },
      update: {},
    })
  }

  // Registrar el pago
  const monto = purchase.price.value
  const fechaPago = purchase.approved_date ? new Date(purchase.approved_date) : new Date()
  const metodo = purchase.payment?.type ?? 'HOTMART'

  const pago = await prisma.pago.create({
    data: {
      estudianteId: estudiante.id,
      monto,
      estado: 'PAGADO',
      metodo,
      referenciaPago: transaccion,
      fechaVencimiento: fechaPago,
      fechaPago,
      notas: `Compra Hotmart — Producto: ${product.name} (ID: ${product.id})`,
      ...(asesorId && { asesorId }),
    },
  })

  logger.info(`[Hotmart] Pago registrado: ${pago.id} — $${monto} ${purchase.price.currencyValue}`)
  auditLog(
    req as any,
    'CREATE',
    'pago',
    pago.id,
    { source: 'hotmart', transaccion, estudianteId: estudiante.id, cursoId: curso?.id }
  )

  return res.status(200).json({ success: true, pagoId: pago.id, estudianteId: estudiante.id })
}

// ---------------------------------------------------------------------------
// Token OAuth con caché en memoria
// ---------------------------------------------------------------------------
let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.token
  }

  const clientId     = process.env.HOTMART_CLIENT_ID!
  const clientSecret = process.env.HOTMART_CLIENT_SECRET!
  const basic        = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch('https://api-sec-vlc.hotmart.com/security/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: 'grant_type=client_credentials',
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`[Hotmart] Error al obtener token: ${res.status} — ${text}`)
  }
  if (!text) {
    throw new Error(`[Hotmart] Respuesta vacía al obtener token (status ${res.status})`)
  }

  let json: { access_token: string; expires_in: number }
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`[Hotmart] Respuesta no-JSON al obtener token: ${text.slice(0, 200)}`)
  }

  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  }
  return cachedToken.token
}

// ---------------------------------------------------------------------------
// Sincronizar productos de Hotmart → cursos en BD (solo ADMIN)
// ---------------------------------------------------------------------------
export async function sincronizarProductos(_req: Request, res: Response) {
  const clientId     = process.env.HOTMART_CLIENT_ID
  const clientSecret = process.env.HOTMART_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    logger.error('[Hotmart] Variables HOTMART_CLIENT_ID o HOTMART_CLIENT_SECRET no configuradas')
    return res.status(503).json({ success: false, error: 'Hotmart API no configurada' })
  }

  logger.info('[Hotmart] Iniciando sincronización de productos...')
  let token: string
  try {
    token = await getAccessToken()
    logger.info('[Hotmart] Token OAuth obtenido correctamente')
  } catch (e: any) {
    logger.error(`[Hotmart] Error al obtener token OAuth: ${e?.message}`)
    return res.status(500).json({ success: false, error: `Error de autenticación Hotmart: ${e?.message}` })
  }

  // Paginación: Hotmart devuelve max 50 por página
  let allItems: any[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({ max_results: '50' })
    if (pageToken) params.set('page_token', pageToken)

    const apiRes = await fetch(
      `https://developers.hotmart.com/products/api/v1/product?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!apiRes.ok) {
      const text = await apiRes.text()
      logger.error(`[Hotmart] Error al obtener productos: ${apiRes.status} ${text}`)
      return res.status(apiRes.status).json({ success: false, error: 'Error al obtener productos de Hotmart' })
    }

    const json = await apiRes.json() as { items?: any[]; page_info?: { next_page_token?: string } }
    allItems = allItems.concat(json.items ?? [])
    pageToken = json.page_info?.next_page_token
  } while (pageToken)

  let creados   = 0
  let actualizados = 0

  for (const item of allItems) {
    const productId   = String(item.product?.id ?? item.id)
    const nombre      = item.product?.name ?? item.name ?? 'Sin nombre'
    const descripcion = item.product?.description ?? item.description ?? null
    const precio      = item.price?.value ?? 0
    const isActive    = (item.product?.status ?? item.status) === 'ACTIVE'

    // Determinar tipoCurso: si el nombre incluye "combo" lo clasificamos automáticamente
    const tipoCurso = /combo/i.test(nombre) ? 'COMBO' : 'INDIVIDUAL'

    const existente = await prisma.curso.findUnique({ where: { hotmartProductId: productId } })

    if (existente) {
      await prisma.curso.update({
        where: { hotmartProductId: productId },
        data: { nombre, descripcion, precio, tipoCurso },
      })
      actualizados++
    } else {
      await prisma.curso.create({
        data: {
          nombre,
          descripcion,
          precio,
          tipoCurso,
          activo: isActive,
          duracionHoras: 0,
          hotmartProductId: productId,
        },
      })
      creados++
    }
  }

  logger.info(`[Hotmart] Sincronización completada: ${creados} creados, ${actualizados} actualizados`)
  return ApiResponse.success(res, {
    total:       allItems.length,
    creados,
    actualizados,
  })
}

// ---------------------------------------------------------------------------
// Listar ventas desde la API de Hotmart (solo ADMIN)
// ---------------------------------------------------------------------------
export async function listarVentas(req: Request, res: Response) {
  const { desde, hasta, estado, page = '1', limit = '20' } = req.query

  const clientId     = process.env.HOTMART_CLIENT_ID
  const clientSecret = process.env.HOTMART_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return res.status(503).json({ success: false, error: 'Hotmart API no configurada' })
  }

  const token = await getAccessToken()

  const params = new URLSearchParams({
    max_results: String(limit),
    page_token:  String((Number(page) - 1) * Number(limit)),
    ...(desde  && { start_date: String(desde) }),
    ...(hasta  && { end_date: String(hasta) }),
    ...(estado && { transaction_status: String(estado) }),
  })

  const apiRes = await fetch(
    `https://developers.hotmart.com/payments/api/v1/sales/history?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!apiRes.ok) {
    const text = await apiRes.text()
    logger.error(`[Hotmart] Error al consultar ventas: ${apiRes.status} ${text}`)
    return res.status(apiRes.status).json({ success: false, error: 'Error en Hotmart API' })
  }

  const data = await apiRes.json()
  return ApiResponse.success(res, data)
}
