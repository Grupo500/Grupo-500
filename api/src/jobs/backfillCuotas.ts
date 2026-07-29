// Rellena la información de cuotas de los pagos ya registrados.
//
// El webhook no marcaba las ventas a cuotas (exigía un `payment_mode` que no
// llegaba), así que quedaron guardadas como pago único y con el valor de la
// cuota tomado por precio del curso. Este proceso consulta la API de Hotmart
// —que sí reporta cuotas— y corrige lo que haga falta.
//
// Uso:
//   npx tsx src/jobs/backfillCuotas.ts           → simulacro, no escribe nada
//   npx tsx src/jobs/backfillCuotas.ts --aplicar → aplica los cambios

import { prisma } from '../config/prisma'
import { getAccessToken } from '../controllers/hotmart.controller'

interface VentaHotmart {
  purchase?: {
    transaction?: string
    recurrency_number?: number
    payment?: { installments_number?: number }
    offer?: { payment_mode?: string }
    price?: { value?: number }
  }
}

async function paginar(token: string, url: string): Promise<VentaHotmart[]> {
  const items: VentaHotmart[] = []
  let page: string | undefined
  let guard = 0
  do {
    const u = url + (url.includes('?') ? '&' : '?') + 'max_results=50' + (page ? `&page_token=${page}` : '')
    const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) break
    const json = (await res.json()) as any
    items.push(...(json.items ?? []))
    page = json.page_info?.next_page_token
    guard++
  } while (page && guard < 200)
  return items
}

