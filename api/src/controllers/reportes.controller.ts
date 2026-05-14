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

export async function rankingAsesores(_req: Request, res: Response) {
  const hoy = new Date()

  const inicioMesActual   = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const finMesActual      = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59)
  const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  const finMesAnterior    = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59)

  // Traer asesores + pagos de ambos meses en 3 queries paralelas
  const [asesores, pagosActual, pagosAnterior] = await Promise.all([
    prisma.asesor.findMany({
      where: { user: { role: 'VENDEDOR' } },
      include: { _count: { select: { estudiantes: true } } },
    }),
    prisma.pago.findMany({
      where: { estado: 'PAGADO', fechaPago: { gte: inicioMesActual, lte: finMesActual } },
      select: { asesorId: true, monto: true },
    }),
    prisma.pago.findMany({
      where: { estado: 'PAGADO', fechaPago: { gte: inicioMesAnterior, lte: finMesAnterior } },
      select: { asesorId: true, monto: true },
    }),
  ])

  // Agrupar por asesor
  const sumar = (pagos: { asesorId: string | null; monto: number }[], id: string) =>
    pagos.filter(p => p.asesorId === id).reduce((s, p) => s + p.monto, 0)

  const ranking = asesores
    .map(a => {
      const ventasActual   = sumar(pagosActual,   a.id)
      const ventasAnterior = sumar(pagosAnterior, a.id)
      const variacion      = ventasAnterior > 0 ? Math.round(((ventasActual - ventasAnterior) / ventasAnterior) * 100) : 0
      return {
        id: a.id,
        nombre: a.nombre,
        totalVentas: ventasActual,
        cobrado: ventasActual,
        cantidadPagos: pagosActual.filter(p => p.asesorId === a.id).length,
        totalEstudiantes: a._count.estudiantes,
        variacion,
        ventasAnterior,
      }
    })
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

// Datos agregados para la gráfica de ventas por período
export async function ventasGrafica(req: Request, res: Response) {
  const periodo = String(req.query.periodo ?? 'mensual')
  const hoy = new Date()
  let puntos: { label: string; desde: Date; hasta: Date }[] = []

  if (periodo === 'diario') {
    // Últimos 14 días
    for (let i = 13; i >= 0; i--) {
      const d = new Date(hoy)
      d.setDate(hoy.getDate() - i)
      const desde = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
      const hasta  = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
      const label  = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
      puntos.push({ label, desde, hasta })
    }
  } else if (periodo === 'semanal') {
    // Últimas 8 semanas
    for (let i = 7; i >= 0; i--) {
      const inicioSem = new Date(hoy)
      inicioSem.setDate(hoy.getDate() - i * 7 - hoy.getDay() + 1)
      inicioSem.setHours(0, 0, 0, 0)
      const finSem = new Date(inicioSem)
      finSem.setDate(inicioSem.getDate() + 6)
      finSem.setHours(23, 59, 59, 999)
      const label = `${inicioSem.getDate()}/${inicioSem.getMonth() + 1}`
      puntos.push({ label, desde: inicioSem, hasta: finSem })
    }
  } else {
    // Últimos 6 meses
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
      const desde = new Date(d.getFullYear(), d.getMonth(), 1)
      const hasta  = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      const label  = d.toLocaleDateString('es-CO', { month: 'short' })
      puntos.push({ label, desde, hasta })
    }
  }

  const resultados = await Promise.all(
    puntos.map(async ({ label, desde, hasta }) => {
      const agg = await prisma.pago.aggregate({
        where: { estado: 'PAGADO', fechaPago: { gte: desde, lte: hasta } },
        _sum: { monto: true },
        _count: true,
      })
      return { label, ingresos: agg._sum.monto ?? 0, pagos: agg._count }
    })
  )

  // Variación vs período anterior
  const actual   = resultados[resultados.length - 1]?.ingresos ?? 0
  const anterior = resultados[resultados.length - 2]?.ingresos ?? 0
  const variacion = anterior > 0 ? Math.round(((actual - anterior) / anterior) * 100) : 0

  return ApiResponse.success(res, { puntos: resultados, variacion, actual, anterior })
}
