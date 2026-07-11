// Importa ventas de Hotmart que no llegaron por webhook (se perdieron o el
// servidor estaba caído) y por eso no existen como Pago en la base de datos.
// Reusa la misma lógica de creación de curso/estudiante/asesor/pago que el
// webhook (hotmart.controller.ts:webhook), pero partiendo del historial de
// ventas (/sales/history) en vez de un evento en tiempo real.

import { prisma } from '../config/prisma'
import { logger } from '../utils/logger'
import { getAccessToken } from '../controllers/hotmart.controller'
import { horasPorNombreCurso } from '../utils/cursoHoras'

interface VentaFaltante {
  transaccion: string
  comprador: string
  email: string
  producto: string
  monto: number
  fecha: string
  asesorEmail: string | null
  asesorNombre: string | null
}

export interface ResultadoImportacion {
  totalEnHotmart: number
  faltantes: VentaFaltante[]
  creados: number
}

async function fetchAll(token: string, desde: number, hasta: number): Promise<any[]> {
  const items: any[] = []
  let pageToken: string | undefined
  let guard = 0
  do {
    const params = new URLSearchParams({
      max_results: '50',
      start_date: String(desde),
      end_date: String(hasta),
      ...(pageToken && { page_token: pageToken }),
    })
    const res = await fetch(`https://developers.hotmart.com/payments/api/v1/sales/history?${params}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      const text = await res.text()
      logger.error(`[ImportarVentas] Error consultando Hotmart: ${res.status} ${text.slice(0, 200)}`)
      break
    }
    const json: any = await res.json()
    items.push(...(json.items ?? []))
    pageToken = json.page_info?.next_page_token
    guard++
  } while (pageToken && guard < 200)
  return items
}

// /sales/history no trae el afiliado; /sales/commissions sí (source: 'AFFILIATE').
// Se usa para completar el email del asesor por transacción.
async function fetchAfiliadoPorTransaccion(token: string, desde: number, hasta: number): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  let pageToken: string | undefined
  let guard = 0
  do {
    const params = new URLSearchParams({
      max_results: '50',
      start_date: String(desde),
      end_date: String(hasta),
      ...(pageToken && { page_token: pageToken }),
    })
    const res = await fetch(`https://developers.hotmart.com/payments/api/v1/sales/commissions?${params}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    if (!res.ok) break
    const json: any = await res.json()
    for (const it of json.items ?? []) {
      const tx = it?.transaction
      const afiliado = (it?.commissions ?? []).find((c: any) => c.source === 'AFFILIATE')
      if (tx && afiliado?.user?.email) mapa.set(String(tx), String(afiliado.user.email).toLowerCase())
    }
    pageToken = json.page_info?.next_page_token
    guard++
  } while (pageToken && guard < 200)
  return mapa
}

/**
 * @param desde timestamp en ms
 * @param hasta timestamp en ms
 * @param dryRun si es true, solo reporta lo que falta sin crear nada
 */
export async function importarVentasFaltantes(desde: number, hasta: number, dryRun: boolean): Promise<ResultadoImportacion> {
  const clientId = process.env.HOTMART_CLIENT_ID
  const clientSecret = process.env.HOTMART_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Hotmart API no configurada (HOTMART_CLIENT_ID / HOTMART_CLIENT_SECRET)')
  }

  const token = await getAccessToken()
  const items = await fetchAll(token, desde, hasta)
  const afiliadosPorTx = await fetchAfiliadoPorTransaccion(token, desde, hasta)

  // Solo ventas aprobadas/completas
  const aprobadas = items.filter((it) => {
    const status = it?.purchase?.status
    return status === 'APPROVED' || status === 'COMPLETE'
  })

  const transacciones = aprobadas.map((it) => String(it?.purchase?.transaction)).filter(Boolean)
  const existentes = await prisma.pago.findMany({
    where: { referenciaPago: { in: transacciones } },
    select: { referenciaPago: true },
  })
  const existentesSet = new Set(existentes.map((p) => p.referenciaPago))

  const nuevas = aprobadas.filter((it) => !existentesSet.has(String(it?.purchase?.transaction)))

  // Asociar el email del afiliado (de /sales/commissions) a cada item, para
  // que crearVentaDesdeItem pueda buscar el asesor por email igual que el webhook.
  for (const it of nuevas) {
    const email = afiliadosPorTx.get(String(it?.purchase?.transaction))
    if (email) it._afiliadoEmail = email
  }

  const asesoresPorEmail = new Map<string, string>()
  const emailsAfiliados = [...new Set(nuevas.map((it) => it._afiliadoEmail).filter(Boolean))] as string[]
  if (emailsAfiliados.length) {
    const asesores = await prisma.asesor.findMany({
      where: { email: { in: emailsAfiliados, mode: 'insensitive' } },
      select: { email: true, nombre: true },
    })
    for (const a of asesores) asesoresPorEmail.set(a.email.toLowerCase(), a.nombre)
  }

  const faltantes: VentaFaltante[] = nuevas.map((it) => {
    const asesorEmail = it._afiliadoEmail ?? null
    return {
      transaccion: String(it?.purchase?.transaction),
      comprador: it?.buyer?.name ?? '(sin nombre)',
      email: it?.buyer?.email ?? '(sin correo)',
      producto: it?.product?.name ?? '(sin producto)',
      monto: it?.purchase?.price?.value ?? 0,
      fecha: it?.purchase?.approved_date ? new Date(it.purchase.approved_date).toISOString() : '-',
      asesorEmail,
      asesorNombre: asesorEmail ? asesoresPorEmail.get(asesorEmail) ?? null : null,
    }
  })

  logger.info(`[ImportarVentas] ${items.length} ventas en Hotmart, ${aprobadas.length} aprobadas, ${faltantes.length} faltan en la app`)

  if (dryRun || faltantes.length === 0) {
    return { totalEnHotmart: aprobadas.length, faltantes, creados: 0 }
  }

  let creados = 0
  for (const it of nuevas) {
    try {
      await crearVentaDesdeItem(it)
      creados++
    } catch (e: any) {
      logger.error(`[ImportarVentas] Error creando venta ${it?.purchase?.transaction}: ${e?.message}`)
    }
  }

  return { totalEnHotmart: aprobadas.length, faltantes, creados }
}

