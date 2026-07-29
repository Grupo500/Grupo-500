/**
 * Comprueba los indicadores de Finanzas contra la base, sin levantar Express.
 * Uso: npx tsx src/jobs/verificarFinanzas.ts
 */
import { prisma } from '../config/prisma'
import { diaColombia } from '../services/ranking'
import {
  pagosDelRango, primerasCompras, totalesDe, mesAnteriorAIgualDia, esVentaNueva,
} from '../services/finanzas'
import { leerUmbrales } from '../services/finanzasParametros'

const cop = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

async function main() {
  const hoy = new Date()
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const anterior = mesAnteriorAIgualDia(desde, hoy)
  const piso = new Date((process.env.FINANZAS_FECHA_INICIO ?? '2026-01-01') + 'T00:00:00')

  const primero = await prisma.pago.aggregate({
    where: { estado: 'PAGADO', fechaPago: { gte: piso } },
    _min: { fechaPago: true },
  })
  const inicioModelo = primero._min.fechaPago ?? piso

  const [mes, ant, acum, primeras, umbrales] = await Promise.all([
    pagosDelRango(desde, hoy),
    pagosDelRango(anterior.desde, anterior.hasta),
    pagosDelRango(inicioModelo, hoy),
    primerasCompras(),
    leerUmbrales(),
  ])

  const iso = (d: Date) => diaColombia(d)!
  const t = totalesDe(mes, primeras, iso(desde), iso(hoy))
  const tAnt = totalesDe(ant, primeras, iso(anterior.desde), iso(anterior.hasta))
  const tAcum = totalesDe(acum, primeras, iso(inicioModelo), iso(hoy))

  console.log('Inicio del modelo :', iso(inicioModelo))
  console.log('')
  console.log('── Mes en curso ──────────────────────────────')
  console.log('Ventas nuevas     :', t.ventasNuevas, '(pagos:', mes.length + ')')
  console.log('Valor vendido     :', cop(t.valorVendido))
  console.log('Facturado cobrado :', cop(t.facturacionCobrada))
  console.log('Clientes nuevos   :', t.clientesNuevos)
  console.log('Mes anterior      :', tAnt.ventasNuevas, 'ventas ·', cop(tAnt.valorVendido))
  console.log('')
  console.log('── Acumulado ─────────────────────────────────')
  console.log('Ventas nuevas     :', tAcum.ventasNuevas)
  console.log('Valor vendido     :', cop(tAcum.valorVendido))
  console.log('Saldo programado  :', cop(tAcum.cuotasFuturasOriginadas - tAcum.cuotasCobradas))

  // ── Segmentación RFV ────────────────────────────────────────────────────
  const pagosTodos = await prisma.pago.findMany({
    where: { estado: 'PAGADO' },
    select: { montoNeto: true, fechaPago: true, cuotaNumero: true, estudianteId: true },
    orderBy: { fechaPago: 'asc' },
  })
  const porCliente = new Map<string, { compras: number; ultima: Date | null; neto: number }>()
  for (const p of pagosTodos) {
    const c = porCliente.get(p.estudianteId) ?? { compras: 0, ultima: null, neto: 0 }
    c.neto += p.montoNeto ?? 0
    if (esVentaNueva(p)) { c.compras++; c.ultima = p.fechaPago }
    porCliente.set(p.estudianteId, c)
  }
  const conCompra = [...porCliente.values()].filter(c => c.compras > 0)
  const recompra = conCompra.filter(c => c.compras >= 2).length
  const inactivos = conCompra.filter(c =>
    c.ultima ? (Date.now() - c.ultima.getTime()) / 86_400_000 > umbrales.rInactivo : false).length

  console.log('')
  console.log('── Clientes RFV ──────────────────────────────')
  console.log('Clientes con compra:', conCompra.length)
  console.log('Con recompra       :', recompra,
    '(' + ((recompra / Math.max(1, conCompra.length)) * 100).toFixed(2) + '%)')
  console.log('Inactivos (>' + umbrales.rInactivo + 'd):', inactivos)

  // ── Reporte diario de hoy ───────────────────────────────────────────────
  const hoyIso = iso(hoy)
  const delDia = mes.filter(p => diaColombia(p.fechaPago) === hoyIso)
  console.log('')
  console.log('── Reporte diario (' + hoyIso + ') ────────────')
  console.log('Pagos del dia      :', delDia.length)
  console.log('Ventas nuevas      :', delDia.filter(esVentaNueva).length)
  console.log('Cobrado            :', cop(delDia.reduce((s, p) => s + p.monto, 0)))

  // ── Publicidad y precios ────────────────────────────────────────────────
  const [inversion, precios] = await Promise.all([
    prisma.inversionPublicitaria.count(),
    prisma.precioOficial.count(),
  ])
  console.log('')
  console.log('── Configuración ─────────────────────────────')
  console.log('Campañas cargadas  :', inversion)
  console.log('Precios oficiales  :', precios)
  console.log('Umbrales RFV       :', JSON.stringify(umbrales))

  await prisma.$disconnect()
  // Salida explícita: sin esto el proceso queda vivo por el pool de Prisma.
  process.exit(0)
}

main().catch(async e => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
