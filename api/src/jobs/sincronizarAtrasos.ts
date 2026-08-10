// Trae de Hotmart las cuotas cuyo cobro falló y siguen sin pagarse, y las
// guarda en `CuotaAtrasada`.
//
// Antes el atraso se ESTIMABA: 30 días de ciclo + 7 de gracia desde el último
// cobro conocido. Eso fallaba en los dos sentidos — marcaba en mora a quien
// Hotmart ya le había reintentado el cobro con éxito, y dejaba pasar cuotas
// que llevaban semanas vencidas. Hotmart sí sabe cuál cobro falló y lo expone
// como `transaction_status=OVERDUE`.
//
// Dos filtros hacen la diferencia entre una lista real y una lista con ruido:
//
//   1. Reintento exitoso. Hotmart vuelve a intentar el cobro; si entra, la
//      venta aparece además como APPROVED/COMPLETE. Sin descartar esas, se
//      llamaría a clientes que ya pagaron.
//   2. Pago por fuera. El cliente puede pagar la cuota por Nequi o
//      transferencia; Hotmart nunca se entera y la deja OVERDUE para siempre.
//      Como el abono sí quedó registrado en la app (ver `cuotaQueSalda`), se
//      descarta comparando contra lo que tenemos cobrado.
//
// Además, Hotmart crea una fila OVERDUE por CADA intento fallido de la misma
// cuota, así que se deduplica por comprador+producto+número de cuota.
//
// Uso:
//   npx tsx src/jobs/sincronizarAtrasos.ts            → simulacro
//   npx tsx src/jobs/sincronizarAtrasos.ts --aplicar  → escribe

import { prisma } from '../config/prisma'
import { logger } from '../utils/logger'
import { getAccessToken } from '../controllers/hotmart.controller'

interface VentaHotmart {
  product?: { id?: number; name?: string }
  buyer?: { name?: string; email?: string }
  purchase?: {
    transaction?: string
    recurrency_number?: number
    payment?: { installments_number?: number }
    offer?: { payment_mode?: string }
    price?: { value?: number }
    order_date?: number
  }
}

const API = 'https://developers.hotmart.com/payments/api/v1/sales/history'

async function paginar(token: string, url: string): Promise<VentaHotmart[]> {
  const items: VentaHotmart[] = []
  let page: string | undefined
  let guard = 0
  do {
    const u = url + (url.includes('?') ? '&' : '?') + 'max_results=50' + (page ? `&page_token=${page}` : '')
    const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      logger.warn(`[Atrasos] Hotmart respondió ${res.status} — se corta la paginación`)
      break
    }
    const json = (await res.json()) as any
    items.push(...(json.items ?? []))
    page = json.page_info?.next_page_token
    guard++
  } while (page && guard < 200)
  return items
}

/** Identidad de una cuota concreta: quién, qué producto y qué número de cuota. */
function claveCuota(v: VentaHotmart): string {
  return `${(v.buyer?.email ?? '').trim().toLowerCase()}|${v.product?.id}|${v.purchase?.recurrency_number ?? 1}`
}

