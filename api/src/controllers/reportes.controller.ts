import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { construirRanking, hoyColombia, diaColombia, emailKey } from '../services/ranking'

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
    pagosPorCobrar,
    pagosVencidos,
    cursosActivos,
  ] = await Promise.all([
    prisma.estudiante.count({ where: filtroAsesor ? { asesorId: filtroAsesor } : {} }),
    prisma.estudiante.count({ where: { createdAt: { gte: inicioPeriodo, lte: finPeriodo }, ...(filtroAsesor && { asesorId: filtroAsesor }) } }),
    prisma.pago.aggregate({ where: { estado: 'PAGADO', fechaPago: filtroPeriodo, ...filtroEstPago }, _sum: { monto: true, montoNeto: true, comisionHotmart: true, comisionAsesor: true }, _count: true }),
    prisma.pago.aggregate({ where: { estado: 'PENDIENTE', fechaVencimiento: filtroPeriodo, ...filtroEstPago }, _sum: { monto: true }, _count: true }),
    prisma.pago.aggregate({ where: { estado: 'VENCIDO', ...filtroEstPago }, _sum: { monto: true }, _count: true }),
    prisma.curso.count({ where: { activo: true } }),
  ])

  const s = pagosCobrados._sum
  return ApiResponse.success(res, {
    estudiantes: { total: totalEstudiantes, nuevosMes: estudiantesNuevosMes },
    cobranza: {
      cobrado:   { monto: s.monto ?? 0,                   cantidad: pagosCobrados._count },
      porCobrar: { monto: pagosPorCobrar._sum.monto ?? 0, cantidad: pagosPorCobrar._count },
      vencida:   { monto: pagosVencidos._sum.monto ?? 0,  cantidad: pagosVencidos._count },
      pendiente: { monto: pagosPorCobrar._sum.monto ?? 0, cantidad: pagosPorCobrar._count },
    },
    cobradoMes: s.monto ?? 0,
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

// Módulo "Mis ventas": totales del periodo + ritmo diario, para el asesor logueado.
// Atribuye por `pago.asesorId` (quién hizo la venta), no por el asesor del
// estudiante — un asesor puede venderle a un estudiante que trajo otro.
export async function misVentasResumen(req: Request, res: Response) {
  const isAdmin = req.userRole === 'ADMIN'
  const { desde, hasta, asesorId } = req.query

  // Un VENDEDOR siempre ve lo suyo. Un ADMIN ve a quien pida, o a todos.
  const filtroAsesor = isAdmin
    ? (asesorId ? (asesorId === 'sin-asesor' ? { asesorId: null } : { asesorId: String(asesorId) }) : {})
    : { asesorId: req.asesorId ?? '__sin_asesor__' }

  const hoy = new Date()
  const inicio = desde ? new Date(String(desde)) : new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const fin = hasta ? new Date(String(hasta)) : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59)

  if (!isAdmin && !req.asesorId) {
    return ApiResponse.success(res, {
      vendido: 0, comision: 0, cantidad: 0, ticketPromedio: 0,
      variacion: { vendido: null, comision: null, cantidad: null, ticketPromedio: null },
      dias: [], porAsesor: [], desde: inicio, hasta: fin,
    })
  }

  const where = { ...filtroAsesor, estado: 'PAGADO' as const, fechaPago: { gte: inicio, lte: fin } }

  // Periodo anterior con el mismo tramo transcurrido: si vamos por el día 12
  // del mes, se compara contra los primeros 12 días del mes pasado. El corte se
  // acota al último día de ese mes para que un 31 no se desborde al siguiente.
  const ahora = new Date()
  const corte = fin < ahora ? fin : ahora
  // Los días se cuentan en Colombia, y el periodo previo se deriva del rango
  // recibido (que ya viene en medianoche colombiana) en vez de reconstruirse
  // con el reloj del servidor, que corre en UTC.
  const diasCorridos = Number(diaColombia(corte)!.slice(8, 10))
  const inicioPrevio = new Date(inicio)
  inicioPrevio.setMonth(inicioPrevio.getMonth() - 1)
  const [anioPrev, mesPrev] = diaColombia(inicioPrevio)!.split('-').map(Number)
  const ultimoDiaPrevio = new Date(Date.UTC(anioPrev, mesPrev, 0)).getUTCDate()
  const finPrevio = new Date(inicioPrevio)
  finPrevio.setDate(Math.min(diasCorridos, ultimoDiaPrevio) + 1)
  finPrevio.setMilliseconds(-1)
  const wherePrevio = { ...filtroAsesor, estado: 'PAGADO' as const, fechaPago: { gte: inicioPrevio, lte: finPrevio } }

  const [agg, pagos, aggPrevio] = await Promise.all([
    prisma.pago.aggregate({ where, _sum: { monto: true, comisionAsesor: true }, _count: true }),
    prisma.pago.findMany({ where, select: { monto: true, fechaPago: true } }),
    prisma.pago.aggregate({ where: wherePrevio, _sum: { monto: true, comisionAsesor: true }, _count: true }),
  ])

  const vendido = agg._sum.monto ?? 0
  const cantidad = agg._count

  // Un punto por día del periodo, aunque no haya ventas — la gráfica necesita
  // los días vacíos para que el ritmo del mes se lea completo.
  //
  // El día se calcula en hora de Colombia, no en UTC: una venta de las 9 p.m.
  // cae al día siguiente en UTC y aparecería en la barra equivocada (y como
  // "vendido hoy" cuando en realidad fue anoche).
  const porDia = new Map<string, number>()
  for (const p of pagos) {
    const clave = diaColombia(p.fechaPago ?? null)
    if (!clave) continue
    porDia.set(clave, (porDia.get(clave) ?? 0) + p.monto)
  }

  const dias: { fecha: string; monto: number }[] = []
  const claveInicio = diaColombia(inicio)!
  const claveFin = diaColombia(fin)!
  // Se avanza sobre el mediodía UTC para que sumar 24 h nunca cruce de día.
  const cursor = new Date(`${claveInicio}T12:00:00.000Z`)
  const tope = new Date(`${claveFin}T12:00:00.000Z`)
  while (cursor <= tope) {
    const clave = cursor.toISOString().slice(0, 10)
    dias.push({ fecha: clave, monto: porDia.get(clave) ?? 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  // Desglose por asesor: solo para el ADMIN cuando mira a todos a la vez.
  let porAsesor: { id: string; nombre: string; vendido: number; comision: number; cantidad: number }[] = []
  if (isAdmin && !asesorId) {
    const [grupos, asesores] = await Promise.all([
      prisma.pago.groupBy({
        by: ['asesorId'],
        where: { estado: 'PAGADO', fechaPago: { gte: inicio, lte: fin }, asesorId: { not: null } },
        _sum: { monto: true, comisionAsesor: true },
        _count: true,
      }),
      prisma.asesor.findMany({ select: { id: true, nombre: true } }),
    ])
    const nombreDe = new Map(asesores.map(a => [a.id, a.nombre]))
    porAsesor = grupos
      .map(g => ({
        id: g.asesorId as string,
        nombre: nombreDe.get(g.asesorId as string) ?? 'Asesor',
        vendido: g._sum.monto ?? 0,
        comision: g._sum.comisionAsesor ?? 0,
        cantidad: g._count,
      }))
      .sort((a, b) => b.vendido - a.vendido)
  }

  // null = el periodo anterior fue cero, así que no hay base de comparación.
  const variar = (actual: number, previo: number) =>
    previo > 0 ? Math.round(((actual - previo) / previo) * 100) : null

  const comision = agg._sum.comisionAsesor ?? 0
  const ticketPromedio = cantidad > 0 ? Math.round(vendido / cantidad) : 0
  const vendidoPrevio = aggPrevio._sum.monto ?? 0
  const cantidadPrevia = aggPrevio._count
  const ticketPrevio = cantidadPrevia > 0 ? Math.round(vendidoPrevio / cantidadPrevia) : 0

  return ApiResponse.success(res, {
    vendido,
    comision,
    cantidad,
    ticketPromedio,
    variacion: {
      vendido: variar(vendido, vendidoPrevio),
      comision: variar(comision, aggPrevio._sum.comisionAsesor ?? 0),
      cantidad: variar(cantidad, cantidadPrevia),
      ticketPromedio: variar(ticketPromedio, ticketPrevio),
    },
    dias,
    porAsesor,
    desde: inicio,
    hasta: fin,
  })
}

// Resumen personal del asesor logueado: ventas, comisión, posición y ranking
export async function miResumenAsesor(req: Request, res: Response) {
  const yo = req.asesorId
  const hoy = new Date()
  const inicioMes    = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const finMes       = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59)
  const inicioMesAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  // Se compara el mismo tramo transcurrido del mes anterior. Ojo: si hoy es 31
  // y el mes anterior tiene 30 días, `new Date(y, m-1, 31)` se desborda al mes
  // siguiente y contaría ventas del mes en curso como del anterior.
  const ultimoDiaMesAnt = new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate()
  const finMesAnt    = new Date(hoy.getFullYear(), hoy.getMonth() - 1, Math.min(hoy.getDate(), ultimoDiaMesAnt), 23, 59, 59)

  // Sin asesor asociado (p.ej. admin) → respuesta vacía
  if (!yo) {
    return ApiResponse.success(res, {
      ventas: { monto: 0, cantidad: 0, variacion: null },
      comision: 0,
      estudiantes: { total: 0, nuevos: 0 },
      posicion: { rank: 0, total: 0, falta: 0, siguienteNombre: null },
      serie: [],
      ranking: [],
    })
  }

  // ── Mis métricas del mes ──
  const [misMes, misMesAnt, totalEst, nuevosEst, pagosMes, asesores] = await Promise.all([
    prisma.pago.aggregate({ where: { asesorId: yo, estado: 'PAGADO', fechaPago: { gte: inicioMes, lte: finMes } }, _sum: { monto: true, comisionAsesor: true }, _count: true }),
    prisma.pago.aggregate({ where: { asesorId: yo, estado: 'PAGADO', fechaPago: { gte: inicioMesAnt, lte: finMesAnt } }, _sum: { monto: true } }),
    prisma.estudiante.count({ where: { asesorId: yo } }),
    prisma.estudiante.count({ where: { asesorId: yo, createdAt: { gte: inicioMes, lte: finMes } } }),
    // Todos los pagos del mes para construir el ranking por asesor
    prisma.pago.groupBy({ by: ['asesorId'], where: { estado: 'PAGADO', fechaPago: { gte: inicioMes, lte: finMes }, asesorId: { not: null } }, _sum: { monto: true }, _count: true }),
    prisma.asesor.findMany({ select: { id: true, nombre: true, user: { select: { image: true } } } }),
  ])

  const miMonto       = misMes._sum.monto ?? 0
  const miCantidad    = misMes._count
  const miComision    = misMes._sum.comisionAsesor ?? 0
  const montoAnterior = misMesAnt._sum.monto ?? 0
  // `null` = no hay base de comparación (el mes anterior no tuvo ventas). Es
  // distinto de 0, que significa "vendiste lo mismo".
  const variacion     = montoAnterior > 0 ? Math.round(((miMonto - montoAnterior) / montoAnterior) * 100) : null

  // ── Ranking del mes (ventas) ──
  const nombrePorId = new Map(asesores.map(a => [a.id, { nombre: a.nombre, image: a.user?.image ?? null }]))
  const ranking = pagosMes
    .map(p => ({
      id: p.asesorId as string,
      nombre: nombrePorId.get(p.asesorId as string)?.nombre ?? 'Asesor',
      image:  nombrePorId.get(p.asesorId as string)?.image ?? null,
      totalVentas: p._sum.monto ?? 0,
      cantidad: p._count,
      esYo: p.asesorId === yo,
    }))
    .sort((a, b) => b.totalVentas - a.totalVentas)

  // Si aún no tengo ventas este mes, igual aparezco al final del ranking
  if (!ranking.some(r => r.esYo)) {
    ranking.push({
      id: yo,
      nombre: nombrePorId.get(yo)?.nombre ?? req.userName ?? 'Yo',
      image:  nombrePorId.get(yo)?.image ?? null,
      totalVentas: miMonto,
      cantidad: miCantidad,
      esYo: true,
    })
  }

  const miIndex   = ranking.findIndex(r => r.esYo)
  const siguiente = miIndex > 0 ? ranking[miIndex - 1] : null
  const falta     = siguiente ? Math.max(0, siguiente.totalVentas - miMonto) : 0

  // ── Serie de mis ventas (últimos 6 meses) ──
  const serie = await Promise.all(
    Array.from({ length: 6 }, (_, k) => 5 - k).map(async (back) => {
      const d   = new Date(hoy.getFullYear(), hoy.getMonth() - back, 1)
      const ini = new Date(d.getFullYear(), d.getMonth(), 1)
      const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      const agg = await prisma.pago.aggregate({
        where: { asesorId: yo, estado: 'PAGADO', fechaPago: { gte: ini, lte: fin } },
        _sum: { monto: true, comisionAsesor: true },
        _count: true,
      })
      return {
        label: d.toLocaleDateString('es-CO', { month: 'short' }),
        monto: agg._sum.monto ?? 0,
        comision: agg._sum.comisionAsesor ?? 0,
        cantidad: agg._count,
      }
    })
  )

  return ApiResponse.success(res, {
    ventas: { monto: miMonto, cantidad: miCantidad, variacion },
    comision: miComision,
    estudiantes: { total: totalEst, nuevos: nuevosEst },
    posicion: { rank: miIndex + 1, total: ranking.length, falta, siguienteNombre: siguiente?.nombre ?? null },
    serie,
    ranking,
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
    // Sin filtro: mes actual (1–día actual) vs mismo corte del mes anterior (1–día actual)
    inicioMesActual   = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    finMesActual      = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59)
    inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    finMesAnterior    = new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate(), 23, 59, 59)
  }

  // Inicio del día de hoy en hora Colombia, para conteo de "leads de hoy"
  const inicioHoyCol = new Date(`${hoyColombia()}T00:00:00-05:00`)

  // Traer asesores + pagos + leads de Trengo y HubSpot en queries paralelas
  const [asesores, pagosActual, pagosAnterior, leadsAll, leadsHoy, leadsHubspotAll, leadsHubspotHoy] = await Promise.all([
    prisma.asesor.findMany({ select: { id: true, nombre: true, email: true, emailCrm: true, user: { select: { image: true } } } }),
    prisma.pago.findMany({
      where: { estado: 'PAGADO', fechaPago: { gte: inicioMesActual, lte: finMesActual } },
      select: { asesorId: true, monto: true, estudianteId: true, comisionAsesor: true, fechaPago: true },
    }),
    prisma.pago.findMany({
      where: { estado: 'PAGADO', fechaPago: { gte: inicioMesAnterior, lte: finMesAnterior } },
      select: { asesorId: true, monto: true },
    }),
    // Leads del MISMO período seleccionado (no histórico), para que la tasa
    // de cierre compare ventas y leads del mismo rango de fechas.
    prisma.trengoTicket.groupBy({
      by: ['agentEmail'],
      where: { firstAssignedAt: { gte: inicioMesActual, lte: finMesActual } },
      _count: { ticketId: true },
    }),
    prisma.trengoTicket.groupBy({
      by: ['agentEmail'],
      where: { firstAssignedAt: { gte: inicioHoyCol } },
      _count: { ticketId: true },
    }),
    // Leads de HubSpot (mismo período), se suman a los de Trengo
    prisma.hubspotLead.groupBy({
      by: ['ownerEmail'],
      where: { createdAtHubspot: { gte: inicioMesActual, lte: finMesActual } },
      _count: { ticketId: true },
    }),
    prisma.hubspotLead.groupBy({
      by: ['ownerEmail'],
      where: { createdAtHubspot: { gte: inicioHoyCol } },
      _count: { ticketId: true },
    }),
  ])

  // Construir mapas de leads por email canónico — Trengo + HubSpot sumados
  const leadsPorEmail: Record<string, number> = {}
  for (const r of leadsAll) leadsPorEmail[emailKey(r.agentEmail)] = (leadsPorEmail[emailKey(r.agentEmail)] ?? 0) + r._count.ticketId
  for (const r of leadsHubspotAll) leadsPorEmail[emailKey(r.ownerEmail)] = (leadsPorEmail[emailKey(r.ownerEmail)] ?? 0) + r._count.ticketId

  const leadsHoyPorEmail: Record<string, number> = {}
  for (const r of leadsHoy) leadsHoyPorEmail[emailKey(r.agentEmail)] = (leadsHoyPorEmail[emailKey(r.agentEmail)] ?? 0) + r._count.ticketId
  for (const r of leadsHubspotHoy) leadsHoyPorEmail[emailKey(r.ownerEmail)] = (leadsHoyPorEmail[emailKey(r.ownerEmail)] ?? 0) + r._count.ticketId

  const ranking = construirRanking({
    asesores: asesores.map(a => ({
      id: a.id,
      nombre: a.nombre,
      email: a.email,
      image: a.user?.image ?? null,
    })),
    pagosActual,
    pagosAnterior,
    leadsPorEmail,
    leadsHoyPorEmail,
    ocultarComisionAjena: req.userRole === 'VENDEDOR',
    asesorIdActual: req.asesorId ?? null,
  })

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

  // VENDEDOR → solo sus estudiantes por curso; ADMIN → global
  const filtroAsesor = req.userRole === 'VENDEDOR' && req.asesorId ? req.asesorId : undefined

  const cursos = await prisma.curso.findMany({
    include: {
      _count: {
        select: {
          estudiantes: {
            where: {
              fechaCompra: { gte: desdeDate, lte: hastaDate },
              ...(filtroAsesor && { estudiante: { asesorId: filtroAsesor } }),
            },
          },
        },
      },
    },
    orderBy: { nombre: 'asc' },
  })

  const ordenados = [...cursos].sort((a, b) => b._count.estudiantes - a._count.estudiantes)
  return ApiResponse.success(res, ordenados)
}

// Saldos abiertos. Distingue lo que Hotmart cobra solo (cuotas programadas del
// Smart Installment) de lo que alguien tiene que ir a cobrar: meter ambos en un
// mismo total da una cifra que asusta y no dice qué hacer.
export async function pendientesPorCobrar(req: Request, res: Response) {
  const filtroAsesor = req.userRole === 'VENDEDOR' && req.asesorId ? req.asesorId : undefined

  const inscripciones = await prisma.cursoEstudiante.findMany({
    where: filtroAsesor ? { estudiante: { asesorId: filtroAsesor } } : {},
    include: {
      curso: { select: { nombre: true, precio: true } },
      estudiante: {
        select: {
          id: true, nombre: true, telefono: true,
          asesor: { select: { nombre: true } },
          pagos: { select: { monto: true, estado: true, enPartes: true, cuotaNumero: true, cuotasTotal: true } },
        },
      },
    },
  })

  const UMBRAL = 1000 // céntimos de redondeo por conversión de divisa, no deuda

  let automatico = { monto: 0, estudiantes: 0 }
  let gestion    = { monto: 0, estudiantes: 0 }
  const cuotasFaltantes: Record<number, number> = {}
  const porGestionar: { estudianteId: string; nombre: string; telefono: string; curso: string; saldo: number; asesor: string | null }[] = []

  for (const ins of inscripciones) {
    const precio = ins.precioAcordado ?? ins.curso.precio ?? 0
    if (!precio) continue

    const pagados = ins.estudiante.pagos.filter(p => p.estado === 'PAGADO')
    const pagado = pagados.reduce((s, p) => s + p.monto, 0)
    const saldo = Math.round(precio - pagado)
    if (saldo <= UMBRAL) continue

    const cuota = pagados.find(p => p.enPartes && (p.cuotasTotal ?? 0) > 1)
    if (cuota) {
      automatico.monto += saldo
      automatico.estudiantes++
      const faltan = (cuota.cuotasTotal ?? 0) - (cuota.cuotaNumero ?? 1)
      if (faltan > 0) cuotasFaltantes[faltan] = (cuotasFaltantes[faltan] ?? 0) + 1
    } else {
      gestion.monto += saldo
      gestion.estudiantes++
      porGestionar.push({
        estudianteId: ins.estudiante.id,
        nombre: ins.estudiante.nombre,
        telefono: ins.estudiante.telefono,
        curso: ins.curso.nombre,
        saldo,
        asesor: ins.estudiante.asesor?.nombre ?? null,
      })
    }
  }

  porGestionar.sort((a, b) => b.saldo - a.saldo)

  return ApiResponse.success(res, {
    total: automatico.monto + gestion.monto,
    estudiantes: automatico.estudiantes + gestion.estudiantes,
    automatico,
    gestion,
    cuotasFaltantes: Object.entries(cuotasFaltantes)
      .map(([faltan, estudiantes]) => ({ faltan: Number(faltan), estudiantes }))
      .sort((a, b) => a.faltan - b.faltan),
    porGestionar: porGestionar.slice(0, 50),
  })
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
      hastaAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate(), 23, 59, 59)
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
      // Granularidad diaria — mostramos TODOS los días del rango (mes completo);
      // los días futuros salen null en la agregación para no dibujar línea en 0
      granularidad = 'diaria'
      const cur = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate(), 0, 0, 0)
      const fin = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate(), 23, 59, 59)
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

  // VENDEDOR → solo sus pagos; ADMIN → global
  const filtroAsesor = req.userRole === 'VENDEDOR' && req.asesorId ? req.asesorId : undefined

  // Corte de hoy: los días posteriores se devuelven null (sin datos), para que
  // la gráfica muestre el eje del mes completo sin dibujar la línea en 0
  const finHoyAgg = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59)

  const resultados = await Promise.all(
    puntos.map(async ({ label, desde, hasta }) => {
      if (desde > finHoyAgg) return { label, ingresos: null as number | null, pagos: 0 }
      const agg = await prisma.pago.aggregate({
        where: { estado: 'PAGADO', fechaPago: { gte: desde, lte: hasta }, ...(filtroAsesor && { asesorId: filtroAsesor }) },
        _sum: { monto: true },
        _count: true,
      })
      return { label, ingresos: (agg._sum.monto ?? 0) as number | null, pagos: agg._count }
    })
  )

  // Variación vs período anterior (último día con datos vs el previo)
  const conDatos = resultados.filter(r => r.ingresos != null)
  const actual   = conDatos[conDatos.length - 1]?.ingresos ?? 0
  const anterior = conDatos[conDatos.length - 2]?.ingresos ?? 0
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

  // VENDEDOR → solo sus pagos; ADMIN → global
  const filtroAsesor = req.userRole === 'VENDEDOR' && req.asesorId ? req.asesorId : undefined

  // Agrupar pagos pagados por método de pago
  const porMetodo = await prisma.pago.groupBy({
    by: ['metodo'],
    where: { estado: 'PAGADO', fechaPago: { gte: desde, lte: hasta }, ...(filtroAsesor && { asesorId: filtroAsesor }) },
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
