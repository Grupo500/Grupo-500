import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import multer from 'multer'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import { v2 as cloudinary } from 'cloudinary'
import { prisma } from '../config/prisma'
import { asyncHandler } from '../middleware/errorHandler'
import { ApiResponse } from '../utils/response'
import { broadcast } from '../utils/sseManager'
import { logger } from '../utils/logger'

const router = Router()

// ── Cloudinary config (reutiliza las vars de entorno ya configuradas) ─────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// ── Storage para documentos y comprobantes públicos ───────────────────────────
const documentoStorage = new CloudinaryStorage({
  cloudinary,
  params: async (_req: any, file: any) => {
    const isPdf = file.mimetype === 'application/pdf'
    return {
      folder:          'grupo500/documentos',
      resource_type:   isPdf ? 'raw' : 'image',
      use_filename:    true,
      unique_filename: true,
    }
  },
})

const comprobanteStorage = new CloudinaryStorage({
  cloudinary,
  params: async (_req: any, file: any) => {
    const isPdf = file.mimetype === 'application/pdf'
    return {
      folder:          'grupo500/comprobantes',
      resource_type:   isPdf ? 'auto' : 'image',
      use_filename:    true,
      unique_filename: true,
      ...(isPdf ? { format: 'pdf' } : {}),
    }
  },
})

const ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf',
])
function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (ALLOWED_MIMES.has(file.mimetype)) return cb(null, true)
  cb(new Error('Solo se permiten imágenes (JPG, PNG, WebP) o PDF.'))
}

const uploadDocumento    = multer({ storage: documentoStorage,    fileFilter, limits: { fileSize: 10 * 1024 * 1024 } })
const uploadComprobante  = multer({ storage: comprobanteStorage,  fileFilter, limits: { fileSize: 10 * 1024 * 1024 } })

// ── Helper: multer wrapper sin auth ──────────────────────────────────────────
function multerMiddleware(upload: multer.Multer) {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err: any) => {
      if (err) return res.status(400).json({ success: false, error: err.message ?? 'Error al subir archivo' })
      next()
    })
  }
}

// ── Helper: OCR del comprobante con Cloudinary ────────────────────────────────
async function intentarOCR(publicId: string, montoDeclarado: number): Promise<string> {
  if (!process.env.CLOUDINARY_CLOUD_NAME) return 'Sin configuración Cloudinary'
  try {
    const result = await cloudinary.api.resource(publicId, { ocr: 'adv_ocr' }) as any
    const texto: string = result?.info?.ocr?.adv_ocr?.data?.[0]?.full_text_annotation?.text ?? ''
    if (!texto) return 'Comprobante adjunto — verificación manual pendiente'

    // Buscar montos en el texto: 600.000 / 600,000 / $600000
    const matches = texto.match(/[\$]?\s*(\d{1,3}(?:[.,]\d{3})+)/g) ?? []
    const montos = matches
      .map(m => parseInt(m.replace(/[^0-9]/g, ''), 10))
      .filter(n => n >= 50000)  // ignorar números pequeños

    if (montos.length === 0) return 'Comprobante adjunto — monto no detectado, verificación manual pendiente'

    const montoDetectado = Math.max(...montos)
    const diferencia     = Math.abs(montoDetectado - montoDeclarado) / montoDeclarado

    if (diferencia <= 0.05) {
      return `Comprobante verificado por OCR. Monto detectado: $${montoDetectado.toLocaleString('es-CO')}`
    }
    return `⚠️ Monto declarado: $${montoDeclarado.toLocaleString('es-CO')} — OCR detectó: $${montoDetectado.toLocaleString('es-CO')} — revisar manualmente`
  } catch (err: any) {
    logger.warn({ err }, '[OCR] Error leyendo comprobante — omitiendo')
    return 'Comprobante adjunto — verificación manual pendiente'
  }
}

// ── Helper: parsear monto ─────────────────────────────────────────────────────
function parseMonto(raw: unknown): number {
  if (!raw) return 0
  const limpio = String(raw).replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.]/g, '')
  const n = parseFloat(limpio)
  return isNaN(n) ? 0 : Math.round(n)
}

// ── Zod schema de inscripción ─────────────────────────────────────────────────
const METODOS_PAGO = ['Bancolombia', 'Interbancario', 'Nequi', 'Bre-B', 'Addi', 'Sistecredito', 'Otro'] as const

