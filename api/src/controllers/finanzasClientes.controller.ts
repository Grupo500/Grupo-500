import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { diaColombia } from '../services/ranking'
import { esVentaNueva, valorContractual } from '../services/finanzas'
import { leerUmbrales } from '../services/finanzasParametros'

/**
 * Matriz RFV: recencia, frecuencia y valor por cliente.
 *
 * Es una foto a la fecha de corte, no un acumulado del mes: la recencia se
 * mide contra ese día. Por eso esta pantalla no lleva selector de mes.
 */
export async function rfvClientes(req: Request, res: Response) {
  const corte = req.query.corte ? new Date(String(req.query.corte) + 'T23:59:59.999') : new Date()
  const u = await leerUmbrales()

  const pagos = await prisma.pago.findMany({
    where: { estado: 'PAGADO', fechaPago: { lte: corte } },
    select: {
      monto: true, montoNeto: true, fechaPago: true,
      enPartes: true, cuotaNumero: true, cuotasTotal: true,
      estudiante: {
        select: {
          id: true, nombre: true, email: true,
          cursos: { select: { curso: { select: { nombre: true, familia: true } } } },
        },
      },
    },
    orderBy: { fechaPago: 'asc' },
  })

  interface Acc {
    id: string; nombre: string; email: string | null
    primera: Date | null; ultima: Date | null
    compras: number; valorVendido: number; neto: number
    productoPrimero: string | null; productoUltimo: string | null
    segunda: Date | null
    productos: Set<string>
  }
  const porCliente = new Map<string, Acc>()

  for (const p of pagos) {
    const e = p.estudiante
    const acc = porCliente.get(e.id) ?? {
      id: e.id, nombre: e.nombre, email: e.email ?? null,
      primera: null, ultima: null, compras: 0, valorVendido: 0, neto: 0,
      productoPrimero: null, productoUltimo: null, segunda: null,
      productos: new Set<string>(),
    }

    // El neto acumulado sí incluye las cuotas: ese dinero entró.
    acc.neto += p.montoNeto ?? 0

    if (esVentaNueva(p)) {
      acc.compras++
      acc.valorVendido += valorContractual(p)
      const producto = e.cursos[0]?.curso.familia ?? e.cursos[0]?.curso.nombre ?? null
      if (producto) acc.productos.add(producto)
      if (!acc.primera) { acc.primera = p.fechaPago; acc.productoPrimero = producto }
      else if (acc.compras === 2) acc.segunda = p.fechaPago
      acc.ultima = p.fechaPago
      acc.productoUltimo = producto
    }

    porCliente.set(e.id, acc)
  }

  const MS_DIA = 86_400_000
  const clientes = [...porCliente.values()]
    .filter(c => c.compras > 0)
    .map(c => {
      const recencia = c.ultima
        ? Math.max(0, Math.floor((corte.getTime() - c.ultima.getTime()) / MS_DIA))
        : 9999
      const antiguedad = c.primera
        ? Math.floor((corte.getTime() - c.primera.getTime()) / MS_DIA)
        : 9999

      const R = recencia <= u.rReciente ? 3 : recencia <= u.rIntermedio ? 2 : 1
      const F = c.compras >= u.fRecurrente + 1 ? 3 : c.compras >= u.fRecurrente ? 2 : 1
      const V = c.neto >= u.vAlto ? 3 : c.neto >= u.vMedio ? 2 : 1

      const recompra = c.compras >= 2
      const ventaCruzada = recompra && c.productos.size > 1

      // El orden importa: quien ya repitió se clasifica por eso antes que por
      // su recencia, y "nuevo" solo aplica a quien todavía no dio señales.
      const segmento =
        ventaCruzada ? 'Clientes con venta cruzada'
        : recompra ? 'Clientes con segunda compra'
        : recencia > u.rInactivo ? 'Clientes inactivos'
        : antiguedad <= u.nuevoDias ? 'Nuevos'
        : 'Clientes con potencial de recompra'

      return {
        id: c.id, nombre: c.nombre, email: c.email,
        primeraCompra: diaColombia(c.primera),
        ultimaCompra: diaColombia(c.ultima),
        recencia, compras: c.compras,
        valorVendido: c.valorVendido, neto: c.neto,
        productoPrimero: c.productoPrimero, productoUltimo: c.productoUltimo,
        diasHastaSegunda: c.segunda && c.primera
          ? Math.floor((c.segunda.getTime() - c.primera.getTime()) / MS_DIA)
          : null,
        recompra, ventaCruzada,
        puntuacion: { R, F, V }, segmento,
      }
    })

  // ── Agregados ───────────────────────────────────────────────────────────
  const porSegmento = new Map<string, { clientes: number; neto: number; valorVendido: number; compras: number; recenciaTotal: number }>()
  for (const c of clientes) {
    const s = porSegmento.get(c.segmento) ?? { clientes: 0, neto: 0, valorVendido: 0, compras: 0, recenciaTotal: 0 }
    s.clientes++; s.neto += c.neto; s.valorVendido += c.valorVendido
    s.compras += c.compras; s.recenciaTotal += c.recencia
    porSegmento.set(c.segmento, s)
  }

  const total = clientes.length
  const conRecompra = clientes.filter(c => c.recompra)
  const conCruzada = clientes.filter(c => c.ventaCruzada)
  const dias = conRecompra.map(c => c.diasHastaSegunda).filter((d): d is number => d !== null).sort((a, b) => a - b)
  const mediana = dias.length > 0
    ? dias.length % 2 === 1 ? dias[(dias.length - 1) / 2] : (dias[dias.length / 2 - 1] + dias[dias.length / 2]) / 2
    : null

  // Histograma de recencia por tramos, con los mismos cortes de los umbrales.
  const tramos = [
    { etiqueta: `0 a ${u.rReciente} días`, desde: 0, hasta: u.rReciente, nombre: 'Reciente' },
    { etiqueta: `${u.rReciente + 1} a ${u.rIntermedio} días`, desde: u.rReciente + 1, hasta: u.rIntermedio, nombre: 'Intermedio' },
    { etiqueta: `${u.rIntermedio + 1} a ${u.rInactivo} días`, desde: u.rIntermedio + 1, hasta: u.rInactivo, nombre: 'En riesgo' },
    { etiqueta: `Más de ${u.rInactivo} días`, desde: u.rInactivo + 1, hasta: Infinity, nombre: 'Inactivo' },
  ].map(t => ({
    ...t,
    hasta: Number.isFinite(t.hasta) ? t.hasta : null,
    clientes: clientes.filter(c => c.recencia >= t.desde && c.recencia <= t.hasta).length,
  }))

  return ApiResponse.success(res, {
    corte: diaColombia(corte),
    umbrales: u,
    totales: {
      clientes: total,
      conRecompra: conRecompra.length,
      tasaRecompra: total > 0 ? conRecompra.length / total : 0,
      conVentaCruzada: conCruzada.length,
      tasaVentaCruzada: conRecompra.length > 0 ? conCruzada.length / conRecompra.length : 0,
      medianaDiasSegundaCompra: mediana,
    },
    segmentos: [...porSegmento.entries()]
      .map(([nombre, s]) => ({
        nombre, ...s,
        porcentaje: total > 0 ? s.clientes / total : 0,
        recenciaPromedio: s.clientes > 0 ? s.recenciaTotal / s.clientes : 0,
      }))
      .sort((a, b) => b.clientes - a.clientes),
    tramosRecencia: tramos,
    // La tabla completa se pagina en el cliente; 2.000 filas livianas viajan
    // bien y evitan un ida y vuelta por cada página.
    clientes: clientes.sort((a, b) => b.neto - a.neto).slice(0, 500),
    totalClientes: total,
  })
}

