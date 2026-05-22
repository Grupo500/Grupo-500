import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse, parsePagination } from '../utils/response'
import { NotFoundError } from '../utils/errors'
import { auditLog } from '../utils/auditLogger'
import { broadcast } from '../utils/sseManager'
import { z } from 'zod'

const crearSchema = z.object({
  nombre: z.string().min(2),
  tipoDocumento: z.enum(['CC', 'TI', 'CE', 'PA', 'RC']).optional(),
  documento: z.string().optional(),
  email: z.string().email(),
  telefono: z.string().min(7),
  fechaNacimiento: z.string(),
  departamento: z.string().optional(),
  ciudad: z.string().optional(),
  colegioId: z.string().optional(),
  cursoId: z.string().optional(),
  descuentoPorcentaje: z.number().min(0).max(100).optional(),
  // Pago integrado
  formaPago: z.enum(['CONTADO', 'FINANCIADO']).optional(),
  metodoPago: z.enum(['TRANSFERENCIA', 'TARJETA', 'EFECTIVO', 'OTRO']).optional(),
  fechaPago: z.string().optional(),
  comprobante: z.string().optional(),
  numeroCuotas: z.number().int().min(1).max(24).optional(),
  fechaPrimeraCuota: z.string().optional(),
  lineaAutorizada: z.number().int().min(1).max(6).optional(),
  acudiente: z.object({
    nombre: z.string().min(2),
    email: z.string().email(),
    telefono: z.string().min(7),
    relacion: z.string(),
  }).optional(),
})

