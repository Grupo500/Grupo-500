import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { logger } from '../utils/logger'
import { auditLog } from '../utils/auditLogger'
import { broadcast } from '../utils/sseManager'

// ---------------------------------------------------------------------------
// Tipos del payload de Hotmart
// ---------------------------------------------------------------------------
interface HotmartBuyer {
  name: string
  email: string
  phone?: string
  checkout_phone?: string   // Hotmart envía el teléfono aquí, no en `phone`
  document?: string
}

interface HotmartPurchase {
  transaction: string
  status: string
  price: { value: number; currency_value?: string }
  payment?: { type?: string }
  approved_date?: number
  // Códigos de rastreo del link usado en la compra (?src= y ?sck=)
  origin?: { xcod?: string; sck?: string; src?: string }
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

  // Idempotencia: si ya existe el pago con esta referencia no se duplica, pero
  // SÍ se sincronizan datos del comprador que pudieron cambiar en Hotmart
  // (ej. correo corregido) cuando se reenvía el webhook de la misma transacción.
  const pagoExistente = await prisma.pago.findFirst({
    where: { referenciaPago: transaccion },
    include: { estudiante: true },
  })
  if (pagoExistente) {
    const est = pagoExistente.estudiante
    if (est) {
      const nuevoEmail = buyer.email?.toLowerCase()
      const nuevoTel   = buyer.checkout_phone ?? buyer.phone
      const cambios: { email?: string; telefono?: string } = {}
      if (nuevoEmail && nuevoEmail !== est.email)        cambios.email    = nuevoEmail
      if (nuevoTel   && nuevoTel   !== est.telefono)     cambios.telefono = nuevoTel
      if (Object.keys(cambios).length) {
        await prisma.estudiante.update({ where: { id: est.id }, data: cambios })
        logger.info(`[Hotmart] Datos sincronizados del estudiante ${est.id} (${Object.keys(cambios).join(', ')}) por reenvío de ${transaccion}`)
        broadcast('nuevo-estudiante', { estudianteId: est.id, cursoId: '' })
        return res.status(200).json({ success: true, message: 'Datos del comprador sincronizados' })
      }
    }
    logger.info(`[Hotmart] Pago ${transaccion} ya procesado — sin cambios`)
    return res.status(200).json({ success: true, message: 'Ya procesado' })
  }

