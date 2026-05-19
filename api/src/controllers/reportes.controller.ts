import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'

export async function dashboard(req: Request, res: Response) {
  const hoy = new Date()
  const periodo = (req.query.periodo as string) ?? 'mensual'

  // Calcular inicio del período seleccionado
  const inicioMes    = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const inicioSemana = new Date(hoy); inicioSemana.setDate(hoy.getDate() - 7)
  const inicioDia    = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())

  const inicioPeriodo = periodo === 'diario' ? inicioDia
    : periodo === 'semanal' ? inicioSemana
    : inicioMes

  // Filtro de fecha para el período activo
  const filtroPeriodo = { gte: inicioPeriodo }

  const [
    totalEstudiantes,
    estudiantesNuevosMes,
    pagosPendientes,
    pagosVencidos,
    pagosCobrados,
    cuotasPendientes,
    cuotasVencidas,
    cuotasCobradas,
  ] = await Promise.all([
    prisma.estudiante.count(),
    prisma.estudiante.count({ where: { createdAt: { gte: inicioMes } } }),
    // Pagos únicos filtrados por período
    prisma.pago.aggregate({ where: { estado: 'PENDIENTE', createdAt: filtroPeriodo }, _sum: { monto: true }, _count: true }),
    prisma.pago.aggregate({ where: { estado: 'VENCIDO',   fechaVencimiento: filtroPeriodo }, _sum: { monto: true }, _count: true }),
    prisma.pago.aggregate({ where: { estado: 'PAGADO',    fechaPago: filtroPeriodo }, _sum: { monto: true }, _count: true }),
    // Cuotas filtradas por período
    prisma.cuota.aggregate({ where: { pagado: false, fechaVencimiento: { gte: hoy > inicioPeriodo ? hoy : inicioPeriodo } }, _sum: { monto: true }, _count: true }),
    prisma.cuota.aggregate({ where: { pagado: false, fechaVencimiento: { lt:  hoy, gte: inicioPeriodo } }, _sum: { monto: true }, _count: true }),
    prisma.cuota.aggregate({ where: { pagado: true,  fechaPago: filtroPeriodo }, _sum: { monto: true }, _count: true }),
  ])

  // Totales unificados (pagos únicos + cuotas)
  const porCobrarMonto    = (pagosPendientes._sum.monto ?? 0) + (cuotasPendientes._sum.monto ?? 0)
  const porCobrarCantidad = pagosPendientes._count            + cuotasPendientes._count
  const vencidoMonto      = (pagosVencidos._sum.monto ?? 0)  + (cuotasVencidas._sum.monto ?? 0)
  const vencidoCantidad   = pagosVencidos._count              + cuotasVencidas._count
  const cobradoMonto      = (pagosCobrados._sum.monto ?? 0)  + (cuotasCobradas._sum.monto ?? 0)
  const cobradoCantidad   = pagosCobrados._count              + cuotasCobradas._count

  return ApiResponse.success(res, {
    estudiantes: { total: totalEstudiantes, nuevosMes: estudiantesNuevosMes },
    cobranza: {
      porCobrar: { monto: porCobrarMonto,  cantidad: porCobrarCantidad },
      vencida:   { monto: vencidoMonto,    cantidad: vencidoCantidad   },
      cobrado:   { monto: cobradoMonto,    cantidad: cobradoCantidad   },
      pendiente: { monto: porCobrarMonto,  cantidad: porCobrarCantidad },
    },
    periodo,
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

export async function cursosMasVendidos(req: Request, res: Response) {
  const hoy     = new Date()
  const periodo = String(req.query.periodo ?? 'mensual')

  const inicioMes    = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const inicioSemana = new Date(hoy); inicioSemana.setDate(hoy.getDate() - 7)
  const inicioDia    = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())

  const desde = periodo === 'diario' ? inicioDia
    : periodo === 'semanal' ? inicioSemana
    : inicioMes

  // Contar estudiantes cuya fechaCompra esté dentro del período
  const cursos = await prisma.curso.findMany({
    where: { activo: true },
    include: {
      _count: {
        select: {
          estudiantes: { where: { fechaCompra: { gte: desde } } },
        },
      },
    },
    orderBy: { nombre: 'asc' },
  })

  // Ordenar por más vendidos en el período
  const ordenados = [...cursos].sort((a, b) => b._count.estudiantes - a._count.estudiantes)
  return ApiResponse.success(res, ordenados)
}

// Financiero por período: totales del período activo + serie temporal
export async function financieroPeriodo(req: Request, res: Response) {
  const periodo = String(req.query.periodo ?? 'mensual')
  const hoy = new Date()

  // ── Rango para totales (período actual y anterior) ──────────────────────
  let desdeTotales: Date
  let desdeAnterior: Date
  let hastaAnterior: Date

  if (periodo === 'diario') {
    desdeTotales  = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0)
    desdeAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1, 0, 0, 0)
    hastaAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1, 23, 59, 59)
  } else if (periodo === 'semanal') {
    const inicioEsta = new Date(hoy)
    inicioEsta.setDate(hoy.getDate() - hoy.getDay() + 1)
    inicioEsta.setHours(0, 0, 0, 0)
    desdeTotales  = inicioEsta
    desdeAnterior = new Date(inicioEsta); desdeAnterior.setDate(inicioEsta.getDate() - 7)
    hastaAnterior = new Date(inicioEsta); hastaAnterior.setDate(inicioEsta.getDate() - 1); hastaAnterior.setHours(23, 59, 59)
  } else {
    desdeTotales  = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    desdeAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    hastaAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59)
  }

  // ── Puntos para la serie temporal ───────────────────────────────────────
  type Punto = { label: string; desde: Date; hasta: Date }
  const puntos: Punto[] = []

  if (periodo === 'diario') {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(hoy)
      d.setDate(hoy.getDate() - i)
      puntos.push({
        label: d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
        desde: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0),
        hasta: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59),
      })
    }
  } else if (periodo === 'semanal') {
    for (let i = 7; i >= 0; i--) {
      const ini = new Date(hoy)
      ini.setDate(hoy.getDate() - i * 7 - hoy.getDay() + 1)
      ini.setHours(0, 0, 0, 0)
      const fin = new Date(ini)
      fin.setDate(ini.getDate() + 6)
      fin.setHours(23, 59, 59, 999)
      puntos.push({ label: `${ini.getDate()}/${ini.getMonth() + 1}`, desde: ini, hasta: fin })
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
      puntos.push({
        label: d.toLocaleDateString('es-CO', { month: 'short' }),
        desde: new Date(d.getFullYear(), d.getMonth(), 1),
        hasta: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
      })
    }
  }

  // ── Queries en paralelo ─────────────────────────────────────────────────
  const hoyInicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())

  const [
    totalPagosAgg, recaudoPagosAgg, porCobrarPagosAgg, moraPagosAgg,
    totalCuotasAgg, recaudoCuotasAgg, porCobrarCuotasAgg, moraCuotasAgg,
    // Período anterior
    totalPagosAntAgg, recaudoPagosAntAgg, porCobrarPagosAntAgg, moraPagosAntAgg,
    totalCuotasAntAgg, recaudoCuotasAntAgg, porCobrarCuotasAntAgg, moraCuotasAntAgg,
    serie,
  ] = await Promise.all([
    // ── Período actual — Pagos únicos ──────────────────────────────────────
    prisma.pago.aggregate({ where: { createdAt: { gte: desdeTotales } }, _sum: { monto: true } }),
    prisma.pago.aggregate({ where: { estado: 'PAGADO',    fechaPago:        { gte: desdeTotales } }, _sum: { monto: true } }),
    prisma.pago.aggregate({ where: { estado: 'PENDIENTE', fechaVencimiento: { gte: hoyInicio }, createdAt: { gte: desdeTotales } }, _sum: { monto: true } }),
    prisma.pago.aggregate({ where: { estado: 'VENCIDO',   fechaVencimiento: { lt:  hoyInicio }, createdAt: { gte: desdeTotales } }, _sum: { monto: true } }),
    // ── Período actual — Cuotas ────────────────────────────────────────────
    prisma.cuota.aggregate({ where: { financiamiento: { createdAt: { gte: desdeTotales } } }, _sum: { monto: true } }),
    prisma.cuota.aggregate({ where: { pagado: true,  fechaPago:        { gte: desdeTotales } }, _sum: { monto: true } }),
    prisma.cuota.aggregate({ where: { pagado: false, fechaVencimiento: { gte: hoyInicio }, financiamiento: { createdAt: { gte: desdeTotales } } }, _sum: { monto: true } }),
    prisma.cuota.aggregate({ where: { pagado: false, fechaVencimiento: { lt:  hoyInicio }, financiamiento: { createdAt: { gte: desdeTotales } } }, _sum: { monto: true } }),
    // ── Período anterior — Pagos únicos ───────────────────────────────────
    prisma.pago.aggregate({ where: { createdAt: { gte: desdeAnterior, lte: hastaAnterior } }, _sum: { monto: true } }),
    prisma.pago.aggregate({ where: { estado: 'PAGADO',    fechaPago:        { gte: desdeAnterior, lte: hastaAnterior } }, _sum: { monto: true } }),
    prisma.pago.aggregate({ where: { estado: 'PENDIENTE', fechaVencimiento: { gte: desdeAnterior }, createdAt: { gte: desdeAnterior, lte: hastaAnterior } }, _sum: { monto: true } }),
    prisma.pago.aggregate({ where: { estado: 'VENCIDO',   fechaVencimiento: { lt:  desdeAnterior }, createdAt: { gte: desdeAnterior, lte: hastaAnterior } }, _sum: { monto: true } }),
    // ── Período anterior — Cuotas ─────────────────────────────────────────
    prisma.cuota.aggregate({ where: { financiamiento: { createdAt: { gte: desdeAnterior, lte: hastaAnterior } } }, _sum: { monto: true } }),
    prisma.cuota.aggregate({ where: { pagado: true,  fechaPago:        { gte: desdeAnterior, lte: hastaAnterior } }, _sum: { monto: true } }),
    prisma.cuota.aggregate({ where: { pagado: false, fechaVencimiento: { gte: desdeAnterior }, financiamiento: { createdAt: { gte: desdeAnterior, lte: hastaAnterior } } }, _sum: { monto: true } }),
    prisma.cuota.aggregate({ where: { pagado: false, fechaVencimiento: { lt:  desdeAnterior }, financiamiento: { createdAt: { gte: desdeAnterior, lte: hastaAnterior } } }, _sum: { monto: true } }),
    // ── Serie temporal ─────────────────────────────────────────────────────
    Promise.all(puntos.map(async ({ label, desde, hasta }) => {
      const hoyI = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
      const [t, r, pc, mo, tc, rc, pcc, moc] = await Promise.all([
        prisma.pago.aggregate({ where: { createdAt: { gte: desde, lte: hasta } }, _sum: { monto: true } }),
        prisma.pago.aggregate({ where: { estado: 'PAGADO',   fechaPago:        { gte: desde, lte: hasta } }, _sum: { monto: true } }),
        prisma.pago.aggregate({ where: { estado: 'PENDIENTE', fechaVencimiento: { gte: hoyI }, createdAt: { gte: desde, lte: hasta } }, _sum: { monto: true } }),
        prisma.pago.aggregate({ where: { estado: 'VENCIDO',   fechaVencimiento: { lt:  hoyI }, createdAt: { gte: desde, lte: hasta } }, _sum: { monto: true } }),
        prisma.cuota.aggregate({ where: { financiamiento: { createdAt: { gte: desde, lte: hasta } } }, _sum: { monto: true } }),
        prisma.cuota.aggregate({ where: { pagado: true,  fechaPago:        { gte: desde, lte: hasta } }, _sum: { monto: true } }),
        prisma.cuota.aggregate({ where: { pagado: false, fechaVencimiento: { gte: hoyI }, financiamiento: { createdAt: { gte: desde, lte: hasta } } }, _sum: { monto: true } }),
        prisma.cuota.aggregate({ where: { pagado: false, fechaVencimiento: { lt:  hoyI }, financiamiento: { createdAt: { gte: desde, lte: hasta } } }, _sum: { monto: true } }),
      ])
      return {
        label,
        ventaTotal: (t._sum.monto ?? 0) + (tc._sum.monto ?? 0),
        recaudo:    (r._sum.monto ?? 0) + (rc._sum.monto ?? 0),
        porCobrar:  (pc._sum.monto ?? 0) + (pcc._sum.monto ?? 0),
        mora:       (mo._sum.monto ?? 0) + (moc._sum.monto ?? 0),
      }
    })),
  ])

  const variacion = (actual: number, anterior: number) =>
    anterior > 0 ? Math.round(((actual - anterior) / anterior) * 100) : null

  const totalesActual = {
    ventaTotal: (totalPagosAgg._sum.monto ?? 0)     + (totalCuotasAgg._sum.monto ?? 0),
    recaudo:    (recaudoPagosAgg._sum.monto ?? 0)   + (recaudoCuotasAgg._sum.monto ?? 0),
    porCobrar:  (porCobrarPagosAgg._sum.monto ?? 0) + (porCobrarCuotasAgg._sum.monto ?? 0),
    mora:       (moraPagosAgg._sum.monto ?? 0)      + (moraCuotasAgg._sum.monto ?? 0),
  }

  const totalesAnterior = {
    ventaTotal: (totalPagosAntAgg._sum.monto ?? 0)     + (totalCuotasAntAgg._sum.monto ?? 0),
    recaudo:    (recaudoPagosAntAgg._sum.monto ?? 0)   + (recaudoCuotasAntAgg._sum.monto ?? 0),
    porCobrar:  (porCobrarPagosAntAgg._sum.monto ?? 0) + (porCobrarCuotasAntAgg._sum.monto ?? 0),
    mora:       (moraPagosAntAgg._sum.monto ?? 0)      + (moraCuotasAntAgg._sum.monto ?? 0),
  }

  return ApiResponse.success(res, {
    totales: totalesActual,
    variaciones: {
      ventaTotal: variacion(totalesActual.ventaTotal, totalesAnterior.ventaTotal),
      recaudo:    variacion(totalesActual.recaudo,    totalesAnterior.recaudo),
      porCobrar:  variacion(totalesActual.porCobrar,  totalesAnterior.porCobrar),
      mora:       variacion(totalesActual.mora,        totalesAnterior.mora),
    },
    puntos: serie,
  })
}

