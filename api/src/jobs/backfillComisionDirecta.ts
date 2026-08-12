// Completa el desglose (comisión del asesor 3%, neto) de los pagos directos
// —los que no vienen de Hotmart— que se registraron antes de que el desglose
// se calculara al crearlos. Sin esto, esos pagos suman en "vendido" pero no
// generan comisión al asesor ni cuentan en "Neto recibido".
//
// Usa el MISMO helper que el registro de pagos (desgloseDirecto), para que no
// existan dos tarifas distintas.
//
// Ejecución: `npx tsx src/jobs/backfillComisionDirecta.ts [--aplicar]`
// (sin --aplicar solo simula y lista lo que cambiaría).

import { prisma } from '../config/prisma'
import { logger } from '../utils/logger'
import { desgloseDirecto, tasaDirectaDe } from '../utils/pagos'

export async function backfillComisionDirecta(aplicar = false): Promise<void> {
  // Solo pagos directos (sin referencia de Hotmart) ya cobrados y sin
  // desglose. Los de Hotmart los completa backfillComisiones con datos
  // reales de la API; aquí no se tocan.
  const pagos = await prisma.pago.findMany({
    where: { estado: 'PAGADO', referenciaPago: null, montoNeto: null },
    select: {
      id: true, monto: true, asesorId: true, fechaPago: true,
      asesor: { select: { nombre: true } },
      estudiante: { select: { nombre: true } },
    },
    orderBy: { fechaPago: 'asc' },
  })

  if (pagos.length === 0) {
    logger.info('[ComisionDirecta] Nada por completar — todo al día')
    return
  }

  for (const p of pagos) {
    const d = desgloseDirecto(p.monto, await tasaDirectaDe(p.asesorId))
    logger.info(
      `[ComisionDirecta] ${p.estudiante.nombre.trim()} — $${p.monto.toLocaleString('es-CO')} ` +
      `(${p.fechaPago?.toISOString().slice(0, 10) ?? 'sin fecha'}) → ` +
      `comisión $${d.comisionAsesor.toLocaleString('es-CO')} para ${p.asesor?.nombre ?? 'nadie (sin asesor)'}`
    )
    if (aplicar) {
      await prisma.pago.update({ where: { id: p.id }, data: d })
    }
  }

  logger.info(
    `[ComisionDirecta] ${pagos.length} pago(s) directos` +
    (aplicar ? ' — desglose aplicado' : ' — simulación, no se escribió nada')
  )
}

if (require.main === module) {
  backfillComisionDirecta(process.argv.includes('--aplicar'))
    .catch(e => { logger.error(`[ComisionDirecta] ${e?.message}`); process.exitCode = 1 })
    .finally(() => prisma.$disconnect())
}