  // Buscar o crear el curso por hotmartProductId
  const productId = String(product.id)
  let curso = await prisma.curso.findFirst({
    where: { hotmartProductId: productId },
  })
  if (!curso) {
    const tipoCurso = /combo/i.test(product.name) ? 'COMBO' : 'INDIVIDUAL'
    curso = await prisma.curso.create({
      data: {
        nombre: product.name,
        precio: purchase.price.value,
        tipoCurso,
        activo: true,
        duracionHoras: 0,
        hotmartProductId: productId,
      },
    })
    logger.info(`[Hotmart] Curso creado automáticamente: ${product.name} (ID: ${productId})`)
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
        telefono: buyer.checkout_phone ?? buyer.phone ?? '',
        documento: buyer.document ?? '',
        fechaNacimiento: new Date('2000-01-01'), // se actualiza al verificar
        verificado: false,
        fuenteContacto: { create: { fuente: 'HOTMART' } },
      },
    })
    logger.info(`[Hotmart] Estudiante creado: ${estudiante.id} (${buyer.email})`)
  } else if (!estudiante.telefono && (buyer.checkout_phone || buyer.phone)) {
    // Rellenar teléfono si el estudiante ya existía sin él
    estudiante = await prisma.estudiante.update({
      where: { id: estudiante.id },
      data: { telefono: buyer.checkout_phone ?? buyer.phone ?? '' },
    })
  }

  // Identificar asesor: por email de afiliado o por código de rastreo del link
  let asesorId: string | undefined
  const affiliateEmail = affiliates?.[0]?.affiliate_email
  const codigosVenta = [
    purchase.origin?.src,
    purchase.origin?.sck,
    purchase.origin?.xcod,
    affiliates?.[0]?.affiliate_code,
  ].filter((c): c is string => Boolean(c))

  let asesor = affiliateEmail
    ? await prisma.asesor.findFirst({
        where: { email: { equals: affiliateEmail, mode: 'insensitive' } },
      })
    : null

  if (!asesor && codigosVenta.length) {
    asesor = await prisma.asesor.findFirst({
      where: { codigosHotmart: { hasSome: codigosVenta } },
    })
  }

  if (asesor) {
    asesorId = asesor.id
    logger.info(`[Hotmart] Asesor identificado: ${asesor.nombre}`)
    // Asignar al estudiante si aún no tiene asesor
    if (!estudiante.asesorId) {
      await prisma.estudiante.update({
        where: { id: estudiante.id },
        data: { asesorId },
      })
    }
  } else if (affiliateEmail || codigosVenta.length) {
    logger.warn(
      `[Hotmart] Venta con rastreo sin asesor vinculado — email: ${affiliateEmail ?? '-'}, códigos: ${codigosVenta.join(', ') || '-'}`
    )
  }

  // Matricular al curso si no está ya matriculado.
  // precioAcordado = precio real de la oferta (con descuento si aplica) —
  // así el saldo se calcula contra lo que esta persona acordó pagar.
  if (curso) {
    await prisma.cursoEstudiante.upsert({
      where: { estudianteId_cursoId: { estudianteId: estudiante.id, cursoId: curso.id } },
      create: { estudianteId: estudiante.id, cursoId: curso.id, precioAcordado: purchase.price.value },
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

  logger.info(`[Hotmart] Pago registrado: ${pago.id} — $${monto} ${purchase.price.currency_value ?? ''}`)
  broadcast('nuevo-estudiante', { estudianteId: estudiante.id, cursoId: curso.id })
  broadcast('pago-registrado', { pagoId: pago.id, estudianteId: estudiante.id })
  auditLog(
    req as any,
    'CREATE',
    'pago',
    pago.id,
    { source: 'hotmart', transaccion, estudianteId: estudiante.id, cursoId: curso?.id }
  )

  // Calcular el desglose de comisión de inmediato (sin esperar al job periódico).
  // Fire-and-forget: no bloquea la respuesta a Hotmart. Re-emite el evento al
  // terminar para que rankings y comisiones se refresquen en tiempo real.
  void (async () => {
    try {
      const { backfillComisiones } = await import('../jobs/backfillComisiones')
      await backfillComisiones()
      broadcast('pago-registrado', { pagoId: pago.id, estudianteId: estudiante.id })
    } catch (e: any) {
      logger.warn(`[Hotmart] No se pudo calcular la comisión al instante: ${e?.message}`)
    }
    // Notificar a los ADMIN de la nueva venta (push)
    try {
      const { sendPushToAdmins } = await import('../services/push')
      await sendPushToAdmins({
        title: '💰 Nueva venta',
        body:  `$${monto.toLocaleString('es-CO')} — ${buyer.name} · ${product.name}`,
        url:   '/dashboard',
      })
    } catch (e: any) {
      logger.warn(`[Push] No se pudo notificar venta al admin: ${e?.message}`)
    }
    // Evaluar ranking y notificar al rebasado (asesor) + podio/nuevo #1 (admin)
    try {
      const { evaluarRankingYNotificar } = await import('../services/rankingNotificaciones')
      await evaluarRankingYNotificar()
    } catch (e: any) {
      logger.warn(`[Ranking] No se pudo evaluar notificaciones: ${e?.message}`)
    }
  })()

  return res.status(200).json({ success: true, pagoId: pago.id, estudianteId: estudiante.id })
}

// ---------------------------------------------------------------------------
// Token OAuth con caché en memoria
// ---------------------------------------------------------------------------
let cachedToken: { token: string; expiresAt: number } | null = null

export async function getAccessToken(): Promise<string> {
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
    const rawText = await apiRes.text()
    logger.info(`[Hotmart] Productos API status: ${apiRes.status} body: ${rawText.slice(0, 300)}`)

    if (!apiRes.ok) {
      logger.error(`[Hotmart] Error al obtener productos: ${apiRes.status} ${rawText}`)
      return res.status(apiRes.status).json({ success: false, error: 'Error al obtener productos de Hotmart' })
    }
    if (!rawText) {
      logger.warn('[Hotmart] La API de productos devolvió body vacío')
      break
    }

    let json: { items?: any[]; page_info?: { next_page_token?: string } }
    try {
      json = JSON.parse(rawText)
    } catch {
      logger.error(`[Hotmart] Respuesta no-JSON de productos: ${rawText.slice(0, 300)}`)
      return res.status(500).json({ success: false, error: 'Respuesta inválida de Hotmart' })
    }

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
