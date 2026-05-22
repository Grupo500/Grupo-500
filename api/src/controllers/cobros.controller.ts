import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'

export async function calendario(req: Request, res: Response) {
  const { fecha, desde, hasta, asesorId } = req.query

  let fechaInicio: Date
  let fechaFin: Date

  if (fecha) {
    fechaInicio = new Date(String(fecha))
    fechaFin = new Date(fechaInicio)
    fechaFin.setDate(fechaFin.getDate() + 1)
  } else {
    fechaInicio = desde ? new Date(String(desde)) : new Date()
    fechaFin = hasta
      ? new Date(String(hasta))
      : new Date(fechaInicio.getTime() + 30 * 24 * 60 * 60 * 1000)
  }

  const filtroAsesor = asesorId ? { asesorId: String(asesorId) } : undefined

  // Cuotas de financiamientos pendientes
  const cuotas = await prisma.cuota.findMany({
    where: {
      fechaVencimiento: { gte: fechaInicio, lt: fechaFin },
      pagado: false,
      financiamiento: { estudiante: filtroAsesor },
    },
    include: {
      financiamiento: {
        include: {
          estudiante: { select: { id: true, nombre: true, telefono: true, acudiente: { select: { nombre: true, telefono: true } }, asesor: { select: { nombre: true } } } },
        },
      },
    },
    orderBy: { fechaVencimiento: 'asc' },
  })

  // Pagos directos pendientes o vencidos
  const pagos = await prisma.pago.findMany({
    where: {
      fechaVencimiento: { gte: fechaInicio, lt: fechaFin },
      estado: { in: ['PENDIENTE', 'VENCIDO'] },
      estudiante: filtroAsesor,
    },
    include: {
      estudiante: { select: { id: true, nombre: true, telefono: true, acudiente: { select: { nombre: true, telefono: true } }, asesor: { select: { nombre: true } } } },
    },
    orderBy: { fechaVencimiento: 'asc' },
  })

  // Estructura unificada de eventos
  type Evento = {
    tipo: 'cuota' | 'pago'
    id: string
    monto: number
    estado: string
    estudiante: { id: string; nombre: string; telefono: string; acudiente?: { nombre: string; telefono: string } | null; asesor?: { nombre: string } | null }
    // cuota
    numero?: number
    financiamientoId?: string
  }

  const agrupado: Record<string, Evento[]> = {}

  const addKey = (key: string, e: Evento) => {
    if (!agrupado[key]) agrupado[key] = []
    agrupado[key].push(e)
  }

  for (const c of cuotas) {
    const key = c.fechaVencimiento.toISOString().split('T')[0]
    addKey(key, {
      tipo: 'cuota',
      id: c.id,
      monto: c.monto,
      estado: 'PENDIENTE',
      estudiante: c.financiamiento.estudiante,
      numero: c.numero,
      financiamientoId: c.financiamientoId,
    })
  }

  for (const p of pagos) {
    const key = p.fechaVencimiento.toISOString().split('T')[0]
    addKey(key, {
      tipo: 'pago',
      id: p.id,
      monto: p.monto,
      estado: p.estado,
      estudiante: p.estudiante,
    })
  }

  return ApiResponse.success(res, agrupado)
}

// Estudiantes con saldo pendiente por cobrar (pagos + cuotas sin pagar)
export async function saldosPendientes(req: Request, res: Response) {
  const hoy = new Date()
  const limit = Number(req.query.limit) || 50

  // Traer en paralelo: pagos pendientes/vencidos y cuotas no pagadas
  const [pagos, cuotas] = await Promise.all([
    prisma.pago.findMany({
      where: { estado: { in: ['PENDIENTE', 'VENCIDO'] } },
      include: {
        estudiante: {
          select: { id: true, nombre: true, telefono: true, asesor: { select: { nombre: true } } },
        },
      },
    }),
    prisma.cuota.findMany({
      where: { pagado: false },
      include: {
        financiamiento: {
          include: {
            estudiante: {
              select: { id: true, nombre: true, telefono: true, asesor: { select: { nombre: true } } },
            },
          },
        },
      },
    }),
  ])

  // Agregar por estudiante
  const mapa = new Map<string, {
    estudianteId: string
    nombre: string
    telefono: string
    asesor: string | null
    totalPendiente: number
    enMora: number
    cuotasPendientes: number
    pagosPendientes: number
  }>()

  for (const p of pagos) {
    const e = p.estudiante
    if (!mapa.has(e.id)) {
      mapa.set(e.id, { estudianteId: e.id, nombre: e.nombre, telefono: e.telefono,
        asesor: e.asesor?.nombre ?? null, totalPendiente: 0, enMora: 0, cuotasPendientes: 0, pagosPendientes: 0 })
    }
    const reg = mapa.get(e.id)!
    reg.totalPendiente += p.monto
    reg.pagosPendientes += 1
    if (p.estado === 'VENCIDO' || (p.fechaVencimiento && new Date(p.fechaVencimiento) < hoy)) {
      reg.enMora += p.monto
    }
  }

  for (const c of cuotas) {
    const e = c.financiamiento.estudiante
    if (!mapa.has(e.id)) {
      mapa.set(e.id, { estudianteId: e.id, nombre: e.nombre, telefono: e.telefono,
        asesor: e.asesor?.nombre ?? null, totalPendiente: 0, enMora: 0, cuotasPendientes: 0, pagosPendientes: 0 })
    }
    const reg = mapa.get(e.id)!
    reg.totalPendiente += c.monto
    reg.cuotasPendientes += 1
    if (new Date(c.fechaVencimiento) < hoy) {
      reg.enMora += c.monto
    }
  }

  // Ordenar por mayor deuda primero y limitar
  const resultado = Array.from(mapa.values())
    .sort((a, b) => b.totalPendiente - a.totalPendiente)
    .slice(0, limit)

  return ApiResponse.success(res, resultado)
}

export async function proximos(req: Request, res: Response) {
  const dias = Number(req.query.dias) || 7
  const now  = new Date()
  const hasta = new Date()
  hasta.setDate(hasta.getDate() + dias)

  // 1. Cuotas de financiamiento pendientes dentro del rango
  const cuotas = await prisma.cuota.findMany({
    where: {
      fechaVencimiento: { gte: now, lte: hasta },
      pagado: false,
    },
    include: {
      financiamiento: {
        include: { estudiante: { include: { acudiente: true } } },
      },
    },
    orderBy: { fechaVencimiento: 'asc' },
    take: 50,
  })

  // 2. Pagos directos (CONTADO) pendientes dentro del rango
  const pagosPendientes = await prisma.pago.findMany({
    where: {
      fechaVencimiento: { gte: now, lte: hasta },
      estado: 'PENDIENTE',
    },
    include: {
      estudiante: { include: { acudiente: true } },
    },
    orderBy: { fechaVencimiento: 'asc' },
    take: 50,
  })

  // 3. Normalizar pagos directos al mismo shape que cuotas
  const pagosNormalizados = pagosPendientes.map(p => ({
    id:               p.id,
    numero:           null,
    monto:            p.monto,
    fechaVencimiento: p.fechaVencimiento,
    pagado:           false,
    _tipo:            'pago' as const,
    financiamiento: {
      estudiante: p.estudiante,
    },
  }))

  // 4. Combinar, ordenar por fecha y limitar a 50
  const combined = [
    ...cuotas.map(c => ({ ...c, _tipo: 'cuota' as const })),
    ...pagosNormalizados,
  ]
    .sort((a, b) => new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime())
    .slice(0, 50)

  return ApiResponse.success(res, combined)
}
