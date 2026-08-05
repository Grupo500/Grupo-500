import { prisma } from '../config/prisma'
import { publicarEnRed } from '../services/metaGraph.service'

// Publica las programadas vencidas. Corre cada minuto vía setInterval (index.ts).
// updateMany con filtro de estado hace de candado: si dos ticks se solapan,
// solo uno logra pasar la fila a PUBLICANDO.
export async function publicarRedesPendientes() {
  const vencidas = await prisma.publicacionRed.findMany({
    where: { estado: 'PROGRAMADA', programadaPara: { lte: new Date() } },
    orderBy: { programadaPara: 'asc' },
    take: 10,
    select: { id: true },
  })

  for (const { id } of vencidas) {
    const { count } = await prisma.publicacionRed.updateMany({
      where: { id, estado: 'PROGRAMADA' },
      data: { estado: 'PUBLICANDO' },
    })
    if (!count) continue

    const pub = await prisma.publicacionRed.findUnique({ where: { id }, include: { cuenta: true } })
    if (!pub) continue

    try {
      const externalId = await publicarEnRed(pub)
      await prisma.publicacionRed.update({
        where: { id },
        data: { estado: 'PUBLICADA', externalId, publicadaEn: new Date(), error: null },
      })
      console.log(`[redes] publicada ${pub.tipo} en ${pub.cuenta.nombre} (${externalId})`)
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error desconocido publicando'
      await prisma.publicacionRed.update({
        where: { id },
        data: { estado: 'ERROR', error: mensaje },
      })
      console.error(`[redes] ERROR publicando en ${pub.cuenta.nombre}: ${mensaje}`)
    }
  }
}