// Misma lógica de webhook() en hotmart.controller.ts, adaptada al shape de
// /sales/history (item.buyer, item.purchase, item.product, item.affiliates).
async function crearVentaDesdeItem(item: any): Promise<void> {
  const buyer = item.buyer
  const purchase = item.purchase
  const product = item.product
  const affiliates = item.affiliates
  const transaccion = String(purchase.transaction)

  const paymentMode = purchase.offer?.payment_mode ?? null
  const installments = purchase.payment?.installments_number ?? 1
  const esEnPartes = paymentMode === 'MULTIPLE_PAYMENTS'

  const productId = String(product.id)
  let curso = await prisma.curso.findFirst({ where: { hotmartProductId: productId } })
  if (!curso) {
    const tipoCurso = /combo/i.test(product.name) ? 'COMBO' : 'INDIVIDUAL'
    const precioCurso = esEnPartes && installments > 1 ? purchase.price.value * installments : purchase.price.value
    curso = await prisma.curso.create({
      data: {
        nombre: product.name,
        precio: precioCurso,
        tipoCurso,
        activo: true,
        duracionHoras: horasPorNombreCurso(product.name),
        hotmartProductId: productId,
      },
    })
    logger.info(`[ImportarVentas] Curso creado automáticamente: ${product.name} (ID: ${productId})`)
  }

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
        fechaNacimiento: new Date('2000-01-01'),
        verificado: false,
        fuenteContacto: { create: { fuente: 'HOTMART' } },
      },
    })
    logger.info(`[ImportarVentas] Estudiante creado: ${estudiante.id} (${buyer.email})`)
  } else if (!estudiante.telefono && (buyer.checkout_phone || buyer.phone)) {
    estudiante = await prisma.estudiante.update({
      where: { id: estudiante.id },
      data: { telefono: buyer.checkout_phone ?? buyer.phone ?? '' },
    })
  }

  let asesorId: string | undefined
  const affiliateEmail = affiliates?.[0]?.affiliate_email ?? item._afiliadoEmail
  const codigosVenta = [
    purchase.origin?.src,
    purchase.origin?.sck,
    purchase.origin?.xcod,
    affiliates?.[0]?.affiliate_code,
  ].filter((c: unknown): c is string => Boolean(c))

  let asesor = affiliateEmail
    ? await prisma.asesor.findFirst({ where: { email: { equals: affiliateEmail, mode: 'insensitive' } } })
    : null
  if (!asesor && codigosVenta.length) {
    asesor = await prisma.asesor.findFirst({ where: { codigosHotmart: { hasSome: codigosVenta } } })
  }
  if (asesor) {
    asesorId = asesor.id
    if (!estudiante.asesorId) {
      await prisma.estudiante.update({ where: { id: estudiante.id }, data: { asesorId } })
    }
  }

  const montoCargo = purchase.price.value
  let precioAcordado = montoCargo
  if (esEnPartes) {
    precioAcordado = installments > 1
      ? montoCargo * installments
      : Math.max(curso?.precio ?? 0, montoCargo)
  }

  if (curso) {
    await prisma.cursoEstudiante.upsert({
      where: { estudianteId_cursoId: { estudianteId: estudiante.id, cursoId: curso.id } },
      create: { estudianteId: estudiante.id, cursoId: curso.id, precioAcordado },
      update: {},
    })
  }

  const monto = montoCargo
  const fechaPago = purchase.approved_date ? new Date(purchase.approved_date) : new Date()
  const metodo = purchase.payment?.type ?? 'HOTMART'
  const notaPago = esEnPartes
    ? `Compra Hotmart — Producto: ${product.name} (ID: ${product.id}) — Pago en partes (cuota de ${installments}; cargo $${montoCargo.toLocaleString('es-CO')}) — importada manualmente`
    : `Compra Hotmart — Producto: ${product.name} (ID: ${product.id}) — importada manualmente`

  const pago = await prisma.pago.create({
    data: {
      estudianteId: estudiante.id,
      monto,
      estado: 'PAGADO',
      metodo,
      referenciaPago: transaccion,
      fechaVencimiento: fechaPago,
      fechaPago,
      notas: notaPago,
      ...(asesorId && { asesorId }),
    },
  })
  logger.info(`[ImportarVentas] Pago registrado: ${pago.id} — $${monto} (${transaccion})`)
}
