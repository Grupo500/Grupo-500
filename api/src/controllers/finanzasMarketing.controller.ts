import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { diaColombia } from '../services/ranking'
import { pagosDelRango, primerasCompras, totalesDe, valorContractual, esVentaNueva } from '../services/finanzas'

const MS_DIA = 86_400_000

/**
 * Reparte el gasto de una campaña entre los días de su período.
 *
 * Los reportes de las plataformas traen el acumulado del período, no el gasto
 * por día. Prorratear es una estimación, y como tal se muestra: sin la
 * advertencia, un CAC calculado así se lee como si fuera exacto.
 */
function gastoEnRango(
  campania: { desde: Date; hasta: Date; gastoCOP: number },
  desde: Date,
  hasta: Date,
): number {
  const diasCampania = Math.max(1, Math.round((campania.hasta.getTime() - campania.desde.getTime()) / MS_DIA) + 1)
  const inicio = Math.max(campania.desde.getTime(), desde.getTime())
  const fin = Math.min(campania.hasta.getTime(), hasta.getTime())
  if (fin < inicio) return 0
  const diasSolapados = Math.round((fin - inicio) / MS_DIA) + 1
  return (campania.gastoCOP / diasCampania) * diasSolapados
}

export async function marketing(req: Request, res: Response) {
  const hoy = new Date()
  const desde = req.query.desde
    ? new Date(String(req.query.desde) + 'T00:00:00')
    : new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const hastaPedido = req.query.hasta
    ? new Date(String(req.query.hasta) + 'T23:59:59.999')
    : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999)
  const corte = hastaPedido < hoy ? hastaPedido : hoy

  const [campanias, pagos, primeras] = await Promise.all([
    prisma.inversionPublicitaria.findMany({ orderBy: { gastoCOP: 'desc' } }),
    pagosDelRango(desde, corte),
    primerasCompras(),
  ])

  const iso = (d: Date) => diaColombia(d)!
  const t = totalesDe(pagos, primeras, iso(desde), iso(corte))

  const porPlataforma = new Map<string, number>()
  for (const c of campanias) {
    const g = gastoEnRango(c, desde, corte)
    if (g > 0) porPlataforma.set(c.plataforma, (porPlataforma.get(c.plataforma) ?? 0) + g)
  }
  const inversion = [...porPlataforma.values()].reduce((s, v) => s + v, 0)

  // Sin inversión cargada estas métricas no existen. Devolver 0 haría creer
  // que el CAC es cero, que es lo contrario de "no hay dato".
  const cac = t.clientesNuevos > 0 && inversion > 0 ? inversion / t.clientesNuevos : null
  const mer = inversion > 0 ? t.valorVendido / inversion : null

  // ── LTV por cohorte de adquisición ──────────────────────────────────────
  const cohortes = await cohortesLTV(corte)

  return ApiResponse.success(res, {
    desde: iso(desde),
    hasta: iso(corte),
    hayInversionCargada: campanias.length > 0,
    inversion,
    plataformas: [...porPlataforma.entries()]
      .map(([plataforma, gasto]) => ({ plataforma, gasto }))
      .sort((a, b) => b.gasto - a.gasto),
    clientesNuevos: t.clientesNuevos,
    valorVendido: t.valorVendido,
    netoRecibido: t.netoRecibido,
    cac,
    mer,
    campanias: campanias.map(c => ({
      id: c.id, plataforma: c.plataforma, campania: c.campania, estado: c.estado,
      desde: iso(c.desde), hasta: iso(c.hasta),
      gastoCOP: c.gastoCOP, impresiones: c.impresiones, clics: c.clics,
      ctr: c.impresiones > 0 ? c.clics / c.impresiones : null,
      cpc: c.clics > 0 ? c.gastoCOP / c.clics : null,
      conversiones: c.conversiones,
    })),
    cohortes,
  })
}

