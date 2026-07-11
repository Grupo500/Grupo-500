// Uso:
//   cd api && npx tsx scripts/importarVentasHoy.ts            (simulación, no crea nada)
//   cd api && npx tsx scripts/importarVentasHoy.ts --commit   (crea los pagos faltantes)

import 'dotenv/config'
import { importarVentasFaltantes } from '../src/jobs/importarVentasFaltantes'
import { prisma } from '../src/config/prisma'

async function main() {
  const commit = process.argv.includes('--commit')

  const ahora = new Date()
  const inicioDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0)
  const desde = inicioDia.getTime()
  const hasta = ahora.getTime()

  console.log(`Buscando ventas de hoy (${inicioDia.toLocaleDateString('es-CO')}) en Hotmart...`)
  console.log(commit ? 'Modo: CREAR (se guardarán en la base de datos)' : 'Modo: SIMULACIÓN (no se crea nada)')

  const resultado = await importarVentasFaltantes(desde, hasta, !commit)

  console.log(`\nVentas aprobadas en Hotmart hoy: ${resultado.totalEnHotmart}`)
  console.log(`Ventas que faltan en la app: ${resultado.faltantes.length}`)

  if (resultado.faltantes.length > 0) {
    console.table(resultado.faltantes.map(f => ({
      Transacción: f.transaccion,
      Comprador: f.comprador,
      Email: f.email,
      Producto: f.producto,
      Monto: f.monto,
      Fecha: f.fecha,
    })))
  }

  if (commit) {
    console.log(`\nCreados: ${resultado.creados} de ${resultado.faltantes.length}`)
  } else if (resultado.faltantes.length > 0) {
    console.log('\nEjecuta con --commit para crear estos registros en la base de datos.')
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Error:', e?.message ?? e)
  process.exit(1)
})
