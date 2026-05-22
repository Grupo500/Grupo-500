import multer, { FileFilterCallback } from 'multer'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import { v2 as cloudinary } from 'cloudinary'
import { Request } from 'express'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/* ─── MIME permitidos ─────────────────────────────────────────────────────── */
const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',  // comprobantes también pueden ser PDF
])
const ALLOWED_PDF_MIMES = new Set(['application/pdf'])
const ALLOWED_FIRMA_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

/* ─── Filtros ─────────────────────────────────────────────────────────────── */
function filterImage(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  if (ALLOWED_IMAGE_MIMES.has(file.mimetype)) return cb(null, true)
  cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Solo imágenes o PDF.`))
}

function filterPdf(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  if (ALLOWED_PDF_MIMES.has(file.mimetype)) return cb(null, true)
  cb(new Error(`Solo se permiten archivos PDF. Recibido: ${file.mimetype}`))
}

function filterFirma(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  if (ALLOWED_FIRMA_MIMES.has(file.mimetype)) return cb(null, true)
  cb(new Error(`Solo se permiten imágenes JPG/PNG/WebP para firma. Recibido: ${file.mimetype}`))
}

/* ─── Storages ────────────────────────────────────────────────────────────── */
const pdfStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'grupo500/simulacros',
    resource_type:   'raw',
    allowed_formats: ['pdf'],
    use_filename:    true,
    unique_filename: true,
  } as any,
})

const imageStorage = new CloudinaryStorage({
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

const firmaStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'grupo500/firmas',
    resource_type:   'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    use_filename:    true,
    unique_filename: true,
  } as any,
})

/* ─── Excel / XLSX (memoria, sin Cloudinary) ─────────────────────────────── */
const ALLOWED_EXCEL_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                           // .xls
])

function filterExcel(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  if (ALLOWED_EXCEL_MIMES.has(file.mimetype)) return cb(null, true)
  cb(new Error(`Solo se permiten archivos Excel (.xlsx/.xls). Recibido: ${file.mimetype}`))
}

export const uploadExcel = multer({
  storage:    multer.memoryStorage(),
  fileFilter: filterExcel,
  limits:     { fileSize: 10 * 1024 * 1024, files: 1 },  // 10 MB máx
})

/* ─── Exports ─────────────────────────────────────────────────────────────── */
export const uploadPdf = multer({
  storage:    pdfStorage,
  fileFilter: filterPdf,
  limits:     { fileSize: 20 * 1024 * 1024, files: 1 },  // 20 MB máx
})

export const uploadImage = multer({
  storage:    imageStorage,
  fileFilter: filterImage,
  limits:     { fileSize: 20 * 1024 * 1024, files: 1 },  // 20 MB máx
})

export const uploadFirma = multer({
  storage:    firmaStorage,
  fileFilter: filterFirma,
  limits:     { fileSize: 5 * 1024 * 1024, files: 1 },   // 5 MB máx
})
