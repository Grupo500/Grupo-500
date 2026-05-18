import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { auditLog } from '../utils/auditLogger'
import { z } from 'zod'

const actualizarSchema = z.object({
  pagado:    z.boolean(),
  fechaPago: z.string().optional(),
})

export async function actualizar(req: Request, res: Response) {
  const { id } = req.params
  const { pagado, fechaPago } = actualizarSchema.parse(req.body)

  const cuota = await prisma.cuota.update({
    where: { id },
    data: {
      pagado,
      ...(pagado && { fechaPago: fechaPago ? new Date(fechaPago) : new Date() }),
    },
  })

  // Si todas las cuotas están pagadas, marcar el financiamiento como completado
  if (pagado) {
    const pendientes = await prisma.cuota.count({
      where: { financiamientoId: cuota.financiamientoId, pagado: false },
    })

    if (pendientes === 0) {
      await prisma.financiamiento.update({
        where: { id: cuota.financiamientoId },
        data: { estado: 'COMPLETADO' },
      })
    }
  }

  auditLog(req, 'UPDATE', 'cuota', id, { pagado })
  return ApiResponse.success(res, cuota)
}