const inscripcionSchema = z.object({
  // Paso 1 — Estudiante
  nombre:          z.string().min(3),
  email:           z.string().email(),
  telefono:        z.string().min(7),
  tipoDocumento:   z.enum(['CC', 'TI', 'CE', 'PA', 'Otro']).default('TI'),
  documento:       z.string().min(4),
  // Paso 2 — Ubicación
  fechaNacimiento: z.string(),
  departamento:    z.string().min(2),
  ciudad:          z.string().min(2),
  colegio:         z.string().min(2),
  grado:           z.string(),
  // Paso 3 — Acudiente
  acudienteNombre:          z.string().min(3),
  acudienteParentesco:      z.string().min(2),
  acudienteEmail:           z.string().email().optional(),
  acudienteTelefono:        z.string().min(7),
  acudienteTipoDocumento:   z.string().optional(),
  acudienteNumeroDocumento: z.string().optional(),
  // Paso 4 — Académico
  primerIcfes:     z.boolean(),
  puntajeAnterior: z.string().optional(),
  carreraInteres:  z.string().optional(),
  // Paso 5 — Curso + Pago
  cursoId:         z.string().min(1, 'Selecciona un curso'),
  metodoPago:      z.enum(METODOS_PAGO),
  referenciaPago:  z.string().min(1, 'Ingresa la referencia de pago'),
  comprobanteUrl:  z.string().url('El comprobante es obligatorio'),
  comprobantePublicId: z.string().optional(),
  documentoUrl:    z.string().url().optional().or(z.literal('')),
  // Paso 6 — Marketing + T&C
  fuenteContacto:  z.string().optional(),
  aceptaTerminos:  z.boolean(),
  // Hidden / automáticos
  asesorId:        z.string().optional(),
  formularioId:    z.string().optional(),
})

// ── GET /api/inscripcion/formularios-activos ──────────────────────────────────
// Público — formularios activos y visibles en landing
router.get('/formularios-activos', asyncHandler(async (_req, res) => {
  const formularios = await prisma.formulario.findMany({
    where:   { activo: true, visibleEnLanding: true },
    orderBy: { createdAt: 'asc' },
    select: {
      id:          true,
      nombre:      true,
      descripcion: true,
      createdAt:   true,
    },
  })
  return ApiResponse.success(res, formularios)
}))

// ── GET /api/inscripcion/formularios/:id ─────────────────────────────────────
// Público — leer un formulario activo por ID (sin autenticación)
router.get('/formularios/:id', asyncHandler(async (req, res) => {
  const form = await prisma.formulario.findUnique({ where: { id: req.params.id } })
  if (!form || !form.activo) {
    return res.status(404).json({ success: false, error: 'Formulario no encontrado o no activo' })
  }
  return ApiResponse.success(res, form)
}))

// ── GET /api/inscripcion/terminos ─────────────────────────────────────────────
// Público — URL del PDF de T&C vigente
router.get('/terminos', asyncHandler(async (_req, res) => {
  const cfg = await prisma.configApp.findUnique({ where: { clave: 'terminos_url' } })
  return ApiResponse.success(res, {
    url: cfg?.valor ?? 'https://res.cloudinary.com/dbc1cm3hq/raw/upload/v1780155655/grupo500/documentos/terminos-condiciones-grupo500.pdf',
  })
}))

// ── GET /api/inscripcion/calendarios-activos ──────────────────────────────────
// Público — para la landing page y el hub de inscripciones
router.get('/calendarios-activos', asyncHandler(async (_req, res) => {
  const cursos = await prisma.curso.findMany({
    where:   { activo: true, visibleEnLanding: true },
    orderBy: { fechaInicio: 'asc' },
    select: {
      id:               true,
      nombre:           true,
      descripcion:      true,
      precio:           true,
      calendario:       true,
      fechaInicio:      true,
      fechaFin:         true,
      cuposDisponibles: true,
      _count: { select: { estudiantes: true } },
    },
  })

  // Agregar precios promo desde ConfigApp
  const cursosConPrecios = await Promise.all(cursos.map(async (c) => {
    const [cfgGeneral, cfgPromo] = await Promise.all([
      prisma.configApp.findUnique({ where: { clave: `precio_general_${c.id}` } }),
      prisma.configApp.findUnique({ where: { clave: `precio_promo_${c.id}` } }),
    ])
    const precioGeneral = cfgGeneral?.valor ? parseFloat(cfgGeneral.valor) : c.precio
    const preciosPromo  = cfgPromo?.valor
      ? cfgPromo.valor.split(',').map(p => parseFloat(p.trim())).filter(p => !isNaN(p))
      : []
    const inscritos = c._count.estudiantes

    return {
      ...c,
      precioGeneral,
      preciosPromo,
      inscritos,
      cuposRestantes: c.cuposDisponibles != null ? c.cuposDisponibles - inscritos : null,
    }
  }))

  return ApiResponse.success(res, cursosConPrecios)
}))