// Resumen financiero: venta total, recaudo y saldo (últimos 6 meses)
export async function financiero(_req: Request, res: Response) {
  const hoy = new Date()

  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - (5 - i), 1)
    return {
      label: d.toLocaleDateString('es-CO', { month: 'short' }),
      desde: new Date(d.getFullYear(), d.getMonth(), 1),
      hasta: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
    }
  })

  const resultados = await Promise.all(
    meses.map(async ({ label, desde, hasta }) => {
      const [total, recaudo, pendiente, vencido] = await Promise.all([
        prisma.pago.aggregate({
          where: { createdAt: { gte: desde, lte: hasta } },
          _sum: { monto: true },
        }),
        prisma.pago.aggregate({
          where: { estado: 'PAGADO', fechaPago: { gte: desde, lte: hasta } },
          _sum: { monto: true },
        }),
        prisma.pago.aggregate({
          where: { estado: 'PENDIENTE', createdAt: { gte: desde, lte: hasta } },
          _sum: { monto: true },
        }),
        prisma.pago.aggregate({
          where: { estado: 'VENCIDO', createdAt: { gte: desde, lte: hasta } },
          _sum: { monto: true },
        }),
      ])
      return {
        label,
        ventaTotal: total._sum.monto ?? 0,
        recaudo:    recaudo._sum.monto ?? 0,
        saldo:      (pendiente._sum.monto ?? 0) + (vencido._sum.monto ?? 0),
      }
    })
  )

  return ApiResponse.success(res, resultados)
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
