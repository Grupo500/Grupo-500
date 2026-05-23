import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse, parsePagination } from '../utils/response'
import { NotFoundError } from '../utils/errors'
import { auditLog } from '../utils/auditLogger'
import { broadcast } from '../utils/sseManager'
import { z } from 'zod'
import * as XLSX from 'xlsx'

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
  metodoPago: z.string().min(1).optional(),
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
    // VENDEDOR solo ve sus propios estudiantes; ADMIN puede ver todos y filtrar por asesor
    ...(!isAdmin && req.asesorId ? { asesorId: req.asesorId } : {}),
    ...(isAdmin && asesorId    ? { asesorId: String(asesorId) } : {}),
    ...(nombre    && { nombre:    { contains: String(nombre),    mode: 'insensitive' as const } }),
    ...(colegioId && { colegioId: String(colegioId) }),
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
            metodo:          data.metodoPago ?? 'Bancolombia',
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
  agregado:            z.boolean().optional(),
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
      // Solo ADMIN puede reasignar el asesor de un estudiante
      ...(isAdmin && data.asesorId !== undefined && { asesorId: data.asesorId }),
      ...(isAdmin && data.lineaAutorizada !== undefined && { lineaAutorizada: data.lineaAutorizada }),
      ...(data.agregado !== undefined && { agregado: data.agregado }),
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

  // Admin y vendedor pueden modificar curso y descuento
  if (data.cursoId !== undefined) {
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

/* ─── Importar estudiantes desde Excel ────────────────────────────────────── */

// Normaliza texto: trim + lowercase para comparaciones
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase()

// Convierte número de serie Excel a Date (días desde 1900-01-01)
function excelDateToDate(serial: number): Date | null {
  if (!serial || isNaN(serial)) return null
  // Excel tiene un bug histórico donde 1900 era bisiesto — compensar
  const msPerDay = 86400000
  const date = new Date((serial - 25569) * msPerDay)
  if (isNaN(date.getTime())) return null
  return date
}

// Parsea una celda que puede ser string "dd/mm/yyyy", número serial Excel, o Date
function parseExcelDate(val: unknown): Date | null {
  if (!val) return null
  if (typeof val === 'number') return excelDateToDate(val)
  if (val instanceof Date) return val
  const str = String(val).trim()
  // dd/mm/yyyy o dd-mm-yyyy
  const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3]
    return new Date(`${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`)
  }
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

// Normaliza el método de pago a los valores válidos del sistema
const METODOS_VALIDOS = ['Bancolombia', 'Bre-B', 'Nequi']
function parseMetodo(val: unknown): string {
  const v = String(val ?? '').trim()
  return METODOS_VALIDOS.find(m => m.toLowerCase() === v.toLowerCase()) ?? 'Otro'
}

interface ImportRow {
  fecha?:         string
  asesor?:        string
  linea?:         number
  curso?:         string
  nombre:         string
  tipoDocumento?: string
  documento?:     string
  email?:         string
  telefono:       string
  abono?:         number
  valorCurso?:    number
  valorPagado?:   number
  total?:         number
  metodoPago?:    string
  referencia?:    string
  fechaPago?:     string
  estado?:        string
  agregado?:      boolean
}