// ── GET /api/inscripcion/cursos/:calId ────────────────────────────────────────
// Público — cursos activos de un calendario específico con precios
router.get('/cursos/:calId', asyncHandler(async (req, res) => {
  const { calId } = req.params
  const curso = await prisma.curso.findUnique({
    where: { id: calId },
    select: { id: true, nombre: true, precio: true, calendario: true, fechaInicio: true, fechaFin: true, activo: true },
  })

  if (!curso || !curso.activo) {
    return res.status(404).json({ success: false, error: 'Calendario no encontrado o no activo' })
  }

  const [cfgGeneral, cfgPromo] = await Promise.all([
    prisma.configApp.findUnique({ where: { clave: `precio_general_${calId}` } }),
    prisma.configApp.findUnique({ where: { clave: `precio_promo_${calId}` } }),
  ])

  const precioGeneral = cfgGeneral?.valor ? parseFloat(cfgGeneral.valor) : curso.precio
  const preciosPromo  = cfgPromo?.valor
    ? cfgPromo.valor.split(',').map(p => parseFloat(p.trim())).filter(p => !isNaN(p))
    : []

  return ApiResponse.success(res, { ...curso, precioGeneral, preciosPromo })
}))

// ── POST /api/inscripcion/upload-documento ────────────────────────────────────
// Público — sube documento de identidad a Cloudinary
router.post(
  '/upload-documento',
  multerMiddleware(uploadDocumento),
  (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'No se recibió ningún archivo' })
    const file = req.file as Express.Multer.File & { path: string; filename: string }
    return ApiResponse.success(res, { url: file.path, filename: file.filename })
  }
)

// ── POST /api/inscripcion/upload-comprobante ──────────────────────────────────
// Público — sube comprobante de pago a Cloudinary, retorna publicId para OCR posterior
router.post(
  '/upload-comprobante',
  multerMiddleware(uploadComprobante),
  (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'No se recibió ningún archivo' })
    const file = req.file as Express.Multer.File & { path: string; filename: string }
    return ApiResponse.success(res, { url: file.path, filename: file.filename, publicId: file.filename })
  }
)

