// Marca como cuota los abonos que se registraron a mano y que en realidad
// saldaban una cuota de un plan de Hotmart (Smart Installment).
//
// Desde que `pagos.controller.ts` marca el pago al crearlo, esto solo hace
// falta para los que quedaron sueltos antes. Se deja como job ejecutable
// (`npx tsx src/jobs/backfillCuotasManuales.ts`) porque un pago también puede
// entrar sin marcar si se creó por fuera del flujo normal.
//
// Usa la MISMA función que el registro de pagos, para que no existan dos
// criterios distintos de "esto es una cuota".

import { prisma } from '../config/prisma'
import { logger } from '../utils/logger'
import { cuotaQueSalda, type FilaPlan } from '../utils/pagos'

export async function backfillCuotasManuales(aplicar = false): Promise<void> {
  // Solo estudiantes que tienen al menos un plan a cuotas: sin plan no hay
  // nada que saldar.
  const conPlan = await prisma.pago.findMany({
    where: { enPartes: true, cuotasTotal: { gt: 1 }, estado: 'PAGADO' },
    select: { estudianteId: true },
    distinct: ['estudianteId'],
  })
  if (conPlan.length === 0) {
    logger.info('[CuotasManuales] No hay planes a cuotas — nada que revisar')
    return
  }

  const pagos = await prisma.pago.findMany({
    where: { estudianteId: { in: conPlan.map(p => p.estudianteId) }, estado: 'PAGADO' },
    select: {
      id: true, estudianteId: true, monto: true, enPartes: true,
      cuotaNumero: true, cuotasTotal: true, fechaPago: true,
      estudiante: { select: { nombre: true } },
    },
    orderBy: { fechaPago: 'asc' },
  })

  const porEstudiante = new Map<string, typeof pagos>()
  for (const p of pagos) {
    const lista = porEstudiante.get(p.estudianteId)
    if (lista) lista.push(p)
    else porEstudiante.set(p.estudianteId, [p])
  }

  let detectados = 0
  for (const [, filas] of porEstudiante) {
    // Los sueltos se evalúan del más viejo al más nuevo y se van sumando al
    // plan: si alguien pagó dos cuotas a mano en meses distintos, la segunda
    // tiene que ver la primera ya marcada para calcular bien su número.
    const plan: FilaPlan[] = filas.filter(f => f.enPartes && (f.cuotasTotal ?? 0) > 1)
    const sueltos = filas.filter(f => !f.enPartes || (f.cuotasTotal ?? 0) <= 1)

    for (const s of sueltos) {
      if (!s.fechaPago) continue
      const cuota = cuotaQueSalda(plan, { monto: s.monto, fecha: s.fechaPago })
      if (!cuota) continue

      detectados++
      logger.info(
        `[CuotasManuales] ${s.estudiante.nombre.trim()} — abono de ${s.monto} ` +
        `→ cuota ${cuota.cuotaNumero} de ${cuota.cuotasTotal}`
      )

      if (aplicar) {
        await prisma.pago.update({
          where: { id: s.id },
          data: { enPartes: true, cuotaNumero: cuota.cuotaNumero, cuotasTotal: cuota.cuotasTotal },
        })
      }

      // Queda dentro del plan para la siguiente vuelta del mismo estudiante.
      plan.push({
        monto: s.monto, enPartes: true,
        cuotaNumero: cuota.cuotaNumero, cuotasTotal: cuota.cuotasTotal,
        fechaPago: s.fechaPago,
      })
    }
  }

  logger.info(
    `[CuotasManuales] ${detectados} abono(s) corresponden a una cuota` +
    (aplicar ? ' — actualizados' : ' — simulación, no se escribió nada')
  )
}

// Ejecución directa: `npx tsx src/jobs/backfillCuotasManuales.ts [--aplicar]`
if (require.main === module) {
  backfillCuotasManuales(process.argv.includes('--aplicar'))
    .catch(e => { logger.error(`[CuotasManuales] ${e?.message}`); process.exitCode = 1 })
    .finally(() => prisma.$disconnect())
}
