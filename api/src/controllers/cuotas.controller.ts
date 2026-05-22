import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { auditLog } from '../utils/auditLogger'
import { broadcast } from '../utils/sseManager'
import { z } from 'zod'

const actualizarSchema = z.object({
  pagado:          z.boolean().optional(),
  fechaPago:       z.string().optional(),
  comprobante:     z.string().optional(),
  medioPago:       z.string().optional(),
  notas:           z.string().optional(),
  // Campos editables aunque no esté pagada
  monto:           z.number().positive().optional(),
  fechaVencimiento:z.string().optional(),
})

export async function actualizar(req: Request, res: Response) {
  const { id } = req.params
  const data = actualizarSchema.parse(req.body)

  // Obtener cuota actual para historial
  const cuotaActual = await prisma.cuota.findUnique({
    where: { id },
    include: { financiamiento: { select: { estudianteId: true } } },
  })

  const revertiendo = data.pagado === false

  const cuota = await prisma.cuota.update({
    where: { id },
    data: {
      ...(data.pagado !== undefined && { pagado: data.pagado }),
      // Revertir: limpiar todos los campos del pago
      ...(revertiendo && { fechaPago: null, medioPago: null, comprobante: null }),
      // Marcar pagado sin fecha explícita → usar hoy
      ...(data.pagado === true && !data.fechaPago && { fechaPago: new Date() }),
      ...(data.fechaPago !== undefined && !revertiendo && { fechaPago: new Date(data.fechaPago) }),
      ...(!revertiendo && data.comprobante !== undefined && { comprobante: data.comprobante }),
      ...(!revertiendo && data.medioPago   !== undefined && { medioPago:   data.medioPago }),
      ...(data.notas       !== undefined && { notas:       data.notas }),
      ...(data.monto       !== undefined && { monto:       data.monto }),
      ...(data.fechaVencimiento !== undefined && { fechaVencimiento: new Date(data.fechaVencimiento) }),
    },
  })

  // Si se marcó como pagada → verificar si el financiamiento queda COMPLETADO
  if (data.pagado === true && cuotaActual) {
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

  // Si se revirtió → el financiamiento vuelve a ACTIVO
  if (revertiendo) {
    await prisma.financiamiento.update({
      where: { id: cuota.financiamientoId },
      data: { estado: 'ACTIVO' },
    })
  }

  // Registrar en historial si hay estudianteId disponible
  if (cuotaActual?.financiamiento?.estudianteId) {
    const estudianteId = cuotaActual.financiamiento.estudianteId
    let descripcion = ''
    let accion = 'UPDATE_CUOTA'

    if (data.pagado === true) {
      accion = 'ABONO'
      descripcion = `Cuota #${cuota.numero} marcada como pagada — ${data.medioPago ?? 'Sin medio de pago'} — $${cuota.monto.toLocaleString('es-CO')}`
    } else if (data.monto !== undefined || data.fechaVencimiento !== undefined || data.medioPago !== undefined || data.comprobante !== undefined || data.fechaPago !== undefined) {
      accion = 'EDITAR_CUOTA'
      descripcion = `Cuota #${cuota.numero} editada`
      if (data.monto !== undefined) descripcion += ` · monto $${data.monto.toLocaleString('es-CO')}`
      if (data.fechaVencimiento !== undefined) descripcion += ` · vencimiento ${new Date(data.fechaVencimiento).toLocaleDateString('es-CO')}`
      if (data.medioPago !== undefined) descripcion += ` · medio ${data.medioPago}`
      if (data.comprobante !== undefined) descripcion += ` · comprobante actualizado`
    } else if (data.pagado === false) {
      accion = 'REVERTIR_CUOTA'
      descripcion = `Cuota #${cuota.numero} revertida a pendiente`
    }

    if (descripcion) {
      await prisma.historialEstudiante.create({
        data: {
          estudianteId,
          accion,
          descripcion,
          cambios: data as any,
          realizadoPor: (req as any).userName ?? req.userId ?? 'Sistema',
          userId: req.userId ?? 'sistema',
        },
      })
    }
  }

  auditLog(req, 'UPDATE', 'cuota', id, { pagado: data.pagado, medioPago: data.medioPago })
  // Notificar en tiempo real cuando cambia el estado de pago de una cuota
  if (data.pagado !== undefined && cuotaActual?.financiamiento?.estudianteId) {
    broadcast('pago-registrado', { cuotaId: id, estudianteId: cuotaActual.financiamiento.estudianteId })
  }
  return ApiResponse.success(res, cuota)
}