/** Consolidado de un día concreto, con desglose por producto y por asesor. */
export async function reporteDiario(req: Request, res: Response) {
  const diaQ = req.query.dia ? String(req.query.dia) : diaColombia(new Date())!
  const desde = new Date(`${diaQ}T00:00:00`)
  const hasta = new Date(`${diaQ}T23:59:59.999`)

  const pagos = await prisma.pago.findMany({
    where: { estado: 'PAGADO', fechaPago: { gte: desde, lte: hasta } },
    select: {
      monto: true, montoNeto: true, comisionHotmart: true, comisionAsesor: true,
      enPartes: true, cuotaNumero: true, cuotasTotal: true,
      asesor: { select: { id: true, nombre: true } },
      estudiante: {
        select: {
          id: true,
          cursos: { select: { curso: { select: { nombre: true, familia: true } } } },
        },
      },
    },
  })

  let ventasNuevas = 0, valorVendido = 0, cobrado = 0, neto = 0
  let contado = 0, plazos = 0, cuotasPosteriores = 0, valorCuotas = 0
  const clientes = new Set<string>()
  const porProducto = new Map<string, { ventas: number; valor: number }>()
  const porAsesor = new Map<string, { nombre: string; ventas: number; valor: number }>()

  for (const p of pagos) {
    cobrado += p.monto
    neto += p.montoNeto ?? 0

    if (!esVentaNueva(p)) {
      cuotasPosteriores++
      valorCuotas += p.monto
      continue
    }

    ventasNuevas++
    const valor = valorContractual(p)
    valorVendido += valor
    clientes.add(p.estudiante.id)
    if (p.enPartes && (p.cuotasTotal ?? 1) > 1) plazos++
    else contado++

    const familias = new Set(p.estudiante.cursos.map(c => c.curso.familia ?? 'Otros'))
    const producto = familias.size === 1 ? [...familias][0] : 'Sin clasificar'
    const pr = porProducto.get(producto) ?? { ventas: 0, valor: 0 }
    pr.ventas++; pr.valor += valor
    porProducto.set(producto, pr)

    const clave = p.asesor?.id ?? 'sin-asesor'
    const a = porAsesor.get(clave) ?? { nombre: p.asesor?.nombre ?? 'Sin asignar', ventas: 0, valor: 0 }
    a.ventas++; a.valor += valor
    porAsesor.set(clave, a)
  }

  const parte = (v: number) => (valorVendido > 0 ? v / valorVendido : 0)

  // Días con datos, para que el calendario deshabilite los vacíos.
  const rango = await prisma.pago.aggregate({
    where: { estado: 'PAGADO' },
    _min: { fechaPago: true }, _max: { fechaPago: true },
  })

  return ApiResponse.success(res, {
    dia: diaQ,
    disponible: {
      desde: diaColombia(rango._min.fechaPago ?? null),
      hasta: diaColombia(rango._max.fechaPago ?? null),
    },
    totales: {
      ventasNuevas, valorVendido, cobrado, neto,
      clientes: clientes.size, contado, plazos,
      cuotasPosteriores, valorCuotasPosteriores: valorCuotas,
    },
    productos: [...porProducto.entries()]
      .map(([nombre, v]) => ({ nombre, ...v, participacion: parte(v.valor) }))
      .sort((a, b) => b.valor - a.valor),
    asesores: [...porAsesor.entries()]
      .map(([id, v]) => ({ id, ...v, participacion: parte(v.valor) }))
      .sort((a, b) => b.valor - a.valor),
  })
}
