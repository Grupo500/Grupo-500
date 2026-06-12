import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'

export async function dashboard(req: Request, res: Response) {
  const hoy = new Date()
  const periodo = (req.query.periodo as string) ?? 'mensual'

  // Si el usuario es VENDEDOR, filtrar todo por su asesorId
  const filtroAsesor = req.userRole === 'VENDEDOR' && req.asesorId
    ? req.asesorId : undefined

  // Calcular inicio del período seleccionado
  const inicioMes    = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const inicioSemana = new Date(hoy); inicioSemana.setDate(hoy.getDate() - 7)
  const inicioDia    = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())

  const inicioPeriodo = periodo === 'diario' ? inicioDia
    : periodo === 'semanal' ? inicioSemana
    : inicioMes

  const filtroPeriodo = { gte: inicioPeriodo }

  // Filtro de estudiante para pagos/cuotas vía relación
  const filtroEstPago    = filtroAsesor ? { estudiante: { asesorId: filtroAsesor } } : {}
  const filtroEstCuota   = filtroAsesor
    ? { financiamiento: { estudiante: { asesorId: filtroAsesor } } } : {}

  const [
    totalEstudiantes,
    estudiantesNuevosMes,
    pagosPendientes,
    pagosVencidos,
    pagosCobrados,
    cuotasPendientes,
    cuotasVencidas,
    cuotasCobradas,
    cursosActivos,
  ] = await Promise.all([
    prisma.estudiante.count({ where: filtroAsesor ? { asesorId: filtroAsesor } : {} }),
    prisma.estudiante.count({ where: { createdAt: { gte: inicioMes }, ...(filtroAsesor && { asesorId: filtroAsesor }) } }),
    prisma.pago.aggregate({ where: { estado: 'PENDIENTE', fechaVencimiento: { gte: hoy }, ...filtroEstPago }, _sum: { monto: true }, _count: true }),
    // Mora = estado VENCIDO OR estado PENDIENTE con fechaVencimiento ya pasada
    prisma.pago.aggregate({ where: { estado: { in: ['VENCIDO', 'PENDIENTE'] }, fechaVencimiento: { lt: hoy }, ...filtroEstPago }, _sum: { monto: true }, _count: true }),
    prisma.pago.aggregate({ where: { estado: 'PAGADO',    fechaPago: filtroPeriodo, ...filtroEstPago }, _sum: { monto: true }, _count: true }),
    prisma.cuota.aggregate({ where: { pagado: false, fechaVencimiento: { gte: hoy > inicioPeriodo ? hoy : inicioPeriodo }, ...filtroEstCuota }, _sum: { monto: true }, _count: true }),
    prisma.cuota.aggregate({ where: { pagado: false, fechaVencimiento: { lt: hoy, gte: inicioPeriodo }, ...filtroEstCuota }, _sum: { monto: true }, _count: true }),
    prisma.cuota.aggregate({ where: { pagado: true,  fechaPago: filtroPeriodo, ...filtroEstCuota }, _sum: { monto: true }, _count: true }),
    prisma.curso.count({ where: { activo: true } }),
  ])

  // Cobrado del mes por el asesor (para la tarjeta de ventas)
  const cobradoMesAsesor = filtroAsesor
    ? (await prisma.pago.aggregate({
        where: { estado: 'PAGADO', fechaPago: { gte: inicioMes }, asesorId: filtroAsesor },
        _sum: { monto: true },
      }))._sum.monto ?? 0
    : 0

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
    cursosActivos,
    cobradoMes: cobradoMesAsesor,
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
  const hoy = new Date()
  const { desde: desdeQ, hasta: hastaQ, periodo } = req.query

  let desdeDate: Date
  let hastaDate: Date

  if (desdeQ && hastaQ) {
    desdeDate = new Date(String(desdeQ) + 'T00:00:00')
    hastaDate = new Date(String(hastaQ) + 'T23:59:59')
  } else {
    const p = String(periodo ?? 'mensual')
    const inicioMes    = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const inicioSemana = new Date(hoy); inicioSemana.setDate(hoy.getDate() - 7)
    const inicioDia    = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
    desdeDate = p === 'diario' ? inicioDia : p === 'semanal' ? inicioSemana : inicioMes
    hastaDate = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59)
  }

  const cursos = await prisma.curso.findMany({
    where: { activo: true },
    include: {
      _count: {
        select: {
          estudiantes: { where: { fechaCompra: { gte: desdeDate, lte: hastaDate } } },
        },
      },
    },
    orderBy: { nombre: 'asc' },
  })

  const ordenados = [...cursos].sort((a, b) => b._count.estudiantes - a._count.estudiantes)
  return ApiResponse.success(res, ordenados)
}

