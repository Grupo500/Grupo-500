/**
 * Comprueba los indicadores de Finanzas contra la base, sin levantar Express.
 * Uso: npx tsx src/jobs/verificarFinanzas.ts
 */
import { prisma } from '../config/prisma'
import { diaColombia } from '../services/ranking'
import {
  pagosDelRango, primerasCompras, totalesDe, mesAnteriorAIgualDia,
} from '../services/finanzas'

const cop = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

async function main() {
  const hoy = new Date()
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const corte = hoy

  const anterior = mesAnteriorAIgualDia(desde, corte)

  const primerPago = await prisma.pago.aggregate({ where: { estado: 'PAGADO' }, _min: { fechaPago: true } })
  const inicioModelo = primerPago._min.fechaPago!

  const [mes, ant, acum, primeras] = await Promise.all([
    pagosDelRango(desde, corte),
    pagosDelRango(anterior.desde, anterior.hasta),
    pagosDelRango(inicioModelo, corte),
    primerasCompras(),
  ])

  const iso = (d: Date) => diaColombia(d)!
  const t = totalesDe(mes, primeras, iso(desde), iso(corte))
  const tAnt = totalesDe(ant, primeras, iso(anterior.desde), iso(anterior.hasta))
  const tAcum = totalesDe(acum, primeras, iso(inicioModelo), iso(corte))

  console.log('Inicio del modelo :', iso(inicioModelo))
  console.log('Periodo           :', iso(desde), '→', iso(corte))
  console.log('Mes anterior      :', iso(anterior.desde), '→', iso(anterior.hasta))
  console.log('')
  console.log('── Mes en curso ──────────────────────────────')
  console.log('Ventas nuevas     :', t.ventasNuevas, ' (pagos totales:', mes.length + ')')
  console.log('Valor vendido     :', cop(t.valorVendido))
  console.log('Facturado cobrado :', cop(t.facturacionCobrada))
  console.log('Neto recibido     :', cop(t.netoRecibido))
  console.log('Costes            :', cop(t.costes))
  console.log('Clientes nuevos   :', t.clientesNuevos)
  console.log('Contado / plazos  :', t.ventasContado, '/', t.ventasPlazos)
  console.log('')
  console.log('── Mes anterior a igual dia ──────────────────')
  console.log('Ventas nuevas     :', tAnt.ventasNuevas)
  console.log('Valor vendido     :', cop(tAnt.valorVendido))
  console.log('')
  console.log('── Acumulado ─────────────────────────────────')
  console.log('Ventas nuevas     :', tAcum.ventasNuevas)
  console.log('Valor vendido     :', cop(tAcum.valorVendido))
  console.log('Facturado cobrado :', cop(tAcum.facturacionCobrada))
  console.log('Cuotas originadas :', cop(tAcum.cuotasFuturasOriginadas))
  console.log('Cuotas cobradas   :', cop(tAcum.cuotasCobradas))
  console.log('Saldo programado  :', cop(tAcum.cuotasFuturasOriginadas - tAcum.cuotasCobradas))

  await prisma.$disconnect()
  // Salida explícita: sin esto el proceso queda vivo por el pool de Prisma.
  process.exit(0)
}

main().catch(async e => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
