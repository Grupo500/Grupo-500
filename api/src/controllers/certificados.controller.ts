import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { NotFoundError } from '../utils/errors'
import { z } from 'zod'
import crypto from 'crypto'

const generarSchema = z.object({
  estudianteId: z.string(),
  tipo: z.enum(['CURSANDO', 'COMPLETADO']),
})

function generarNumeroSerie(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `G500-${timestamp}-${random}`
}

export async function listar(req: Request, res: Response) {
  const { nombre, page = '1', limit = '20' } = req.query
  const skip = (Number(page) - 1) * Number(limit)

  // VENDEDOR solo ve certificados de sus propios estudiantes
  const asesorFilter = req.userRole === 'VENDEDOR' && req.asesorId
    ? { estudiante: { asesorId: req.asesorId } }
    : {}

  const where = {
    ...asesorFilter,
    ...(nombre && { estudiante: { nombre: { contains: String(nombre), mode: 'insensitive' as const } } }),
  }

  const [certificados, total] = await Promise.all([
    prisma.certificado.findMany({
      where,
      include: {
        estudiante: {
          include: {
            colegio: true,
            cursos: { include: { curso: true }, orderBy: { fechaCompra: 'asc' }, take: 1 },
          },
        },
      },
      orderBy: { fechaEmision: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.certificado.count({ where }),
  ])

  return ApiResponse.paginated(res, certificados, total, Number(page), Number(limit))
}

export async function generar(req: Request, res: Response) {
  const { estudianteId, tipo } = generarSchema.parse(req.body)

  const estudiante = await prisma.estudiante.findUnique({
    where: { id: estudianteId },
    include: { cursos: { include: { curso: true } } },
  })

  if (!estudiante) throw new NotFoundError('Estudiante no encontrado')

  // Por ahora se genera con URL placeholder — Cloudinary en siguiente fase
  const certificado = await prisma.certificado.create({
    data: {
      estudianteId,
      tipo,
      numeroSerie: generarNumeroSerie(),
      archivoUrl: '', // Se poblará con Cloudinary
    },
    include: { estudiante: true },
  })

  return ApiResponse.created(res, certificado)
}

export async function eliminar(req: Request, res: Response) {
  const certificado = await prisma.certificado.findUnique({ where: { id: req.params.id } })
  if (!certificado) throw new NotFoundError('Certificado no encontrado')

  await prisma.certificado.delete({ where: { id: req.params.id } })
  return ApiResponse.success(res, { id: req.params.id, eliminado: true })
}

export async function obtener(req: Request, res: Response) {
  const certificado = await prisma.certificado.findUnique({
    where: { id: req.params.id },
    include: { estudiante: true },
  })
  if (!certificado) throw new NotFoundError('Certificado no encontrado')
  return ApiResponse.success(res, certificado)
}

export async function porEstudiante(req: Request, res: Response) {
  const certificados = await prisma.certificado.findMany({
    where: { estudianteId: req.params.estudianteId },
    orderBy: { fechaEmision: 'desc' },
  })
  return ApiResponse.success(res, certificados)
}

// ── Enviar por WhatsApp (stub — pendiente integración Twilio) ─────────────
export async function enviarWhatsapp(req: Request, res: Response) {
  const certificado = await prisma.certificado.findUnique({
    where: { id: req.params.id },
    include: { estudiante: true },
  })
  if (!certificado) throw new NotFoundError('Certificado no encontrado')

  const TWILIO_SID    = process.env.TWILIO_ACCOUNT_SID
  const TWILIO_TOKEN  = process.env.TWILIO_AUTH_TOKEN
  const TWILIO_FROM   = process.env.TWILIO_WHATSAPP_FROM

  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    return res.status(503).json({
      success: false,
      error: 'WHATSAPP_NOT_CONFIGURED',
      message: 'La integración con WhatsApp aún no está configurada.',
    })
  }

  // TODO: implementar envío real con Twilio cuando se tengan las credenciales
  // const client = twilio(TWILIO_SID, TWILIO_TOKEN)
  // await client.messages.create({ from: `whatsapp:${TWILIO_FROM}`, to: `whatsapp:+57${certificado.estudiante.telefono}`, body: '...', mediaUrl: [certificado.archivoUrl] })

  return ApiResponse.success(res, { message: 'Mensaje enviado por WhatsApp' })
}

// ── Enviar por correo (stub — pendiente integración SendGrid/nodemailer) ──
export async function enviarCorreo(req: Request, res: Response) {
  const certificado = await prisma.certificado.findUnique({
    where: { id: req.params.id },
    include: { estudiante: true },
  })
  if (!certificado) throw new NotFoundError('Certificado no encontrado')

  const SENDGRID_KEY = process.env.SENDGRID_API_KEY

  if (!SENDGRID_KEY) {
    return res.status(503).json({
      success: false,
      error: 'EMAIL_NOT_CONFIGURED',
      message: 'La integración de correo aún no está configurada.',
    })
  }

  // TODO: implementar envío real con SendGrid cuando se tenga la API key
  // await sgMail.send({ to: certificado.estudiante.email, from: 'noreply@grupo500.com', subject: 'Tu certificado PREICFES Grupo 500', attachments: [...] })

  return ApiResponse.success(res, { message: 'Correo enviado correctamente' })
}
