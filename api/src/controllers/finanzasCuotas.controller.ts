import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'

// Cuánto puede pasar desde la última cuota confirmada antes de considerarla
// atrasada. Los planes son mensuales; se da una semana extra de margen sobre
// el ciclo de 30 días porque Hotmart no cobra siempre el mismo día exacto.
const DIAS_GRACIA = 37

// Panel de control de ventas a cuotas (Smart Installment de Hotmart): cuánto
// va pagado, cuánto falta y si el cliente se atrasó en la siguiente cuota.
export async function cuotas(_req: Request, res: Response) {
  const pagos = await prisma.pago.findMany({
    where: { enPartes: true, cuotasTotal: { gt: 1 } },
    select: {
      id: true, monto: true, cuotaNumero: true, cuotasTotal: true, fechaPago: true, metodo: true,
      estudiante: {
        select: {
          id: true, nombre: true, telefono: true, email: true,
          asesor: { select: { nombre: true } },
          cursos: {
            select: { cursoId: true, precioAcordado: true, fechaCompra: true, curso: { select: { nombre: true, precio: true } } },
          },
        },
      },
    },
    orderBy: { fechaPago: 'asc' },
  })

  const hoy = Date.now()
  const filas = pagos.map(p => {
    // Un pago no dice a qué curso pertenece — se toma el más cercano en
    // fecha, mismo criterio que backfillCuotas.ts.
    const cursos = p.estudiante.cursos
    const t = p.fechaPago?.getTime() ?? 0
    const ce = cursos.reduce<typeof cursos[number] | null>((mejor, c) => {
      if (!c.fechaCompra) return mejor
      if (!mejor?.fechaCompra) return c
      return Math.abs(c.fechaCompra.getTime() - t) < Math.abs(mejor.fechaCompra.getTime() - t) ? c : mejor
    }, null)

    const cuotaNumero  = p.cuotaNumero ?? 1
    const cuotasTotal  = p.cuotasTotal ?? 1
    const totalCurso   = ce?.precioAcordado ?? ce?.curso.precio ?? Math.round(p.monto * cuotasTotal)
    const totalPagado  = p.monto * cuotaNumero
    const saldo        = Math.max(0, Math.round(totalCurso - totalPagado))
    const completado   = cuotaNumero >= cuotasTotal || saldo <= 1000
    const diasSinPagar = p.fechaPago ? Math.floor((hoy - p.fechaPago.getTime()) / 86_400_000) : null
    const atrasado     = !completado && diasSinPagar != null && diasSinPagar > DIAS_GRACIA

    return {
      estudianteId: p.estudiante.id,
      nombre: p.estudiante.nombre,
      telefono: p.estudiante.telefono,
      email: p.estudiante.email,
      asesor: p.estudiante.asesor?.nombre ?? null,
      curso: ce?.curso.nombre ?? 'Sin curso',
      cuotaNumero,
      cuotasTotal,
      montoCuota: p.monto,
      totalCurso,
      totalPagado,
      saldo,
      metodo: p.metodo,
      fechaUltimaCuota: p.fechaPago,
      diasSinPagar,
      estado: completado ? 'completado' : atrasado ? 'atrasado' : 'al-dia',
    }
  })

  filas.sort((a, b) => (b.diasSinPagar ?? -1) - (a.diasSinPagar ?? -1))

  return ApiResponse.success(res, {
    resumen: {
      total: filas.length,
      atrasados: filas.filter(f => f.estado === 'atrasado').length,
      alDia: filas.filter(f => f.estado === 'al-dia').length,
      completados: filas.filter(f => f.estado === 'completado').length,
      saldoTotal: filas.reduce((s, f) => s + f.saldo, 0),
    },
    filas,
  })
}
