import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'

export async function actualizar(req: Request, res: Response) {
  const { id } = req.params
  const { pagado, fechaPago } = req.body

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

  return ApiResponse.success(res, cuota)
}
