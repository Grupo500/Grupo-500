import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { diaColombia } from '../services/ranking'
import {
  pagosDelRango, primerasCompras, totalesDe, variacion, mesAnteriorAIgualDia,
  esVentaNueva, valorContractual, cuotasFuturasOriginadas,
  type PagoFinanzas,
} from '../services/finanzas'

/**
 * Desde cuándo se considera que hay historia comparable.
 *
 * En la base hay un pago suelto de 2017 por $1.500 (HP16015479281022) que no
 * corresponde a la operación actual. Tomar el pago más antiguo como inicio del
 * modelo hace que el acumulado diga "desde 2017" y arrastre ese registro a
 * todas las cifras. El piso se configura con FINANZAS_FECHA_INICIO para poder
 * moverlo sin tocar código cuando se cargue histórico anterior.
 */
async function inicioDelModelo(): Promise<Date> {
  const piso = new Date((process.env.FINANZAS_FECHA_INICIO ?? '2026-01-01') + 'T00:00:00')
  const primero = await prisma.pago.aggregate({
    where: { estado: 'PAGADO', fechaPago: { gte: piso } },
    _min: { fechaPago: true },
  })
  return primero._min.fechaPago ?? piso
}

/** Rango pedido, o el mes en curso si no viene nada. */
function rangoDe(req: Request): { desde: Date; hasta: Date } {
  const hoy = new Date()
  const { desde, hasta } = req.query
  return {
    desde: desde ? new Date(String(desde) + 'T00:00:00') : new Date(hoy.getFullYear(), hoy.getMonth(), 1),
    hasta: hasta
      ? new Date(String(hasta) + 'T23:59:59.999')
      : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999),
  }
}

/**
 * Resumen ejecutivo: los indicadores del mes contra el mes anterior a igual
 * día, más el acumulado desde el inicio del modelo.
 */
