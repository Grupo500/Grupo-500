import { prisma } from '../config/prisma'
import { publicarEnRed } from '../services/metaGraph.service'

// Publica las programadas vencidas. Corre cada minuto vía setInterval (index.ts).
// updateMany con filtro de estado hace de candado: si dos ticks se solapan,
// solo uno logra pasar la fila a PUBLICANDO.
export async function publicarRedesPendientes() {
  let vencidas: { id: string }[] = []
  try {
    vencidas = await prisma.publicacionRed.findMany({
      where: { estado: 'PROGRAMADA', programadaPara: { lte: new Date() } },
      orderBy: { programadaPara: 'asc' },
      take: 10,
      select: { id: true },
    })
  } catch (err) {
    // típico: la migración redes_sociales aún no se aplicó en la BD — no tumbar el proceso
    console.error('[redes] no se pudo consultar publicaciones:', err instanceof Error ? err.message : err)
    return
  }

  for (const { id } of vencidas) {
    try {
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
    } catch (err) {
      // error de BD a mitad de ciclo: registrar y seguir con la siguiente
      console.error('[redes] error procesando publicación:', err instanceof Error ? err.message : err)
    }
  }
}