export async function listar(req: Request, res: Response) {
  const { nombre, colegioId, asesorId } = req.query
  const { page, limit, skip } = parsePagination(req.query)
  const isAdmin = req.userRole === 'ADMIN'

  const where = {
    // Todos los roles ven todos los estudiantes; solo admin puede filtrar por asesorId
    ...(nombre && { nombre: { contains: String(nombre), mode: 'insensitive' as const } }),
    ...(colegioId && { colegioId: String(colegioId) }),
    ...(isAdmin && asesorId && { asesorId: String(asesorId) }),
  }

  const [estudiantes, total] = await Promise.all([
    prisma.estudiante.findMany({
      where,
      include: {
        colegio: true,
        acudiente: true,
        asesor: true,
        cursos: { include: { curso: true } },
        pagos: { select: { monto: true, estado: true, fechaVencimiento: true } },
        financiamientos: {
          select: {
            montoTotal: true,
            estado: true,
            cuotas: { select: { monto: true, pagado: true, fechaVencimiento: true } },
          },
        },
      },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.estudiante.count({ where }),
  ])

  return ApiResponse.paginated(res, estudiantes, total, page, limit)
}

export async function crear(req: Request, res: Response) {
  const data = crearSchema.parse(req.body)

  const estudiante = await prisma.$transaction(async (tx) => {
    // 1. Crear estudiante
    const est = await tx.estudiante.create({
      data: {
        nombre:         data.nombre,
        tipoDocumento:  data.tipoDocumento ?? 'CC',
        documento:      data.documento ?? null,
        email:          data.email,
        telefono:       data.telefono,
        fechaNacimiento: new Date(data.fechaNacimiento),
        ...(data.departamento && { departamento: data.departamento }),
        ...(data.ciudad       && { ciudad:       data.ciudad }),
        ...(data.colegioId    && { colegioId:    data.colegioId }),
        ...(req.asesorId      && { asesorId:     req.asesorId }),
        ...(data.acudiente    && { acudiente: { create: data.acudiente } }),
      },
      include: { acudiente: true, colegio: true },
    })

    // 2. Vincular curso con descuento
    if (data.cursoId) {
      await tx.cursoEstudiante.create({
        data: {
          estudianteId:       est.id,
          cursoId:            data.cursoId,
          descuentoPorcentaje: data.descuentoPorcentaje ?? 0,
        },
      })
    }

    // 3. Registrar pago o financiamiento
    if (data.cursoId && data.formaPago) {
      const curso = await tx.curso.findUnique({ where: { id: data.cursoId } })
      if (!curso) throw new Error('Curso no encontrado')

      const montoFinal = Number(
        (curso.precio * (1 - (data.descuentoPorcentaje ?? 0) / 100)).toFixed(2)
      )

      if (data.formaPago === 'CONTADO') {
        const fechaPago = data.fechaPago ? new Date(data.fechaPago) : new Date()
        await tx.pago.create({
          data: {
            estudianteId:    est.id,
            monto:           montoFinal,
            estado:          'PAGADO',
            metodo:          data.metodoPago ?? 'TRANSFERENCIA',
            fechaPago,
            fechaVencimiento: fechaPago,
            ...(data.comprobante && { comprobante: data.comprobante }),
            ...(req.asesorId     && { asesorId:    req.asesorId }),
          },
        })
      } else if (data.formaPago === 'FINANCIADO' && data.numeroCuotas && data.fechaPrimeraCuota) {
        const montoCuota = Number((montoFinal / data.numeroCuotas).toFixed(2))
        const fechaBase  = new Date(data.fechaPrimeraCuota)

        await tx.financiamiento.create({
          data: {
            estudianteId: est.id,
            montoTotal:   montoFinal,
            cuotas: {
              create: Array.from({ length: data.numeroCuotas }, (_, i) => {
                const fecha = new Date(fechaBase)
                fecha.setMonth(fecha.getMonth() + i)
                return { numero: i + 1, monto: montoCuota, fechaVencimiento: fecha }
              }),
            },
          },
        })
      }
    }

    return est
  })

  auditLog(req, 'CREATE', 'estudiante', estudiante.id)
  broadcast('estudiante-asignado', { estudianteId: estudiante.id })
  return ApiResponse.created(res, estudiante)
}

export async function obtener(req: Request, res: Response) {
  const estudiante = await prisma.estudiante.findUnique({
    where: { id: req.params.id },
    include: {
      colegio: true,
      acudiente: true,
      asesor: true,
      cursos: { include: { curso: true } },
      pagos: { orderBy: { createdAt: 'desc' } },
      financiamientos: { include: { cuotas: { orderBy: { numero: 'asc' } } } },
      certificados: true,
    },
  })

  if (!estudiante) throw new NotFoundError('Estudiante no encontrado')

  // Auto-corregir financiamientos ACTIVO cuyas cuotas ya están todas pagadas
  const finSinCerrar = estudiante.financiamientos.filter(
    f => f.estado === 'ACTIVO' && f.cuotas.length > 0 && f.cuotas.every(c => c.pagado)
  )
  if (finSinCerrar.length > 0) {
    await Promise.all(
      finSinCerrar.map(f =>
        prisma.financiamiento.update({ where: { id: f.id }, data: { estado: 'COMPLETADO' } })
      )
    )
    finSinCerrar.forEach(f => { f.estado = 'COMPLETADO' })
  }

  return ApiResponse.success(res, estudiante)
}

// Normaliza valores de tipoDocumento que vengan en formato largo (datos legacy)
const tipoDocSchema = z.preprocess((val) => {
  const map: Record<string, string> = {
    'Cédula de Ciudadanía': 'CC', 'Cedula de Ciudadania': 'CC',
    'Tarjeta de Identidad': 'TI', 'Tarjeta de Identidad (TI)': 'TI',
    'Cédula de Extranjería': 'CE', 'Cedula de Extranjeria': 'CE',
    'Pasaporte': 'PA', 'Registro Civil': 'RC',
  }
  if (typeof val === 'string' && map[val]) return map[val]
  return val
}, z.enum(['CC', 'TI', 'CE', 'PA', 'RC']))

const actualizarSchema = z.object({
  nombre:              z.string().min(2).optional(),
  tipoDocumento:       tipoDocSchema.optional(),
  documento:           z.string().nullable().optional(),
  email:               z.string().email().optional(),
  telefono:            z.string().min(7).optional(),
  fechaNacimiento:     z.string().optional(),
  departamento:        z.string().nullable().optional(),
  ciudad:              z.string().nullable().optional(),
  colegioId:           z.string().nullable().optional(),
  asesorId:            z.string().nullable().optional(),
  // Solo admin
  cursoId:             z.string().nullable().optional(),
  descuentoPorcentaje: z.number().min(0).max(101).optional(), // 101 para tolerar fp
  lineaAutorizada:     z.number().int().min(1).max(6).nullable().optional(),
  // Acudiente (opcional, se actualiza si se envían los campos)
  acudiente: z.object({
    nombre:   z.string().min(2),
    email:    z.string().email().optional().nullable(),
    telefono: z.string().min(7),
    relacion: z.string(),
  }).optional(),
})

export async function actualizar(req: Request, res: Response) {
  const data = actualizarSchema.parse(req.body)
  const isAdmin = req.userRole === 'ADMIN'
  const estudianteId = req.params.id

  // Actualizar campos del estudiante
  const estudiante = await prisma.estudiante.update({
    where: { id: estudianteId },
    data: {
      ...(data.nombre          !== undefined && { nombre:          data.nombre }),
      ...(data.tipoDocumento   !== undefined && { tipoDocumento:   data.tipoDocumento }),
      ...(data.documento       !== undefined && { documento:       data.documento }),
      ...(data.email           !== undefined && { email:           data.email }),
      ...(data.telefono        !== undefined && { telefono:        data.telefono }),
      ...(data.fechaNacimiento !== undefined && { fechaNacimiento: new Date(data.fechaNacimiento) }),
      ...(data.departamento    !== undefined && { departamento:    data.departamento }),
      ...(data.ciudad          !== undefined && { ciudad:          data.ciudad }),
      ...(data.colegioId        !== undefined && { colegioId:        data.colegioId }),
      ...(data.asesorId         !== undefined && { asesorId:         data.asesorId }),
      ...(isAdmin && data.lineaAutorizada !== undefined && { lineaAutorizada: data.lineaAutorizada }),
    },
    include: { colegio: true, acudiente: true, asesor: true, cursos: { include: { curso: true } } },
  })

  // Actualizar acudiente si viene en el body
  if (data.acudiente) {
    await prisma.acudiente.upsert({
      where:  { estudianteId },
      update: { ...data.acudiente },
      create: { estudianteId, ...data.acudiente },
    })
  }

  // Solo admin puede modificar curso y descuento
  if (isAdmin && data.cursoId !== undefined) {
    // Eliminar cursos existentes y crear el nuevo (un curso activo por estudiante)
    await prisma.cursoEstudiante.deleteMany({ where: { estudianteId } })
    if (data.cursoId) {
      await prisma.cursoEstudiante.create({
        data: {
          estudianteId,
          cursoId: data.cursoId,
          descuentoPorcentaje: data.descuentoPorcentaje ?? 0,
        },
      })
    }
    // Recargar con cursos actualizados
    const actualizado = await prisma.estudiante.findUnique({
      where: { id: estudianteId },
      include: { colegio: true, acudiente: true, asesor: true, cursos: { include: { curso: true } } },
    })
    // Registrar historial (este branch no caía aquí antes)
    await prisma.historialEstudiante.create({
      data: {
        estudianteId,
        accion: 'UPDATE_PERFIL',
        descripcion: 'Perfil del estudiante actualizado',
        cambios: data as any,
        realizadoPor: req.userName ?? req.userId ?? 'Sistema',
        userId: req.userId ?? 'sistema',
      },
    })
    broadcast('estudiante-asignado', { estudianteId })
    return ApiResponse.success(res, actualizado)
  }

  // Registrar en historial
  await prisma.historialEstudiante.create({
    data: {
      estudianteId,
      accion: 'UPDATE_PERFIL',
      descripcion: 'Perfil del estudiante actualizado',
      cambios: data as any,
      realizadoPor: req.userName ?? req.userId ?? 'Sistema',
      userId: req.userId ?? 'sistema',
    },
  })

  // Si se cambió el asesorId, notificar en tiempo real
  if (data.asesorId !== undefined) {
    broadcast('estudiante-asignado', { estudianteId })
  }

  return ApiResponse.success(res, estudiante)
}

export async function eliminar(req: Request, res: Response) {
  await prisma.estudiante.delete({ where: { id: req.params.id } })
  auditLog(req, 'DELETE', 'estudiante', req.params.id)
  return ApiResponse.noContent(res)
}

export async function rendimiento(req: Request, res: Response) {
  const simulacros = await prisma.simulacroEstudiante.findMany({
    where: { estudianteId: req.params.id },
    include: { simulacro: true },
    orderBy: { fechaAnalisis: 'desc' },
  })
  return ApiResponse.success(res, simulacros)
}

export async function historial(req: Request, res: Response) {
  const registros = await prisma.historialEstudiante.findMany({
    where: { estudianteId: req.params.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return ApiResponse.success(res, registros)
}