export async function resumen(req: Request, res: Response) {
  const { desde, hasta } = rangoDe(req)

  // El período puede estar en curso: nada se calcula más allá de hoy.
  const ahora = new Date()
  const corte = hasta < ahora ? hasta : ahora

  const anterior = mesAnteriorAIgualDia(desde, corte)

  const inicioModelo = await inicioDelModelo()

  const [pagosPeriodo, pagosAnterior, pagosAcumulado, primeras] = await Promise.all([
    pagosDelRango(desde, corte),
    pagosDelRango(anterior.desde, anterior.hasta),
    pagosDelRango(inicioModelo, corte),
    primerasCompras(),
  ])

  const iso = (d: Date) => diaColombia(d)!
  const totales = totalesDe(pagosPeriodo, primeras, iso(desde), iso(corte))
  const totalesAnt = totalesDe(pagosAnterior, primeras, iso(anterior.desde), iso(anterior.hasta))
  const totalesAcum = totalesDe(pagosAcumulado, primeras, iso(inicioModelo), iso(corte))

  // ── Serie diaria del período, con los días vacíos incluidos ──────────────
  // Sin los días sin ventas el ritmo del mes se lee mal: la gráfica los salta
  // y un fin de semana flojo parece un día cualquiera.
  const porDia = new Map<string, { ventas: number; valor: number; cobrado: number }>()
  for (const p of pagosPeriodo) {
    const clave = diaColombia(p.fechaPago)
    if (!clave) continue
    const acc = porDia.get(clave) ?? { ventas: 0, valor: 0, cobrado: 0 }
    acc.cobrado += p.monto
    if (esVentaNueva(p)) {
      acc.ventas++
      acc.valor += valorContractual(p)
    }
    porDia.set(clave, acc)
  }

  const dias: { fecha: string; ventas: number; valor: number; cobrado: number; pm7: number }[] = []
  // Se avanza sobre el mediodía UTC: sumar 24 h nunca cruza de día colombiano.
  const cursor = new Date(`${iso(desde)}T12:00:00.000Z`)
  const tope = new Date(`${iso(corte)}T12:00:00.000Z`)
  while (cursor <= tope) {
    const clave = cursor.toISOString().slice(0, 10)
    const d = porDia.get(clave) ?? { ventas: 0, valor: 0, cobrado: 0 }
    dias.push({ fecha: clave, ...d, pm7: 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  // Promedio móvil de siete días. Los primeros seis quedan subestimados porque
  // no hay siete días detrás; se deja así a propósito, igual que en el Excel.
  for (let i = 0; i < dias.length; i++) {
    let suma = 0
    for (let j = Math.max(0, i - 6); j <= i; j++) suma += dias[j].ventas
    dias[i].pm7 = suma / 7
  }

  // ── Proyección lineal de cierre ─────────────────────────────────────────
  const diasTranscurridos = dias.length
  const diasDelMes = new Date(hasta.getFullYear(), hasta.getMonth() + 1, 0).getDate()
  const proyectar = (v: number) => (diasTranscurridos > 0 ? (v / diasTranscurridos) * diasDelMes : 0)

  // ── Saldo pendiente, en los dos criterios que conviven en la empresa ─────
  // No son el mismo número ni deben serlo, así que van separados y con su
  // definición: uno es el compromiso futuro, el otro es lo que hay que ir a
  // cobrar. Juntarlos fue justo lo que causaba las discusiones.
  const cuotasProgramadas =
    totalesAcum.cuotasFuturasOriginadas - totalesAcum.cuotasCobradas

  const porGestionar = await saldoPorGestionar()

  return ApiResponse.success(res, {
    desde: iso(desde),
    hasta: iso(corte),
    inicioModelo: iso(inicioModelo),
    diasTranscurridos,
    diasDelMes,
    periodo: totales,
    anterior: totalesAnt,
    acumulado: totalesAcum,
    variaciones: {
      ventasNuevas: variacion(totales.ventasNuevas, totalesAnt.ventasNuevas),
      valorVendido: variacion(totales.valorVendido, totalesAnt.valorVendido),
      facturacionCobrada: variacion(totales.facturacionCobrada, totalesAnt.facturacionCobrada),
      netoRecibido: variacion(totales.netoRecibido, totalesAnt.netoRecibido),
      costes: variacion(totales.costes, totalesAnt.costes),
      clientesNuevos: variacion(totales.clientesNuevos, totalesAnt.clientesNuevos),
      ticketPromedio: variacion(totales.ticketPromedio ?? 0, totalesAnt.ticketPromedio ?? 0),
    },
    dias,
    proyeccion: {
      ventasNuevas: proyectar(totales.ventasNuevas),
      valorVendido: proyectar(totales.valorVendido),
      facturacionCobrada: proyectar(totales.facturacionCobrada),
    },
    saldo: {
      cuotasProgramadas,
      porGestionar: porGestionar.monto,
      estudiantesPorGestionar: porGestionar.estudiantes,
    },
  })
}

/**
 * Saldo que alguien tiene que ir a cobrar: inscripciones cuyo precio acordado
 * no está cubierto y que no tienen un plan de cuotas que Hotmart cobre solo.
 */
async function saldoPorGestionar(): Promise<{ monto: number; estudiantes: number }> {
  const inscripciones = await prisma.cursoEstudiante.findMany({
    include: {
      curso: { select: { precio: true } },
      estudiante: {
        select: { pagos: { select: { monto: true, estado: true, enPartes: true, cuotasTotal: true } } },
      },
    },
  })

  const UMBRAL = 1000 // redondeo de la conversión de divisa, no deuda real
  let monto = 0
  let estudiantes = 0

  for (const ins of inscripciones) {
    const precio = ins.precioAcordado ?? ins.curso.precio ?? 0
    if (!precio) continue
    const pagados = ins.estudiante.pagos.filter(p => p.estado === 'PAGADO')
    const saldo = Math.round(precio - pagados.reduce((s, p) => s + p.monto, 0))
    if (saldo <= UMBRAL) continue
    const tienePlan = pagados.some(p => p.enPartes && (p.cuotasTotal ?? 0) > 1)
    if (tienePlan) continue
    monto += saldo
    estudiantes++
  }

  return { monto, estudiantes }
}

/**
 * Histórico de cierres: una fila por mes. No es una foto guardada, se
 * recalcula con los datos actuales, así que una corrección de Hotmart de hoy
 * arregla también los meses pasados.
 */
export async function cierreMensual(req: Request, res: Response) {
  const { desde, hasta } = rangoDe(req)
  const ahora = new Date()
  const corte = hasta < ahora ? hasta : ahora

  const [pagos, primeras] = await Promise.all([
    pagosDelRango(desde, corte),
    primerasCompras(),
  ])

  // Agrupar por mes colombiano
  const porMes = new Map<string, PagoFinanzas[]>()
  for (const p of pagos) {
    const dia = diaColombia(p.fechaPago)
    if (!dia) continue
    const mes = dia.slice(0, 7)
    const lista = porMes.get(mes) ?? []
    lista.push(p)
    porMes.set(mes, lista)
  }

  const meses = [...porMes.keys()].sort()
  let saldoAcumulado = 0

  const filas = meses.map(mes => {
    const lista = porMes.get(mes)!
    const primerDia = `${mes}-01`
    const ultimoDia = diaColombia(new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0))!
    const t = totalesDe(lista, primeras, primerDia, ultimoDia)

    const saldoInicial = saldoAcumulado
    saldoAcumulado += t.cuotasFuturasOriginadas - t.cuotasCobradas

    return {
      mes,
      ...t,
      saldoInicial,
      saldoFinal: saldoAcumulado,
      // El mes en curso no está cerrado: la interfaz debe decirlo, porque sus
      // ratios todavía se mueven.
      enCurso: mes === diaColombia(corte)!.slice(0, 7),
    }
  })

  return ApiResponse.success(res, { filas })
}

/** Participación por producto y por asesor sobre el valor vendido. */
export async function mixComercial(req: Request, res: Response) {
  const { desde, hasta } = rangoDe(req)
  const ahora = new Date()
  const corte = hasta < ahora ? hasta : ahora

  const pagos = await prisma.pago.findMany({
    where: { estado: 'PAGADO', fechaPago: { gte: desde, lte: corte } },
    select: {
      monto: true, enPartes: true, cuotaNumero: true, cuotasTotal: true,
      asesor: { select: { id: true, nombre: true } },
      estudiante: {
        select: { cursos: { select: { curso: { select: { nombre: true, familia: true } } } } },
      },
    },
  })

  const porFamilia = new Map<string, { ventas: number; valor: number }>()
  const porAsesor = new Map<string, { nombre: string; ventas: number; valor: number }>()
  let totalValor = 0
  let totalVentas = 0
  let sinAtribucion = 0

  for (const p of pagos) {
    if (!esVentaNueva(p)) continue
    const valor = valorContractual(p)
    totalValor += valor
    totalVentas++

    // El pago no guarda a qué curso corresponde; se usa la familia del único
    // curso del estudiante y, si tiene varios, queda como "Sin clasificar"
    // antes que atribuirlo al azar.
    const familias = new Set(p.estudiante.cursos.map(c => c.curso.familia ?? 'Otros'))
    const familia = familias.size === 1 ? [...familias][0] : 'Sin clasificar'
    const f = porFamilia.get(familia) ?? { ventas: 0, valor: 0 }
    f.ventas++; f.valor += valor
    porFamilia.set(familia, f)

    if (p.asesor) {
      const a = porAsesor.get(p.asesor.id) ?? { nombre: p.asesor.nombre, ventas: 0, valor: 0 }
      a.ventas++; a.valor += valor
      porAsesor.set(p.asesor.id, a)
    } else {
      sinAtribucion++
    }
  }

  const productos = [...porFamilia.entries()]
    .map(([nombre, v]) => ({ nombre, ...v, participacion: totalValor > 0 ? v.valor / totalValor : 0 }))
    .sort((a, b) => b.valor - a.valor)

  const asesores = [...porAsesor.entries()]
    .map(([id, v]) => ({ id, ...v, participacion: totalValor > 0 ? v.valor / totalValor : 0 }))
    .sort((a, b) => b.valor - a.valor)

  const concentracion = (lista: { valor: number }[]) => ({
    principal: lista.length > 0 && totalValor > 0 ? lista[0].valor / totalValor : 0,
    tresPrincipales: totalValor > 0
      ? lista.slice(0, 3).reduce((s, x) => s + x.valor, 0) / totalValor
      : 0,
  })

  return ApiResponse.success(res, {
    totalValor,
    totalVentas,
    productos,
    asesores,
    concentracionProductos: { ...concentracion(productos), conVentas: productos.length },
    concentracionAsesores: { ...concentracion(asesores), conVentas: asesores.length },
    sinAtribucion,
    porcentajeSinAtribucion: totalVentas > 0 ? sinAtribucion / totalVentas : 0,
  })
}