/** Neto acumulado por cohorte de primera compra, con su LTV. */
async function cohortesLTV(corte: Date) {
  const pagos = await prisma.pago.findMany({
    where: { estado: 'PAGADO', fechaPago: { lte: corte } },
    select: { monto: true, montoNeto: true, fechaPago: true, cuotaNumero: true, estudianteId: true },
    orderBy: { fechaPago: 'asc' },
  })

  const primeraDe = new Map<string, string>()
  for (const p of pagos) {
    if (!esVentaNueva(p)) continue
    const dia = diaColombia(p.fechaPago)
    if (dia && !primeraDe.has(p.estudianteId)) primeraDe.set(p.estudianteId, dia)
  }

  const porCohorte = new Map<string, { clientes: Set<string>; neto: number }>()
  for (const p of pagos) {
    const primera = primeraDe.get(p.estudianteId)
    if (!primera) continue
    const cohorte = primera.slice(0, 7)
    const c = porCohorte.get(cohorte) ?? { clientes: new Set<string>(), neto: 0 }
    c.clientes.add(p.estudianteId)
    c.neto += p.montoNeto ?? 0
    porCohorte.set(cohorte, c)
  }

  return [...porCohorte.entries()]
    .map(([cohorte, c]) => ({
      cohorte,
      clientes: c.clientes.size,
      neto: c.neto,
      ltv: c.clientes.size > 0 ? c.neto / c.clientes.size : 0,
      // Una cohorte necesita tiempo para mostrar su valor real: antes de tres
      // meses el LTV todavía se está formando y compararlo confunde.
      enFormacion: mesesDesde(cohorte, corte) < 3,
    }))
    .sort((a, b) => a.cohorte.localeCompare(b.cohorte))
}

function mesesDesde(cohorte: string, hasta: Date): number {
  const [a, m] = cohorte.split('-').map(Number)
  return (hasta.getFullYear() - a) * 12 + (hasta.getMonth() + 1 - m)
}

/** Alta manual de una campaña, mientras llegan las APIs de las plataformas. */
export async function crearInversion(req: Request, res: Response) {
  const { plataforma, campania, desde, hasta, gastoCOP, impresiones, clics, conversiones, estado } = req.body

  if (!plataforma || !campania || !desde || !hasta || gastoCOP === undefined) {
    return ApiResponse.error(res, 'Faltan plataforma, campaña, período o gasto', 400)
  }

  const registro = await prisma.inversionPublicitaria.create({
    data: {
      plataforma: String(plataforma).toUpperCase(),
      campania: String(campania),
      desde: new Date(String(desde) + 'T00:00:00'),
      hasta: new Date(String(hasta) + 'T23:59:59'),
      gastoCOP: Number(gastoCOP),
      impresiones: Number(impresiones ?? 0),
      clics: Number(clics ?? 0),
      conversiones: Number(conversiones ?? 0),
      estado: estado ? String(estado) : null,
    },
  })
  return ApiResponse.success(res, registro)
}

export async function eliminarInversion(req: Request, res: Response) {
  await prisma.inversionPublicitaria.delete({ where: { id: req.params.id } })
  return ApiResponse.success(res, { eliminado: true })
}

/**
 * Precio observado frente al oficial, tasa de cambio efectiva y cupones.
 */
