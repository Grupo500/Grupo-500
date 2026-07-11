// Uso:
//   cd api && npx tsx scripts/importarVentasRango.ts --desde=2026-07-09 [--hasta=2026-07-10] [--commit]
//   Sin --hasta, usa el momento actual. Sin --commit, corre en modo simulación.

import 'dotenv/config'
import { importarVentasFaltantes } from '../src/jobs/importarVentasFaltantes'
import { prisma } from '../src/config/prisma'

function argValue(flag: string): string | undefined {
  const arg = process.argv.find(a => a.startsWith(`--${flag}=`))
  return arg?.split('=')[1]
}

async function main() {
  const commit = process.argv.includes('--commit')
  const desdeStr = argValue('desde')
  const hastaStr = argValue('hasta')

  if (!desdeStr) {
    console.error('Falta --desde=YYYY-MM-DD')
    process.exit(1)
  }

  const [dy, dm, dd] = desdeStr.split('-').map(Number)
  const desde = new Date(dy, dm - 1, dd, 0, 0, 0).getTime()

  let hasta: number
  if (hastaStr) {
    const [hy, hm, hd] = hastaStr.split('-').map(Number)
    hasta = new Date(hy, hm - 1, hd, 23, 59, 59).getTime()
  } else {
    hasta = Date.now()
  }

  console.log(`Buscando ventas entre ${new Date(desde).toLocaleString('es-CO')} y ${new Date(hasta).toLocaleString('es-CO')} en Hotmart...`)
  console.log(commit ? 'Modo: CREAR (se guardarán en la base de datos)' : 'Modo: SIMULACIÓN (no se crea nada)')

  const resultado = await importarVentasFaltantes(desde, hasta, !commit)

  console.log(`\nVentas aprobadas en Hotmart en el rango: ${resultado.totalEnHotmart}`)
  console.log(`Ventas que faltan en la app: ${resultado.faltantes.length}`)

  if (resultado.faltantes.length > 0) {
    console.table(resultado.faltantes.map(f => ({
      Transacción: f.transaccion,
      Comprador: f.comprador,
      Email: f.email,
      Producto: f.producto,
      Monto: f.monto,
      Asesor: f.asesorNombre ?? (f.asesorEmail ? `? (${f.asesorEmail}, sin match en Asesor)` : '(sin afiliado)'),
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
