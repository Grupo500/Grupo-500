import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'

export async function dashboard(req: Request, res: Response) {
  const hoy = new Date()
  const periodo = (req.query.periodo as string) ?? 'mensual'

  // Soporte desde/hasta explícito (MonthPicker) o fallback al periodo legacy
  const desdeQ = req.query.desde as string | undefined
  const hastaQ = req.query.hasta as string | undefined

  const inicioMes    = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const inicioSemana = new Date(hoy); inicioSemana.setDate(hoy.getDate() - 7)
  const inicioDia    = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())

  const inicioPeriodo = desdeQ
    ? new Date(desdeQ + 'T00:00:00')
    : periodo === 'diario' ? inicioDia
    : periodo === 'semanal' ? inicioSemana
    : inicioMes

  const finPeriodo = hastaQ
    ? new Date(hastaQ + 'T23:59:59')
    : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59)

  // Si el usuario es VENDEDOR, filtrar todo por su asesorId
  const filtroAsesor = req.userRole === 'VENDEDOR' && req.asesorId
    ? req.asesorId : undefined

  const filtroPeriodo = { gte: inicioPeriodo, lte: finPeriodo }

  // Filtro de estudiante para pagos vía relación
  const filtroEstPago = filtroAsesor ? { estudiante: { asesorId: filtroAsesor } } : {}

  const [
    totalEstudiantes,
    estudiantesNuevosMes,
    pagosCobrados,
    cursosActivos,
  ] = await Promise.all([
    prisma.estudiante.count({ where: filtroAsesor ? { asesorId: filtroAsesor } : {} }),
    prisma.estudiante.count({ where: { createdAt: { gte: inicioPeriodo, lte: finPeriodo }, ...(filtroAsesor && { asesorId: filtroAsesor }) } }),
    prisma.pago.aggregate({ where: { estado: 'PAGADO', fechaPago: filtroPeriodo, ...filtroEstPago }, _sum: { monto: true, montoNeto: true, comisionHotmart: true, comisionAsesor: true }, _count: true }),
    prisma.curso.count({ where: { activo: true } }),
  ])

  const s = pagosCobrados._sum
  return ApiResponse.success(res, {
    estudiantes: { total: totalEstudiantes, nuevosMes: estudiantesNuevosMes },
    cobranza: {
      cobrado: { monto: s.monto ?? 0, cantidad: pagosCobrados._count },
    },
    // Desglose de comisiones del período (en COP)
    desglose: {
      bruto:           s.monto ?? 0,
      comisionHotmart: s.comisionHotmart ?? 0,
      comisionAsesor:  s.comisionAsesor ?? 0,
      neto:            s.montoNeto ?? 0,
    },
    cursosActivos,
    periodo,
  })
}