export async function precioYCambio(req: Request, res: Response) {
  const hoy = new Date()
  const desde = req.query.desde
    ? new Date(String(req.query.desde) + 'T00:00:00')
    : new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const hastaPedido = req.query.hasta
    ? new Date(String(req.query.hasta) + 'T23:59:59.999')
    : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999)
  const corte = hastaPedido < hoy ? hastaPedido : hoy

  const [pagos, cursos] = await Promise.all([
    prisma.pago.findMany({
      where: { estado: 'PAGADO', fechaPago: { gte: desde, lte: corte } },
      select: {
        monto: true, trm: true, fechaPago: true, cupon: true,
        enPartes: true, cuotaNumero: true, cuotasTotal: true,
        estudiante: { select: { cursos: { select: { curso: { select: { id: true, nombre: true, precio: true } } } } } },
      },
    }),
    prisma.curso.findMany({
      select: {
        id: true, nombre: true, precio: true,
        preciosOficiales: { orderBy: { vigenteDesde: 'desc' }, select: { precio: true, vigenteDesde: true } },
      },
    }),
  ])

  // Precio vigente de cada curso a una fecha: la fila más reciente cuya
  // vigencia ya empezó. Sin filas cargadas se usa el precio del curso.
  const vigenteEn = (cursoId: string, fecha: Date): number | null => {
    const c = cursos.find(x => x.id === cursoId)
    if (!c) return null
    const fila = c.preciosOficiales.find(p => p.vigenteDesde <= fecha)
    return fila?.precio ?? c.precio ?? null
  }

  const porCurso = new Map<string, { nombre: string; observados: number[]; oficial: number | null }>()
  const trms: number[] = []
  const cupones = new Map<string, number>()
  let ventasNuevas = 0
  let conCupon = 0

  for (const p of pagos) {
    if (p.trm && p.trm > 0) trms.push(p.trm)
    if (!esVentaNueva(p)) continue

    ventasNuevas++
    // Un cupón vacío o el literal "(none)" que a veces manda Hotmart cuentan
    // como venta sin descuento.
    const cupon = p.cupon?.trim()
    if (cupon && cupon.toLowerCase() !== '(none)') {
      conCupon++
      cupones.set(cupon, (cupones.get(cupon) ?? 0) + 1)
    }

    const curso = p.estudiante.cursos[0]?.curso
    if (!curso) continue

    const acc = porCurso.get(curso.id) ?? {
      nombre: curso.nombre,
      observados: [],
      oficial: vigenteEn(curso.id, p.fechaPago ?? corte),
    }
    // Solo las ventas de contado sirven para leer el precio: una cuota no es
    // el precio del producto.
    if (!p.enPartes) acc.observados.push(p.monto)
    porCurso.set(curso.id, acc)
  }

  const mediana = (xs: number[]): number | null => {
    if (xs.length === 0) return null
    const s = [...xs].sort((a, b) => a - b)
    return s.length % 2 === 1 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
  }

  const productos = [...porCurso.entries()]
    .map(([id, c]) => {
      const observado = mediana(c.observados)
      const desviacion = observado !== null && c.oficial !== null ? observado - c.oficial : null
      return {
        id, nombre: c.nombre,
        ventasContado: c.observados.length,
        precioOficial: c.oficial,
        precioObservado: observado,
        desviacion,
        desviacionPct: desviacion !== null && c.oficial ? desviacion / c.oficial : null,
      }
    })
    .filter(p => p.ventasContado > 0)
    .sort((a, b) => b.ventasContado - a.ventasContado)

  return ApiResponse.success(res, {
    desde: diaColombia(desde),
    hasta: diaColombia(corte),
    productos,
    fueraDePrecio: productos.filter(p => p.desviacion !== null && Math.abs(p.desviacion) > 1000).length,
    trm: {
      promedio: trms.length > 0 ? trms.reduce((s, v) => s + v, 0) / trms.length : null,
      minima: trms.length > 0 ? Math.min(...trms) : null,
      maxima: trms.length > 0 ? Math.max(...trms) : null,
      transacciones: trms.length,
    },
    cupones: {
      ventasNuevas,
      conCupon,
      porcentaje: ventasNuevas > 0 ? conCupon / ventasNuevas : 0,
      masUsados: [...cupones.entries()]
        .map(([codigo, veces]) => ({ codigo, veces }))
        .sort((a, b) => b.veces - a.veces)
        .slice(0, 8),
    },
    // Los precios oficiales con vigencia se administran en Parámetros.
    preciosOficiales: cursos
      .filter(c => c.preciosOficiales.length > 0)
      .map(c => ({
        cursoId: c.id, nombre: c.nombre,
        historial: c.preciosOficiales.map(p => ({ precio: p.precio, vigenteDesde: diaColombia(p.vigenteDesde) })),
      })),
  })
}
