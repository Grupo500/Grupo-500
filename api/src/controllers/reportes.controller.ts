import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'

export async function dashboard(_req: Request, res: Response) {
  const hoy = new Date()
  const inicioSemana = new Date(hoy)
  inicioSemana.setDate(hoy.getDate() - 7)
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const inicioDia = new Date(hoy.toDateString())

  const [
    totalEstudiantes,
    estudiantesNuevosMes,
    pagosHoy,
    pagosSemana,
    pagosMes,
    cuotasPendientes,
    cuotasVencidas,
  ] = await Promise.all([
    prisma.estudiante.count(),
    prisma.estudiante.count({ where: { createdAt: { gte: inicioMes } } }),
    prisma.pago.aggregate({
      where: { estado: 'PAGADO', fechaPago: { gte: inicioDia } },
      _sum: { monto: true },
    }),
    prisma.pago.aggregate({
      where: { estado: 'PAGADO', fechaPago: { gte: inicioSemana } },
      _sum: { monto: true },
    }),
    prisma.pago.aggregate({
      where: { estado: 'PAGADO', fechaPago: { gte: inicioMes } },
      _sum: { monto: true },
    }),
    prisma.cuota.aggregate({
      where: { pagado: false, fechaVencimiento: { gte: hoy } },
      _sum: { monto: true },
      _count: true,
    }),
    prisma.cuota.aggregate({
      where: { pagado: false, fechaVencimiento: { lt: hoy } },
      _sum: { monto: true },
      _count: true,
    }),
  ])

  return ApiResponse.success(res, {
    estudiantes: { total: totalEstudiantes, nuevosMes: estudiantesNuevosMes },
    ingresos: {
      hoy: pagosHoy._sum.monto ?? 0,
      semana: pagosSemana._sum.monto ?? 0,
      mes: pagosMes._sum.monto ?? 0,
    },
    cobranza: {
      pendiente: { monto: cuotasPendientes._sum.monto ?? 0, cantidad: cuotasPendientes._count },
      vencida: { monto: cuotasVencidas._sum.monto ?? 0, cantidad: cuotasVencidas._count },
    },
  })
}

export async function ingresos(req: Request, res: Response) {
  const { desde, hasta, asesorId } = req.query

  const pagos = await prisma.pago.findMany({
    where: {
      estado: 'PAGADO',
      ...(desde && hasta && {
        fechaPago: { gte: new Date(String(desde)), lte: new Date(String(hasta)) },
      }),
      ...(asesorId && { asesorId: String(asesorId) }),
    },
    include: { estudiante: true, asesor: true },
    orderBy: { fechaPago: 'desc' },
  })

  const total = pagos.reduce((sum, p) => sum + p.monto, 0)
  return ApiResponse.success(res, { pagos, total })
}

export async function rankingAsesores(req: Request, res: Response) {
  const { desde, hasta } = req.query

  const asesores = await prisma.asesor.findMany({
    include: {
      pagos: {
        where: {
          estado: 'PAGADO',
          ...(desde && hasta && {
            fechaPago: { gte: new Date(String(desde)), lte: new Date(String(hasta)) },
          }),
        },
      },
      _count: { select: { estudiantes: true } },
    },
  })

  const ranking = asesores
    .map(a => ({
      id: a.id,
      nombre: a.nombre,
      totalVentas: a.pagos.reduce((sum, p) => sum + p.monto, 0),
      cantidadPagos: a.pagos.length,
      totalEstudiantes: a._count.estudiantes,
    }))
    .sort((a, b) => b.totalVentas - a.totalVentas)

  return ApiResponse.success(res, ranking)
}

export async function cursosMasVendidos(_req: Request, res: Response) {
  const cursos = await prisma.curso.findMany({
    include: { _count: { select: { estudiantes: true } } },
    orderBy: { estudiantes: { _count: 'desc' } },
  })
  return ApiResponse.success(res, cursos)
}
