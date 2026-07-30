// Corrida manual de la sincronización de Google Ads, para probarla sin
// esperar al temporizador del servidor.
//
//   pnpm tsx src/jobs/probarGoogleAds.ts
//
// Requiere las variables GOOGLE_ADS_* en el entorno.

import 'dotenv/config'
import { prisma } from '../config/prisma'
import { sincronizarGoogleAds } from './sincronizarGoogleAds'

async function main() {
  await sincronizarGoogleAds()

  const filas = await prisma.inversionPublicitaria.findMany({
    where: { plataforma: 'GOOGLE', fuente: 'API' },
    orderBy: [{ desde: 'desc' }, { gastoCOP: 'desc' }],
    take: 15,
  })

  const total = await prisma.inversionPublicitaria.aggregate({
    where: { plataforma: 'GOOGLE', fuente: 'API' },
    _sum: { gastoCOP: true, clics: true, impresiones: true },
    _count: true,
  })

  console.log(`\nFilas guardadas: ${total._count}`)
  console.log(`Gasto acumulado: $${(total._sum.gastoCOP ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })} COP`)
  console.log(`Clics: ${total._sum.clics} · Impresiones: ${total._sum.impresiones}\n`)
  console.log('Últimas filas:')
  for (const f of filas) {
    const dia = f.desde.toISOString().slice(0, 10)
    console.log(`  ${dia} · ${f.campania} · $${f.gastoCOP.toLocaleString('es-CO', { maximumFractionDigits: 0 })} · ${f.clics} clics`)
  }
}

// El pool de Prisma deja el proceso colgado si no se cierra explícitamente.
main().finally(() => process.exit(0))