export async function ingresos(req: Request, res: Response) {
  const { desde, hasta, asesorId } = req.query

  const pagos = await prisma.pago.findMany({
    where: {
      estado: 'PAGADO',
      ...(desde && hasta && {
        fechaPago: { gte: new Date(String(desde) + 'T00:00:00'), lte: new Date(String(hasta) + 'T23:59:59') },
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
  const hoy = new Date()

  let inicioMesActual: Date
  let finMesActual: Date
  let inicioMesAnterior: Date
  let finMesAnterior: Date

  if (desde && hasta) {
    // Rango del datepicker; parsear como hora local (no UTC) para evitar desfase de zona horaria
    inicioMesActual = new Date(String(desde) + 'T00:00:00')
    finMesActual    = new Date(String(hasta) + 'T23:59:59')
    const duracionMs   = finMesActual.getTime() - inicioMesActual.getTime()
    finMesAnterior     = new Date(inicioMesActual.getTime() - 1)
    inicioMesAnterior  = new Date(finMesAnterior.getTime() - duracionMs)
  } else {
    // Sin filtro: comparar desde inicio de mes hasta HOY vs mismo corte del mes anterior
    inicioMesActual   = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    finMesActual      = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59)
    inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    finMesAnterior    = new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate(), 23, 59, 59)
  }

  // Traer asesores + pagos de ambos períodos en 3 queries paralelas
  const [asesores, pagosActual, pagosAnterior] = await Promise.all([
    prisma.asesor.findMany({ select: { id: true, nombre: true, user: { select: { image: true } } } }),
    prisma.pago.findMany({
      where: { estado: 'PAGADO', fechaPago: { gte: inicioMesActual, lte: finMesActual } },
      select: { asesorId: true, monto: true, estudianteId: true, comisionAsesor: true },
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
      const pagosDelAsesor = pagosActual.filter(p => p.asesorId === a.id)
      const ventasActual   = pagosDelAsesor.reduce((s, p) => s + p.monto, 0)
      const ventasAnterior = sumar(pagosAnterior, a.id)
      const variacion      = ventasAnterior > 0 ? Math.round(((ventasActual - ventasAnterior) / ventasAnterior) * 100) : 0
      // Estudiantes distintos con venta DENTRO del período (no histórico)
      const estudiantesPeriodo = new Set(pagosDelAsesor.map(p => p.estudianteId)).size
      const comisionGanada = pagosDelAsesor.reduce((s, p) => s + (p.comisionAsesor ?? 0), 0)
      return {
        id: a.id,
        nombre: a.nombre,
        image: a.user?.image ?? null,
        totalVentas: ventasActual,
        cobrado: ventasActual,
        cantidadPagos: pagosDelAsesor.length,
        totalEstudiantes: estudiantesPeriodo,
        comisionGanada,
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
    if (diasRango <= 31) {
      // Rango corto/mensual: punto por día — muestra picos y caídas diarias
      for (let i = 0; i < diasRango; i++) {
        const d = new Date(desdeTotales)
        d.setDate(desdeTotales.getDate() + i)
        puntos.push({
          label: d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
          desde: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0),
          hasta: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59),
        })
      }
    } else if (diasRango <= 92) {
      // Rango mediano (2–3 meses): punto por semana
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

  // ── Queries en paralelo (solo pagos PAGADOS; ya no hay cuotas) ───────────
  const [recaudoActual, recaudoAnterior, serie] = await Promise.all([
    prisma.pago.aggregate({ where: { estado: 'PAGADO', fechaPago: { gte: desdeTotales, lte: hastaTotales } }, _sum: { monto: true } }),
    prisma.pago.aggregate({ where: { estado: 'PAGADO', fechaPago: { gte: desdeAnterior, lte: hastaAnterior } }, _sum: { monto: true } }),
    // ── Serie temporal ─────────────────────────────────────────────────────
    Promise.all(puntos.map(async ({ label, desde, hasta }) => {
      const r = await prisma.pago.aggregate({ where: { estado: 'PAGADO', fechaPago: { gte: desde, lte: hasta } }, _sum: { monto: true } })
      const monto = r._sum.monto ?? 0
      return { label, ventaTotal: monto, recaudo: monto, porCobrar: 0, mora: 0 }
    })),
  ])

  const variacion = (actual: number, anterior: number) =>
    anterior > 0 ? Math.round(((actual - anterior) / anterior) * 100) : null

  const totalActual   = recaudoActual._sum.monto   ?? 0
  const totalAnterior = recaudoAnterior._sum.monto ?? 0

  return ApiResponse.success(res, {
    totales: { ventaTotal: totalActual, recaudo: totalActual, porCobrar: 0, mora: 0 },
    variaciones: {
      ventaTotal: variacion(totalActual, totalAnterior),
      recaudo:    variacion(totalActual, totalAnterior),
      porCobrar:  null,
      mora:       null,
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
  const desdeQ  = req.query.desde as string | undefined
  const hastaQ  = req.query.hasta as string | undefined
  const hoy = new Date()
  let puntos: { label: string; desde: Date; hasta: Date }[] = []
  let granularidad: 'horaria' | 'diaria' | 'mensual' = 'mensual'

  // ── Modo con rango explícito (desde/hasta) ── granularidad adaptativa ──
  if (desdeQ && hastaQ) {
    const desde = new Date(desdeQ + 'T00:00:00')
    const hasta = new Date(hastaQ + 'T23:59:59')
    const diffDias = Math.ceil((hasta.getTime() - desde.getTime()) / 86_400_000)

    // No proyectar a futuro: si el rango incluye fechas posteriores a hoy, se trunca
    const finHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59)
    const hastaReal = hasta > finHoy ? finHoy : hasta

    if (diffDias <= 1) {
      // Granularidad horaria: bloques de 2h, hasta la hora actual si es hoy
      granularidad = 'horaria'
      const esHoy = desde.toDateString() === hoy.toDateString()
      const horaTope = esHoy ? hoy.getHours() : 23
      const base = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate(), 0, 0, 0)
      for (let h = 0; h <= horaTope; h += 2) {
        const ini = new Date(base); ini.setHours(h, 0, 0, 0)
        const fin = new Date(base); fin.setHours(h + 1, 59, 59, 999)
        puntos.push({ label: `${String(h).padStart(2,'0')}h`, desde: ini, hasta: fin })
      }
    } else if (diffDias <= 62) {
      // Granularidad diaria — hasta hoy si el rango incluye días futuros
      granularidad = 'diaria'
      const cur = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate(), 0, 0, 0)
      const fin = new Date(hastaReal.getFullYear(), hastaReal.getMonth(), hastaReal.getDate(), 23, 59, 59)
      while (cur <= fin) {
        const ini = new Date(cur)
        const finDia = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 23, 59, 59)
        const label = ini.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
        puntos.push({ label, desde: ini, hasta: finDia })
        cur.setDate(cur.getDate() + 1)
      }
    } else {
      // Granularidad mensual — hasta el mes actual si el rango llega a futuro
      granularidad = 'mensual'
      const cur = new Date(desde.getFullYear(), desde.getMonth(), 1)
      const fin = new Date(hastaReal.getFullYear(), hastaReal.getMonth(), 1)
      while (cur <= fin) {
        const ini = new Date(cur.getFullYear(), cur.getMonth(), 1)
        const finMes = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59)
        const label = ini.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
        puntos.push({ label, desde: ini, hasta: finMes })
        cur.setMonth(cur.getMonth() + 1)
      }
    }
  } else if (periodo === 'diario') {
    granularidad = 'diaria'
    for (let i = 13; i >= 0; i--) {
      const d = new Date(hoy)
      d.setDate(hoy.getDate() - i)
      const desde = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
      const hasta  = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
      const label  = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
      puntos.push({ label, desde, hasta })
    }
  } else if (periodo === 'semanal') {
    granularidad = 'diaria'
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
    granularidad = 'mensual'
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

  return ApiResponse.success(res, { puntos: resultados, variacion, actual, anterior, granularidad })
}

// ── Medios de pago ───────────────────────────────────────────────────────────
export async function mediosPago(req: Request, res: Response) {
  const periodo = String(req.query.periodo ?? 'mensual')
  const hoy = new Date()

  const desdeQ = req.query.desde as string | undefined
  const hastaQ = req.query.hasta as string | undefined

  const inicioMes    = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const inicioSemana = new Date(hoy); inicioSemana.setDate(hoy.getDate() - 7)
  const inicioDia    = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())

  const desde = desdeQ
    ? new Date(desdeQ + 'T00:00:00')
    : periodo === 'diario' ? inicioDia
    : periodo === 'semanal' ? inicioSemana
    : inicioMes

  const hasta = hastaQ
    ? new Date(hastaQ + 'T23:59:59')
    : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59)

  // Agrupar pagos pagados por método de pago
  const porMetodo = await prisma.pago.groupBy({
    by: ['metodo'],
    where: { estado: 'PAGADO', fechaPago: { gte: desde, lte: hasta } },
    _count: { metodo: true },
    _sum:   { monto: true },
  })

  const mapa: Record<string, { cantidad: number; monto: number }> = {}
  for (const p of porMetodo) {
    const key = p.metodo
    if (!mapa[key]) mapa[key] = { cantidad: 0, monto: 0 }
    mapa[key].cantidad += p._count.metodo
    mapa[key].monto    += p._sum.monto ?? 0
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

// ── Estudiantes por período: adapta granularidad según rango ─────────────────
export async function estudiantesPorMes(req: Request, res: Response) {
  const hoy = new Date()
  const { desde: desdeQ, hasta: hastaQ } = req.query

  let desdeDate: Date
  let hastaDate: Date

  if (desdeQ && hastaQ) {
    desdeDate = new Date(String(desdeQ) + 'T00:00:00')
    hastaDate = new Date(String(hastaQ) + 'T23:59:59')
  } else {
    desdeDate = new Date(hoy.getFullYear(), 0, 1)
    hastaDate = new Date(hoy.getFullYear(), 11, 31, 23, 59, 59)
  }

  const diasRango = Math.round((hastaDate.getTime() - desdeDate.getTime()) / 86400000) + 1

  type Punto = { label: string; desde: Date; hasta: Date }
  const puntos: Punto[] = []

  if (diasRango <= 31) {
    for (let i = 0; i < diasRango; i++) {
      const d = new Date(desdeDate)
      d.setDate(desdeDate.getDate() + i)
      puntos.push({
        label: d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
        desde: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0),
        hasta: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59),
      })
    }
  } else if (diasRango <= 92) {
    let cursor = new Date(desdeDate)
    while (cursor <= hastaDate) {
      const finSem = new Date(cursor)
      finSem.setDate(cursor.getDate() + 6)
      if (finSem > hastaDate) finSem.setTime(hastaDate.getTime())
      finSem.setHours(23, 59, 59)
      puntos.push({ label: `${cursor.getDate()}/${cursor.getMonth() + 1}`, desde: new Date(cursor), hasta: new Date(finSem) })
      cursor.setDate(cursor.getDate() + 7)
    }
  } else {
    let cursor = new Date(desdeDate.getFullYear(), desdeDate.getMonth(), 1)
    while (cursor <= hastaDate) {
      const finMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59)
      const hasta  = finMes > hastaDate ? hastaDate : finMes
      puntos.push({
        label: cursor.toLocaleDateString('es-CO', { month: 'short' }),
        desde: new Date(cursor),
        hasta: new Date(hasta),
      })
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    }
  }

  const resultados = await Promise.all(
    puntos.map(async ({ label, desde, hasta }) => {
      const cantidad = await prisma.estudiante.count({
        where: { createdAt: { gte: desde, lte: hasta } },
      })
      return { label, cantidad }
    })
  )

  const total = resultados.reduce((s, r) => s + r.cantidad, 0)
  return ApiResponse.success(res, { puntos: resultados, total })
}