export async function backfillCuotas(aplicar = false, desdeISO = '2026-01-01') {
  const token = await getAccessToken()
  const desde = new Date(desdeISO).getTime()
  const hasta = Date.now()

  console.log(`Consultando Hotmart desde ${desdeISO}...`)
  const ventas = await paginar(
    token,
    `https://developers.hotmart.com/payments/api/v1/sales/history?transaction_status=APPROVED&start_date=${desde}&end_date=${hasta}`
  )
  console.log(`  ${ventas.length} ventas aprobadas`)

  // transacción -> datos de cuotas
  const info = new Map<string, { cuotas: number; numero: number | null; enPartes: boolean; cargo: number }>()
  for (const v of ventas) {
    const p = v.purchase
    if (!p?.transaction) continue
    const cuotas = p.payment?.installments_number ?? 1
    const numero = p.recurrency_number ?? null
    // Solo `payment_mode` distingue el pago en partes del producto (el dinero
    // entra por cuotas) de la financiacion con tarjeta del comprador, donde
    // installments_number tambien es > 1 pero el productor cobra todo de una.
    const enPartes = p.offer?.payment_mode === 'MULTIPLE_PAYMENTS'
    info.set(p.transaction, { cuotas, numero, enPartes, cargo: p.price?.value ?? 0 })
  }
  const aCuotas = [...info.values()].filter(i => i.enPartes).length
  console.log(`  ${aCuotas} son a cuotas\n`)

  const pagos = await prisma.pago.findMany({
    where: { referenciaPago: { in: [...info.keys()] } },
    select: { id: true, referenciaPago: true, estudianteId: true, monto: true, enPartes: true, fechaPago: true },
  })
  console.log(`Pagos de la app que cruzan con esas transacciones: ${pagos.length}`)

  let marcados = 0
  const enPartes: { estudianteId: string; cuotas: number; cargo: number; fechaPago: Date | null }[] = []

  for (const pago of pagos) {
    const i = info.get(pago.referenciaPago!)
    if (!i || !i.enPartes) continue
    marcados++
    if (aplicar) {
      await prisma.pago.update({
        where: { id: pago.id },
        data: { enPartes: true, cuotasTotal: i.cuotas, cuotaNumero: i.numero ?? 1 },
      })
    }
    if (i.cuotas > 1) {
      enPartes.push({ estudianteId: pago.estudianteId, cuotas: i.cuotas, cargo: pago.monto, fechaPago: pago.fechaPago })
    }
  }
  console.log(`Pagos a marcar como en partes: ${marcados}`)

  // ── Precio acordado mal guardado ──
  // Un pago no dice a qué curso pertenece. Se empareja con el curso del mismo
  // estudiante cuya fecha de compra queda más cerca del pago, y solo se corrige
  // si el total resultante es creíble frente al precio de lista: un estudiante
  // con varios cursos, si se cruzan, produce disparates (RUTA 500 de $350.000
  // saltando a $11.500.500).
  const cursosEst = await prisma.cursoEstudiante.findMany({
    where: { estudianteId: { in: [...new Set(enPartes.map(p => p.estudianteId))] } },
    include: { curso: { select: { nombre: true, precio: true } } },
  })
  const porEstudiante = new Map<string, typeof cursosEst>()
  for (const ce of cursosEst) {
    const arr = porEstudiante.get(ce.estudianteId) ?? []
    arr.push(ce)
    porEstudiante.set(ce.estudianteId, arr)
  }

  const correcciones: { curso: string; actual: number | null; nuevo: number }[] = []
  const dudosos: { curso: string; actual: number | null; propuesto: number; lista: number }[] = []
  const yaVistos = new Set<string>()

  for (const p of enPartes) {
    const cursos = porEstudiante.get(p.estudianteId) ?? []
    if (cursos.length === 0) continue
    const t = p.fechaPago?.getTime() ?? 0
    const ce = cursos.reduce((mejor, c) => {
      if (!c.fechaCompra) return mejor
      if (!mejor.fechaCompra) return c
      return Math.abs(c.fechaCompra.getTime() - t) < Math.abs(mejor.fechaCompra.getTime() - t) ? c : mejor
    })

    const clave = `${ce.estudianteId}:${ce.cursoId}`
    if (yaVistos.has(clave)) continue
    yaVistos.add(clave)

    const total = Math.round(p.cargo * p.cuotas)
    const lista = ce.curso.precio ?? 0
    const actual = ce.precioAcordado ?? null

    // Ya está bien guardado.
    if (actual != null && actual >= total * 0.9) continue

    // El total debe parecerse al precio de lista. Si se dispara, el pago
    // probablemente corresponde a otro curso del mismo estudiante.
    // Con precio de lista en cero no hay contra qué contrastar: se acepta el
    // dato de Hotmart, que para MULTIPLE_PAYMENTS es cargo × cuotas por
    // definición.
    const creible = lista === 0 || (total >= lista * 0.6 && total <= lista * 1.6)
    if (!creible) {
      dudosos.push({ curso: ce.curso.nombre, actual, propuesto: total, lista })
      continue
    }

    correcciones.push({ curso: ce.curso.nombre, actual, nuevo: total })
    if (aplicar) {
      await prisma.cursoEstudiante.update({
        where: { estudianteId_cursoId: { estudianteId: ce.estudianteId, cursoId: ce.cursoId } },
        data: { precioAcordado: total },
      })
    }
  }

  console.log(`\nPrecios acordados a corregir: ${correcciones.length}`)
  correcciones.slice(0, 12).forEach(c =>
    console.log(`  ${c.curso.slice(0, 40).padEnd(42)} $${(c.actual ?? 0).toLocaleString('es-CO').padStart(11)} -> $${c.nuevo.toLocaleString('es-CO')}`)
  )
  if (correcciones.length > 12) console.log(`  ... y ${correcciones.length - 12} más`)

  console.log(`\nCasos dudosos (NO se tocan, revisar a mano): ${dudosos.length}`)
  dudosos.slice(0, 10).forEach(d =>
    console.log(`  ${d.curso.slice(0, 40).padEnd(42)} actual $${(d.actual ?? 0).toLocaleString('es-CO')} | propuesto $${d.propuesto.toLocaleString('es-CO')} | lista $${d.lista.toLocaleString('es-CO')}`)
  )

  console.log(aplicar ? '\nCAMBIOS APLICADOS' : '\nSIMULACRO — no se escribió nada. Usa --aplicar para ejecutarlo.')
  return { marcados, correcciones: correcciones.length }
}

if (require.main === module) {
  const aplicar = process.argv.includes('--aplicar')
  backfillCuotas(aplicar)
    .then(() => process.exit(0))
    .catch(e => { console.error('ERROR:', e.message); process.exit(1) })
}