// Financiero por período: totales del período activo + serie temporal
export async function financieroPeriodo(req: Request, res: Response) {
  const hoy = new Date()
  const { desde: desdeQ, hasta: hastaQ, periodo } = req.query

  // ── Rango para totales (período actual y anterior) ──────────────────────
  let desdeTotales: Date
  let hastaTotales: Date
  let desdeAnterior: Date
  let hastaAnterior: Date

  if (desdeQ && hastaQ) {
    desdeTotales = new Date(String(desdeQ) + 'T00:00:00')
    hastaTotales = new Date(String(hastaQ) + 'T23:59:59')

    // Si el período aún está en curso (hasta > hoy), comparar solo los días
    // transcurridos: junio 1–12 vs mayo 1–12, no junio 1–30 vs mayo 1–31
    const hoyFin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59)
    const efectivoHasta = hastaTotales > hoyFin ? hoyFin : hastaTotales

    // Usar efectivoHasta para queries actuales (no contar días futuros sin datos)
    hastaTotales = efectivoHasta

    const diasTranscurridos = Math.round((efectivoHasta.getTime() - desdeTotales.getTime()) / 86400000)
    const duracionTotal     = Math.round((new Date(String(hastaQ) + 'T23:59:59').getTime() - desdeTotales.getTime()) / 86400000) + 1

    desdeAnterior = new Date(desdeTotales)
    desdeAnterior.setDate(desdeTotales.getDate() - duracionTotal)
    hastaAnterior = new Date(desdeAnterior)
    hastaAnterior.setDate(desdeAnterior.getDate() + diasTranscurridos)
    hastaAnterior.setHours(23, 59, 59)
  } else {
    const p = String(periodo ?? 'mensual')
    if (p === 'diario') {
      desdeTotales  = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0)
      hastaTotales  = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59)
      desdeAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1, 0, 0, 0)
      hastaAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1, 23, 59, 59)
    } else if (p === 'semanal') {
      const inicioEsta = new Date(hoy)
      inicioEsta.setDate(hoy.getDate() - hoy.getDay() + 1)
      inicioEsta.setHours(0, 0, 0, 0)
      desdeTotales  = inicioEsta
      hastaTotales  = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59)
      desdeAnterior = new Date(inicioEsta); desdeAnterior.setDate(inicioEsta.getDate() - 7)
      hastaAnterior = new Date(inicioEsta); hastaAnterior.setDate(inicioEsta.getDate() - 1); hastaAnterior.setHours(23, 59, 59)
    } else {
      desdeTotales  = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      hastaTotales  = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59)
      desdeAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
      hastaAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59)
    }
  }

  // ── Puntos para la serie temporal ───────────────────────────────────────
  type Punto = { label: string; desde: Date; hasta: Date }
  const puntos: Punto[] = []

  const diasRango = Math.round((hastaTotales.getTime() - desdeTotales.getTime()) / 86400000) + 1

  if (desdeQ && hastaQ) {
    if (diasRango <= 14) {
      // Rango corto: punto por día
      for (let i = 0; i < diasRango; i++) {
        const d = new Date(desdeTotales)
        d.setDate(desdeTotales.getDate() + i)
        puntos.push({
          label: d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
          desde: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0),
          hasta: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59),
        })
      }
    } else if (diasRango <= 60) {
      // Rango mediano: punto por semana
      let cursor = new Date(desdeTotales)
      while (cursor <= hastaTotales) {
        const finSem = new Date(cursor)
        finSem.setDate(cursor.getDate() + 6)
        if (finSem > hastaTotales) finSem.setTime(hastaTotales.getTime())
        finSem.setHours(23, 59, 59)
        puntos.push({ label: `${cursor.getDate()}/${cursor.getMonth() + 1}`, desde: new Date(cursor), hasta: new Date(finSem) })
        cursor.setDate(cursor.getDate() + 7)
      }
    } else {
      // Rango largo: punto por mes
      let cursor = new Date(desdeTotales.getFullYear(), desdeTotales.getMonth(), 1)
      while (cursor <= hastaTotales) {
        const finMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59)
        const hasta  = finMes > hastaTotales ? hastaTotales : finMes
        puntos.push({
          label: cursor.toLocaleDateString('es-CO', { month: 'short' }),
          desde: new Date(cursor),
          hasta: new Date(hasta),
        })
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
      }
    }
  } else {
    const p = String(periodo ?? 'mensual')
    if (p === 'diario') {
      for (let i = 13; i >= 0; i--) {
        const d = new Date(hoy)
        d.setDate(hoy.getDate() - i)
        puntos.push({
          label: d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
          desde: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0),
          hasta: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59),
        })
      }
    } else if (p === 'semanal') {
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
    prisma.pago.aggregate({ where: { estado: 'PAGADO',    fechaPago:        { gte: desdeTotales, lte: hastaTotales } }, _sum: { monto: true } }),
    prisma.pago.aggregate({ where: { estado: 'PAGADO',    fechaPago:        { gte: desdeTotales, lte: hastaTotales } }, _sum: { monto: true } }),
    prisma.pago.aggregate({ where: { estado: 'PENDIENTE', fechaVencimiento: { gte: hoyInicio,    lte: hastaTotales } }, _sum: { monto: true } }),
    prisma.pago.aggregate({ where: { estado: 'VENCIDO',   fechaVencimiento: { lt:  hoyInicio,    gte: desdeTotales } }, _sum: { monto: true } }),
    // ── Período actual — Cuotas ────────────────────────────────────────────
    prisma.cuota.aggregate({ where: { pagado: true,  fechaPago:        { gte: desdeTotales, lte: hastaTotales } }, _sum: { monto: true } }),
    prisma.cuota.aggregate({ where: { pagado: true,  fechaPago:        { gte: desdeTotales, lte: hastaTotales } }, _sum: { monto: true } }),
    prisma.cuota.aggregate({ where: { pagado: false, fechaVencimiento: { gte: hoyInicio,    lte: hastaTotales } }, _sum: { monto: true } }),
    prisma.cuota.aggregate({ where: { pagado: false, fechaVencimiento: { lt:  hoyInicio,    gte: desdeTotales } }, _sum: { monto: true } }),
    // ── Período anterior — Pagos únicos ───────────────────────────────────
    prisma.pago.aggregate({ where: { estado: 'PAGADO',    fechaPago:        { gte: desdeAnterior, lte: hastaAnterior } }, _sum: { monto: true } }),
    prisma.pago.aggregate({ where: { estado: 'PAGADO',    fechaPago:        { gte: desdeAnterior, lte: hastaAnterior } }, _sum: { monto: true } }),
    prisma.pago.aggregate({ where: { estado: 'PENDIENTE', fechaVencimiento: { gte: desdeAnterior, lte: hastaAnterior } }, _sum: { monto: true } }),
    prisma.pago.aggregate({ where: { estado: 'VENCIDO',   fechaVencimiento: { gte: desdeAnterior, lte: hastaAnterior } }, _sum: { monto: true } }),
    // ── Período anterior — Cuotas ─────────────────────────────────────────
    prisma.cuota.aggregate({ where: { pagado: true,  fechaPago:        { gte: desdeAnterior, lte: hastaAnterior } }, _sum: { monto: true } }),
    prisma.cuota.aggregate({ where: { pagado: true,  fechaPago:        { gte: desdeAnterior, lte: hastaAnterior } }, _sum: { monto: true } }),
    prisma.cuota.aggregate({ where: { pagado: false, fechaVencimiento: { gte: desdeAnterior, lte: hastaAnterior } }, _sum: { monto: true } }),
    prisma.cuota.aggregate({ where: { pagado: false, fechaVencimiento: { gte: desdeAnterior, lte: hastaAnterior } }, _sum: { monto: true } }),
    // ── Serie temporal ─────────────────────────────────────────────────────
    Promise.all(puntos.map(async ({ label, desde, hasta }) => {
      const [r, pc, mo, rc, pcc] = await Promise.all([
        prisma.pago.aggregate({ where: { estado: 'PAGADO',    fechaPago:        { gte: desde, lte: hasta } }, _sum: { monto: true } }),
        prisma.pago.aggregate({ where: { estado: 'PENDIENTE', fechaVencimiento: { gte: desde, lte: hasta } }, _sum: { monto: true } }),
        prisma.pago.aggregate({ where: { estado: 'VENCIDO',   fechaVencimiento: { gte: desde, lte: hasta } }, _sum: { monto: true } }),
        prisma.cuota.aggregate({ where: { pagado: true,  fechaPago:        { gte: desde, lte: hasta } }, _sum: { monto: true } }),
        prisma.cuota.aggregate({ where: { pagado: false, fechaVencimiento: { gte: desde, lte: hasta } }, _sum: { monto: true } }),
      ])
      const recaudoPunto   = (r._sum.monto  ?? 0) + (rc._sum.monto  ?? 0)
      const porCobrarPunto = (pc._sum.monto ?? 0) + (pcc._sum.monto ?? 0)
      const moraPunto      = mo._sum.monto  ?? 0
      return {
        label,
        ventaTotal: recaudoPunto + porCobrarPunto + moraPunto,
        recaudo:    recaudoPunto,
        porCobrar:  porCobrarPunto,
        mora:       moraPunto,
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
      const [recaudo, pendiente, vencido] = await Promise.all([
        prisma.pago.aggregate({
          where: { estado: 'PAGADO',    fechaPago:        { gte: desde, lte: hasta } },
          _sum: { monto: true },
        }),
        prisma.pago.aggregate({
          where: { estado: 'PENDIENTE', fechaVencimiento: { gte: desde, lte: hasta } },
          _sum: { monto: true },
        }),
        prisma.pago.aggregate({
          where: { estado: 'VENCIDO',   fechaVencimiento: { gte: desde, lte: hasta } },
          _sum: { monto: true },
        }),
      ])
      const recaudoMonto  = recaudo._sum.monto  ?? 0
      const saldoMonto    = (pendiente._sum.monto ?? 0) + (vencido._sum.monto ?? 0)
      return {
        label,
        ventaTotal: recaudoMonto + saldoMonto,
        recaudo:    recaudoMonto,
        saldo:      saldoMonto,
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

// ── Medios de pago ───────────────────────────────────────────────────────────
export async function mediosPago(req: Request, res: Response) {
  const periodo = String(req.query.periodo ?? 'mensual')
  const hoy = new Date()

  const inicioMes    = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const inicioSemana = new Date(hoy); inicioSemana.setDate(hoy.getDate() - 7)
  const inicioDia    = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())

  const desde = periodo === 'diario' ? inicioDia
    : periodo === 'semanal' ? inicioSemana
    : inicioMes

  // Agrupar pagos pagados por método de pago
  const [porMetodo, cuotasPorMedio] = await Promise.all([
    prisma.pago.groupBy({
      by: ['metodo'],
      where: { estado: 'PAGADO', fechaPago: { gte: desde } },
      _count: { metodo: true },
      _sum:   { monto: true },
    }),
    prisma.cuota.groupBy({
      by: ['medioPago'],
      where: { pagado: true, fechaPago: { gte: desde }, medioPago: { not: null } },
      _count: { medioPago: true },
      _sum:   { monto: true },
    }),
  ])

  // Unificar pagos únicos + cuotas por mismo método
  const mapa: Record<string, { cantidad: number; monto: number }> = {}

  for (const p of porMetodo) {
    const key = p.metodo
    if (!mapa[key]) mapa[key] = { cantidad: 0, monto: 0 }
    mapa[key].cantidad += p._count.metodo
    mapa[key].monto    += p._sum.monto ?? 0
  }
  for (const c of cuotasPorMedio) {
    const key = c.medioPago ?? 'OTRO'
    if (!mapa[key]) mapa[key] = { cantidad: 0, monto: 0 }
    mapa[key].cantidad += c._count.medioPago
    mapa[key].monto    += c._sum.monto ?? 0
  }

  const totalMonto    = Object.values(mapa).reduce((s, v) => s + v.monto, 0)
  const totalCantidad = Object.values(mapa).reduce((s, v) => s + v.cantidad, 0)

  const data = Object.entries(mapa)
    .map(([metodo, { cantidad, monto }]) => ({
      metodo,
      cantidad,
      monto,
      porcentajeMonto:    totalMonto    > 0 ? Math.round((monto    / totalMonto)    * 100) : 0,
      porcentajeCantidad: totalCantidad > 0 ? Math.round((cantidad / totalCantidad) * 100) : 0,
    }))
    .sort((a, b) => b.monto - a.monto)

  return ApiResponse.success(res, { total: totalMonto, totalCantidad, metodos: data, periodo })
}

// ── Demografía: distribución por departamento y ciudad ───────────────────────
export async function demografia(_req: Request, res: Response) {
  const [porDepartamento, porCiudad] = await Promise.all([
    prisma.estudiante.groupBy({
      by:      ['departamento'],
      where:   { departamento: { not: null } },
      _count:  { departamento: true },
      orderBy: { _count: { departamento: 'desc' } },
    }),
    prisma.estudiante.groupBy({
      by:      ['ciudad', 'departamento'],
      where:   { ciudad: { not: null } },
      _count:  { ciudad: true },
      orderBy: { _count: { ciudad: 'desc' } },
      take:    10,
    }),
  ])

  const totalDep  = porDepartamento.reduce((s, r) => s + r._count.departamento, 0)
  const totalCiu  = porCiudad.reduce((s, r) => s + r._count.ciudad, 0)

  return ApiResponse.success(res, {
    departamentos: porDepartamento.map(r => ({
      nombre:     r.departamento ?? 'Sin dato',
      cantidad:   r._count.departamento,
      porcentaje: totalDep > 0 ? Math.round((r._count.departamento / totalDep) * 100) : 0,
    })),
    ciudades: porCiudad.map(r => ({
      nombre:       r.ciudad       ?? 'Sin dato',
      departamento: r.departamento ?? null,
      cantidad:     r._count.ciudad,
      porcentaje:   totalCiu > 0 ? Math.round((r._count.ciudad / totalCiu) * 100) : 0,
    })),
    totalDep,
    totalCiu,
  })
}

// ── Marketing: fuentes de contacto ──────────────────────────────────────────
export async function marketing(_req: Request, res: Response) {
  const fuentes = await prisma.fuenteContacto.groupBy({
    by: ['fuente'],
    _count: { fuente: true },
    orderBy: { _count: { fuente: 'desc' } },
  })

  const total = fuentes.reduce((s, f) => s + f._count.fuente, 0)

  const data = fuentes.map(f => ({
    fuente:     f.fuente,
    cantidad:   f._count.fuente,
    porcentaje: total > 0 ? Math.round((f._count.fuente / total) * 100) : 0,
  }))

  return ApiResponse.success(res, { total, fuentes: data })
}