export async function sincronizarAtrasos(aplicar = false, desdeISO = '2026-01-01'): Promise<void> {
  if (!process.env.HOTMART_CLIENT_ID || !process.env.HOTMART_CLIENT_SECRET) {
    logger.warn('[Atrasos] Hotmart no configurado — omitido')
    return
  }

  const token = await getAccessToken()
  const rango = `start_date=${new Date(desdeISO).getTime()}&end_date=${Date.now()}`

  const [overdue, aprobadas, completadas] = await Promise.all([
    paginar(token, `${API}?transaction_status=OVERDUE&${rango}`),
    paginar(token, `${API}?transaction_status=APPROVED&${rango}`),
    paginar(token, `${API}?transaction_status=COMPLETE&${rango}`),
  ])

  // Solo planes a cuotas: un OVERDUE de una compra de contado es otra cosa
  // (un billete que nunca se pagó), no una cuota atrasada.
  const deCuotas = overdue.filter(v => v.purchase?.offer?.payment_mode === 'MULTIPLE_PAYMENTS')

  // Filtro 1 — el reintento entró.
  const cobradas = new Set<string>()
  for (const v of [...aprobadas, ...completadas]) cobradas.add(claveCuota(v))
  const sinCobrar = deCuotas.filter(v => !cobradas.has(claveCuota(v)))

  // Hotmart deja una fila por intento fallido: nos quedamos con el más reciente.
  const porCuota = new Map<string, VentaHotmart>()
  for (const v of sinCobrar) {
    const k = claveCuota(v)
    const previa = porCuota.get(k)
    if (!previa || (v.purchase?.order_date ?? 0) > (previa.purchase?.order_date ?? 0)) porCuota.set(k, v)
  }
  const candidatas = [...porCuota.values()]

  // Filtro 2 — la cuota se pagó por fuera de Hotmart y quedó registrada aquí.
  // Se compara contra los pagos del estudiante: si ya tiene cobrada una cuota
  // de número igual o mayor en un plan del mismo tamaño, esta no está en mora.
  const emails = [...new Set(candidatas.map(v => (v.buyer?.email ?? '').trim().toLowerCase()))]
  const estudiantes = await prisma.estudiante.findMany({
    where: { email: { in: emails } },
    select: {
      id: true, email: true,
      pagos: {
        where: { estado: 'PAGADO', enPartes: true },
        select: { cuotaNumero: true, cuotasTotal: true },
      },
    },
  })
  const porEmail = new Map(estudiantes.map(e => [e.email.trim().toLowerCase(), e]))

  const vivas: { v: VentaHotmart; estudianteId: string | null }[] = []
  let yaPagadasAparte = 0
  for (const v of candidatas) {
    const email = (v.buyer?.email ?? '').trim().toLowerCase()
    const est = porEmail.get(email)
    const rec = v.purchase?.recurrency_number ?? 1
    const total = v.purchase?.payment?.installments_number ?? 1

    // Del mismo plan (mismo número de cuotas), la cuota más avanzada cobrada.
    const maxCobrada = Math.max(
      0,
      ...(est?.pagos ?? []).filter(p => p.cuotasTotal === total).map(p => p.cuotaNumero ?? 0),
    )
    if (maxCobrada >= rec) { yaPagadasAparte++; continue }

    vivas.push({ v, estudianteId: est?.id ?? null })
  }

  logger.info(
    `[Atrasos] Hotmart: ${overdue.length} vencidas (${deCuotas.length} de planes a cuotas) → ` +
    `${deCuotas.length - sinCobrar.length} ya recobradas por Hotmart, ` +
    `${sinCobrar.length - candidatas.length} reintentos duplicados, ` +
    `${yaPagadasAparte} pagadas por fuera → ${vivas.length} atrasos reales`
  )

  const sinEstudiante = vivas.filter(x => !x.estudianteId).length
  if (sinEstudiante) logger.warn(`[Atrasos] ${sinEstudiante} atraso(s) sin estudiante en la base (comprador no registrado)`)

  if (!aplicar) {
    for (const { v } of vivas.slice(0, 15)) {
      const p = v.purchase!
      logger.info(
        `  ${(v.buyer?.name ?? '').trim()} — cuota ${p.recurrency_number}/${p.payment?.installments_number} ` +
        `$${(p.price?.value ?? 0).toLocaleString('es-CO')} desde ${new Date(p.order_date ?? 0).toISOString().slice(0, 10)}`
      )
    }
    logger.info('[Atrasos] Simulación — no se escribió nada')
    return
  }

  for (const { v, estudianteId } of vivas) {
    const p = v.purchase!
    const datos = {
      estudianteId,
      emailComprador: (v.buyer?.email ?? '').trim().toLowerCase(),
      nombreComprador: (v.buyer?.name ?? '').trim(),
      productoId: String(v.product?.id ?? ''),
      productoNombre: v.product?.name ?? 'Sin producto',
      cuotaNumero: p.recurrency_number ?? 1,
      cuotasTotal: p.payment?.installments_number ?? 1,
      monto: Math.round(p.price?.value ?? 0),
      fechaCobro: new Date(p.order_date ?? Date.now()),
    }
    await prisma.cuotaAtrasada.upsert({
      where: { transaccion: p.transaction! },
      create: { transaccion: p.transaction!, ...datos },
      update: datos,
    })
  }

  // Lo que ya no está atrasado se borra: si se dejara, la lista solo crecería
  // y volveríamos a llamar a gente que ya pagó.
  const vigentes = vivas.map(x => x.v.purchase!.transaction!)
  const { count } = await prisma.cuotaAtrasada.deleteMany({
    where: { transaccion: { notIn: vigentes } },
  })

  logger.info(`[Atrasos] ${vivas.length} atraso(s) al día; ${count} resuelto(s) y eliminado(s)`)
}

if (require.main === module) {
  sincronizarAtrasos(process.argv.includes('--aplicar'))
    .catch(e => { logger.error(`[Atrasos] ${e?.message}`); process.exitCode = 1 })
    .finally(() => prisma.$disconnect())
}