// ── POST /api/inscripcion/publica ─────────────────────────────────────────────
// Público — procesa la inscripción completa
router.post('/publica', asyncHandler(async (req, res) => {
  const data = inscripcionSchema.parse(req.body)

  if (!data.aceptaTerminos) {
    return res.status(400).json({ success: false, error: 'Debes aceptar los términos y condiciones.' })
  }

  // ── 1. Validar asesor si viene en el payload ───────────────────────────────
  if (data.asesorId) {
    const asesorExiste = await prisma.asesor.findUnique({ where: { id: data.asesorId } })
    if (!asesorExiste) {
      return res.status(400).json({ success: false, error: 'El enlace del asesor no es válido.' })
    }
  }

  // ── 2. Validar curso ───────────────────────────────────────────────────────
  const curso = await prisma.curso.findUnique({ where: { id: data.cursoId } })
  if (!curso || !curso.activo) {
    return res.status(400).json({ success: false, error: 'El curso seleccionado no está disponible.' })
  }

  // ── 3. Buscar/crear colegio ────────────────────────────────────────────────
  let colegioId: string | undefined
  if (data.colegio) {
    let colegio = await prisma.colegio.findFirst({
      where: { nombre: { equals: data.colegio, mode: 'insensitive' } },
    })
    if (!colegio) {
      colegio = await prisma.colegio.create({
        data: { nombre: data.colegio, ciudad: data.ciudad },
      })
    }
    colegioId = colegio.id
  }

  // ── 4. Idempotencia por email ──────────────────────────────────────────────
  const existente = await prisma.estudiante.findFirst({ where: { email: data.email } })
  if (existente) {
    return res.status(200).json({
      success:      true,
      message:      'Este correo ya está registrado. Contacta a tu asesor.',
      estudianteId: existente.id,
      yaExistia:    true,
    })
  }

  // ── 5. Crear estudiante ────────────────────────────────────────────────────
  const estudiante = await prisma.estudiante.create({
    data: {
      nombre:            data.nombre,
      email:             data.email,
      telefono:          data.telefono,
      tipoDocumento:     data.tipoDocumento,
      documento:         data.documento,
      fechaNacimiento:   new Date(data.fechaNacimiento),
      departamento:      data.departamento,
      ciudad:            data.ciudad,
      colegioId,
      grado:             data.grado,
      primerIcfes:       data.primerIcfes,
      puntajeAnterior:   data.puntajeAnterior || null,
      carreraInteres:    data.carreraInteres || null,
      documentoUrl:      data.documentoUrl || null,
      asesorId:          data.asesorId || null,
      acudiente: {
        create: {
          nombre:          data.acudienteNombre,
          email:           data.acudienteEmail || null,
          telefono:        data.acudienteTelefono,
          relacion:        data.acudienteParentesco,
          tipoDocumento:   data.acudienteTipoDocumento || 'CC',
          numeroDocumento: data.acudienteNumeroDocumento || '',
        },
      },
    },
    include: { acudiente: true },
  })

  // ── 6. Asignar curso ───────────────────────────────────────────────────────
  const cfgGeneral = await prisma.configApp.findUnique({ where: { clave: `precio_general_${curso.id}` } })
  const precioGeneral = cfgGeneral?.valor ? parseFloat(cfgGeneral.valor) : curso.precio

  await prisma.cursoEstudiante.create({
    data: { estudianteId: estudiante.id, cursoId: curso.id, descuentoPorcentaje: 0 },
  })

  if (curso.cuposDisponibles != null && curso.cuposDisponibles > 0) {
    await prisma.curso.update({ where: { id: curso.id }, data: { cuposDisponibles: { decrement: 1 } } })
  }

  // ── 7. Fuente de contacto ──────────────────────────────────────────────────
  if (data.fuenteContacto) {
    await prisma.fuenteContacto.create({
      data: {
        estudianteId: estudiante.id,
        fuente:       data.fuenteContacto,
        formId:       data.formularioId ?? 'formulario-propio',
        respondedAt:  new Date(),
      },
    }).catch(() => {})
  }

  // ── 8. Registrar pago con método, referencia y timestamp comprobante ───────
  const ahora = new Date()
  await prisma.pago.create({
    data: {
      estudianteId:     estudiante.id,
      monto:            precioGeneral,
      estado:           'PENDIENTE',
      fechaVencimiento: ahora,
      metodo:           data.metodoPago,
      comprobante:      data.comprobanteUrl,
      referenciaPago:   data.referenciaPago,
      comprobanteAt:    ahora, // timestamp de recepción en nuestra plataforma
      notas: [
        `Inscripción vía formulario. Curso: ${curso.nombre}.`,
        `Método: ${data.metodoPago}. Referencia: ${data.referenciaPago}.`,
      ].join(' '),
    },
  })

  // ── 8. HubSpot — NO se sincroniza desde el formulario de matriculación ───────
  // Los leads llegan a HubSpot por redes sociales (Meta/Instagram).
  // Este formulario es post-pago: solo crea el estudiante en la app.
  // syncEstudianteHubspot() se reserva para cuando el asesor crea
  // el estudiante manualmente desde el panel admin.

  // ── 9. Broadcast SSE — notifica al asesor si aplica ──────────────────────
  broadcast('nuevo-estudiante', {
    id:       estudiante.id,
    nombre:   estudiante.nombre,
    email:    estudiante.email,
    asesorId: data.asesorId ?? null,
    curso:    curso.nombre,
  })

  logger.info(`[Inscripción pública] Estudiante creado: ${estudiante.id} — ${estudiante.nombre}`)

  return ApiResponse.created(res, {
    estudianteId: estudiante.id,
    nombre:       estudiante.nombre,
    mensaje:      '¡Inscripción recibida! En breve te contactamos.',
  })
}))

// ── GET /api/inscripcion/asesor/:asesorId ─────────────────────────────────────
// Público — validar que el asesor existe y obtener su nombre
router.get('/asesor/:asesorId', asyncHandler(async (req, res) => {
  const asesor = await prisma.asesor.findUnique({
    where: { id: req.params.asesorId },
    select: { id: true, nombre: true },
  })
  if (!asesor) return res.status(404).json({ success: false, error: 'Asesor no encontrado' })
  return ApiResponse.success(res, asesor)
}))

// ── GET /api/inscripcion/cursos-activos ───────────────────────────────────────
// Público — cursos activos para el selector del formulario
router.get('/cursos-activos', asyncHandler(async (_req, res) => {
  const cursos = await prisma.curso.findMany({
    where:   { activo: true },
    orderBy: { nombre: 'asc' },
    select: {
      id:           true,
      nombre:       true,
      descripcion:  true,
      precio:       true,
      duracionHoras: true,
      fechaInicio:  true,
      fechaFin:     true,
      fechaIcfes:   true,
      simulacros:   true,
      calendario:   true,
      tipoCurso:    true,
      cuposDisponibles: true,
      _count: { select: { estudiantes: true } },
    },
  })
  return ApiResponse.success(res, cursos)
}))

export default router