export async function plantillaImport(_req: Request, res: Response) {
  const wb = XLSX.utils.book_new()

  const encabezados = [
    'Nombre Alumno', 'Tipo Documento', 'Número Documento', 'Email',
    'Número', 'Curso', 'Asesor', 'Línea',
    'Abono', 'Valor Curso', 'Método Pago', 'Fecha Pago', 'Agregado',
  ]

  const ws = XLSX.utils.aoa_to_sheet([encabezados])

  // Ancho de columnas
  ws['!cols'] = [
    { wch: 30 }, { wch: 16 }, { wch: 18 }, { wch: 28 },
    { wch: 16 }, { wch: 24 }, { wch: 20 }, { wch: 20 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  res.setHeader('Content-Disposition', 'attachment; filename="plantilla-importacion-grupo500.xlsx"')
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buffer)
}

export async function importar(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No se recibió ningún archivo Excel.' })
  }

  // 1. Leer el archivo
  const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: false })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  if (rawRows.length === 0) {
    return res.status(400).json({ success: false, error: 'El archivo está vacío o no tiene filas de datos.' })
  }

  // 2. Normalizar cabeceras (case-insensitive)
  const normalize = (rows: Record<string, unknown>[]): ImportRow[] =>
    rows.map(r => {
      const get = (keys: string[]) => {
        for (const k of Object.keys(r)) {
          if (keys.some(key => norm(k).includes(norm(key)))) return r[k]
        }
        return ''
      }
      return {
        fecha:         String(get(['fecha']) ?? '').trim(),
        asesor:        String(get(['asesor']) ?? '').trim(),
        linea:         (() => { const v = String(get(['linea', 'línea']) ?? ''); const m = v.match(/\d+/); return m ? Number(m[0]) : undefined })(),
        curso:         String(get(['curso']) ?? '').trim(),
        nombre:        String(get(['nombre', 'alumno', 'estudiante']) ?? '').trim(),
        tipoDocumento: String(get(['tipo documento', 'tipo_documento', 'tipo doc']) ?? '').trim() || undefined,
        documento:     String(get(['número documento', 'numero documento', 'documento']) ?? '').trim() || undefined,
        email:         String(get(['email', 'correo']) ?? '').trim() || undefined,
        telefono:      String(get(['número', 'numero', 'telefono', 'teléfono', 'cel']) ?? '').trim(),
        abono:         Number(String(get(['abono']) ?? '').replace(/[^0-9.]/g, '')) || undefined,
        valorCurso:    Number(String(get(['valor curso', 'valor_curso']) ?? '').replace(/[^0-9.]/g, '')) || undefined,
        valorPagado:   Number(String(get(['valor pagado', 'valor_pagado', 'pagado']) ?? '').replace(/[^0-9.]/g, '')) || undefined,
        total:         Number(String(get(['total']) ?? '').replace(/[^0-9.]/g, '')) || undefined,
        metodoPago:    String(get(['método', 'metodo', 'método pago', 'metodo pago']) ?? '').trim(),
        referencia:    String(get(['referencia', 'ref']) ?? '').trim(),
        fechaPago:     get(['fecha pago', 'fecha_pago']) as any,
        estado:        String(get(['estado']) ?? '').trim(),
        agregado:      (() => { const v = norm(get(['agregado'])); return v === 'si' || v === 'sí' })(),
      }
    }).filter(r => r.nombre.length >= 2)   // descartar filas vacías

  const rows = normalize(rawRows)

  if (rows.length === 0) {
    return res.status(400).json({ success: false, error: 'No se encontraron filas válidas. Verifica que el archivo tenga la columna "Nombre Alumno".' })
  }

  // 3. Pre-cargar catálogos para evitar N+1
  const [cursosDB, asesoresDB] = await Promise.all([
    prisma.curso.findMany({ select: { id: true, nombre: true, precio: true } }),
    prisma.asesor.findMany({ select: { id: true, nombre: true } }),
  ])

  const findCurso = (name: string) =>
    cursosDB.find(c => norm(c.nombre) === norm(name) || norm(c.nombre).includes(norm(name)))

  const findAsesor = (name: string) =>
    asesoresDB.find(a => norm(a.nombre) === norm(name) || norm(a.nombre).includes(norm(name)))

  // 4. Agrupar filas por teléfono (identificador principal)
  const grouped = new Map<string, ImportRow[]>()
  for (const row of rows) {
    const key = row.telefono || norm(row.nombre)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(row)
  }

  const resultados: { nombre: string; accion: 'creado' | 'actualizado' | 'existente'; pagos: number; error?: string }[] = []

  // 5. Procesar cada estudiante
  for (const [, studentRows] of grouped) {
    const first = studentRows[0]

    try {
      const cursoObj = first.curso ? findCurso(first.curso) : null
      const asesorObj = first.asesor ? findAsesor(first.asesor) : null

      // Construir email ficticio si no viene (requerido por el schema)
      const tel = first.telefono.replace(/\D/g, '').slice(-10)
      const emailFallback = `${tel || norm(first.nombre).replace(/\s+/g, '.')}@importado.grupo500`

      // ¿Ya existe el estudiante? Buscar por teléfono, email ficticio o nombre (fallback)
      let estudiante = await prisma.estudiante.findFirst({
        where: {
          OR: [
            ...(first.telefono ? [{ telefono: first.telefono }] : []),
            { email: emailFallback },
            { nombre: { equals: first.nombre, mode: 'insensitive' as const } },
          ],
        },
      })

      let accion: 'creado' | 'actualizado' | 'existente' = 'existente'

      // Datos comunes para crear o actualizar
      const datosEstudiante = {
        nombre:        first.nombre,
        telefono:      first.telefono || '0000000000',
        ...(first.email         && { email:         first.email }),
        ...(first.tipoDocumento && { tipoDocumento: first.tipoDocumento }),
        ...(first.documento     && { documento:     first.documento }),
        ...(asesorObj           && { asesorId:      asesorObj.id }),
        ...(first.linea         && { lineaAutorizada: first.linea }),
        ...(first.agregado !== undefined && { agregado: first.agregado }),
      }

      if (!estudiante) {
        accion = 'creado'
        estudiante = await prisma.estudiante.create({
          data: {
            ...datosEstudiante,
            email:           first.email || emailFallback,
            fechaNacimiento: new Date('2000-01-01'),
            tipoDocumento:   first.tipoDocumento || 'CC',
          },
        })
      } else {
        accion = 'actualizado'
        estudiante = await prisma.estudiante.update({
          where: { id: estudiante.id },
          data:  datosEstudiante,
        })
      }

      // Vincular o actualizar curso
      if (cursoObj) {
        // Reemplazar curso anterior si existe uno diferente
        await prisma.cursoEstudiante.deleteMany({
          where: { estudianteId: estudiante.id, NOT: { cursoId: cursoObj.id } },
        })
        await prisma.cursoEstudiante.upsert({
          where:  { estudianteId_cursoId: { estudianteId: estudiante.id, cursoId: cursoObj.id } },
          update: {},
          create: { estudianteId: estudiante.id, cursoId: cursoObj.id, descuentoPorcentaje: 0 },
        })
      }

      // 6. Crear pagos para filas con abono > 0
      let pagosCreados = 0
      for (const row of studentRows) {
        const abono = row.abono ?? row.valorPagado ?? 0
        if (abono <= 0) continue

        const fechaPagoDate = parseExcelDate(row.fechaPago) ?? parseExcelDate(row.fecha) ?? new Date()
        const valorCurso = row.valorCurso ?? 0
        const metodo = parseMetodo(row.metodoPago)
        const baseData = {
          estudianteId:     estudiante.id,
          metodo,
          ...(row.referencia && { comprobante: row.referencia }),
          ...(asesorObj      && { asesorId: asesorObj.id }),
        }

        if (valorCurso > 0 && abono < valorCurso) {
          // Pago parcial: registrar abono como PAGADO + saldo restante como PENDIENTE
          await prisma.pago.create({
            data: { ...baseData, monto: abono, estado: 'PAGADO', fechaVencimiento: fechaPagoDate, fechaPago: fechaPagoDate },
          })
          await prisma.pago.create({
            data: { ...baseData, monto: valorCurso - abono, estado: 'PENDIENTE', fechaVencimiento: fechaPagoDate },
          })
          pagosCreados += 2
        } else {
          // Abono cubre el total o no hay precio de curso → un solo pago PAGADO
          await prisma.pago.create({
            data: { ...baseData, monto: abono, estado: 'PAGADO', fechaVencimiento: fechaPagoDate, fechaPago: fechaPagoDate },
          })
          pagosCreados++
        }
      }

      resultados.push({ nombre: first.nombre, accion, pagos: pagosCreados })
    } catch (err: any) {
      resultados.push({ nombre: first.nombre, accion: 'creado', pagos: 0, error: err.message ?? 'Error desconocido' })
    }
  }

  const creados      = resultados.filter(r => r.accion === 'creado'      && !r.error).length
  const actualizados = resultados.filter(r => r.accion === 'actualizado' && !r.error).length
  const errores      = resultados.filter(r => r.error).length
  const totalPagos   = resultados.reduce((s, r) => s + r.pagos, 0)

  broadcast('estudiante-asignado', { tipo: 'importacion-masiva' })

  return ApiResponse.success(res, {
    resumen: { totalFilas: rows.length, estudiantesCreados: creados, estudiantesActualizados: actualizados, pagosCreados: totalPagos, errores },
    detalles: resultados,
  })
}
