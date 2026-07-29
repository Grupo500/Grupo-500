import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { diaColombia } from '../services/ranking'
import { esVentaNueva, valorContractual } from '../services/finanzas'

/**
 * Ventas sin dueño y herramientas para resolverlas.
 *
 * Hotmart no siempre atribuye la venta al asesor que la hizo, y cuando el
 * nombre del afiliado no coincide con el correo del perfil la app tampoco
 * puede vincularla. Esas ventas no le suman a nadie en el ranking ni generan
 * comisión, así que hay que poder arreglarlas sin escribirle a Hotmart.
 */
export async function atribucion(_req: Request, res: Response) {
  const [pagos, asesores, alias] = await Promise.all([
    prisma.pago.findMany({
      where: { estado: 'PAGADO', asesorId: null },
      select: {
        id: true, monto: true, fechaPago: true, referenciaPago: true, afiliadoHotmart: true,
        enPartes: true, cuotaNumero: true, cuotasTotal: true,
        estudiante: {
          select: {
            nombre: true, email: true,
            cursos: { select: { curso: { select: { nombre: true } } }, take: 1 },
          },
        },
      },
      orderBy: { fechaPago: 'desc' },
      take: 400,
    }),
    prisma.asesor.findMany({ select: { id: true, nombre: true, email: true }, orderBy: { nombre: 'asc' } }),
    prisma.aliasAsesor.findMany({ include: { asesor: { select: { nombre: true } } }, orderBy: { alias: 'asc' } }),
  ])

  const totalPagos = await prisma.pago.count({ where: { estado: 'PAGADO' } })

  // Agrupar por nombre de afiliado: si veinte ventas vienen del mismo nombre
  // mal escrito, se arreglan de una sola vez creando el alias.
  const porAfiliado = new Map<string, { pagos: number; valor: number }>()
  for (const p of pagos) {
    if (!p.afiliadoHotmart) continue
    const g = porAfiliado.get(p.afiliadoHotmart) ?? { pagos: 0, valor: 0 }
    g.pagos++
    g.valor += esVentaNueva(p) ? valorContractual(p) : p.monto
    porAfiliado.set(p.afiliadoHotmart, g)
  }

  return ApiResponse.success(res, {
    resumen: {
      sinAsesor: pagos.length,
      totalPagos,
      porcentaje: totalPagos > 0 ? pagos.length / totalPagos : 0,
      conNombre: [...porAfiliado.values()].reduce((s, g) => s + g.pagos, 0),
      sinNombre: pagos.filter(p => !p.afiliadoHotmart).length,
    },
    // Nombres que se pueden homologar de una vez
    afiliadosPorHomologar: [...porAfiliado.entries()]
      .map(([nombre, g]) => ({ nombre, ...g }))
      .sort((a, b) => b.pagos - a.pagos),
    alias: alias.map(a => ({ alias: a.alias, asesorId: a.asesorId, asesor: a.asesor.nombre })),
    asesores,
    pagos: pagos.map(p => ({
      id: p.id,
      fecha: diaColombia(p.fechaPago),
      referencia: p.referenciaPago,
      monto: p.monto,
      afiliado: p.afiliadoHotmart,
      estudiante: p.estudiante.nombre,
      email: p.estudiante.email,
      curso: p.estudiante.cursos[0]?.curso.nombre ?? null,
    })),
  })
}

/** Asigna un asesor a un pago suelto. */
export async function asignarAsesor(req: Request, res: Response) {
  const { pagoId, asesorId } = req.body
  if (!pagoId || !asesorId) return ApiResponse.error(res, 'Faltan el pago o el asesor', 400)

  const pago = await prisma.pago.update({
    where: { id: String(pagoId) },
    data: { asesorId: String(asesorId) },
    select: { id: true, asesorId: true, estudianteId: true },
  })

  // Si el estudiante tampoco tenía asesor, hereda el de esta venta. No se pisa
  // si ya tenía uno: el estudiante puede ser de otro asesor y esta venta no lo
  // cambia.
  await prisma.estudiante.updateMany({
    where: { id: pago.estudianteId, asesorId: null },
    data: { asesorId: String(asesorId) },
  })

  return ApiResponse.success(res, pago)
}

/**
 * Crea la homologación de un nombre de afiliado y, de paso, asigna todas las
 * ventas huérfanas que traían ese nombre.
 */
export async function homologarAfiliado(req: Request, res: Response) {
  const { nombre, asesorId } = req.body
  if (!nombre || !asesorId) return ApiResponse.error(res, 'Faltan el nombre o el asesor', 400)

  const clave = String(nombre).trim().toLowerCase()

  await prisma.aliasAsesor.upsert({
    where: { alias: clave },
    create: { alias: clave, asesorId: String(asesorId) },
    update: { asesorId: String(asesorId) },
  })

  const asignados = await prisma.pago.updateMany({
    where: { estado: 'PAGADO', asesorId: null, afiliadoHotmart: { equals: String(nombre).trim(), mode: 'insensitive' } },
    data: { asesorId: String(asesorId) },
  })

  return ApiResponse.success(res, { alias: clave, pagosAsignados: asignados.count })
}

export async function eliminarAlias(req: Request, res: Response) {
  await prisma.aliasAsesor.delete({ where: { alias: req.params.alias } })
  return ApiResponse.success(res, { eliminado: true })
}
