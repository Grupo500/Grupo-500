import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../middleware/auth'
import { uploadPdf, uploadImage } from '../middleware/upload'
import { ApiResponse } from '../utils/response'

const router = Router()

router.use(authenticate)

// Verificar que Cloudinary está configurado
function checkCloudinary(req: Request, res: Response, next: NextFunction) {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return res.status(503).json({
      success: false,
      error: 'Servicio de almacenamiento no configurado. Agrega las variables CLOUDINARY_* en Railway.',
    })
  }
  next()
}

// Wrapper que convierte errores de multer/cloudinary a JSON
function multerHandler(upload: import('multer').Multer) {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message ?? 'Error al subir archivo' })
      }
      next()
    })
  }
}

// Upload de PDF (simulacros)
router.post('/pdf', checkCloudinary, multerHandler(uploadPdf), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No se recibió ningún archivo' })
  const file = req.file as Express.Multer.File & { path: string; filename: string }
  return ApiResponse.success(res, { url: file.path, filename: file.filename })
})

// Upload de imagen / comprobante
router.post('/imagen', checkCloudinary, multerHandler(uploadImage), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No se recibió ningún archivo' })
  const file = req.file as Express.Multer.File & { path: string; filename: string }
  return ApiResponse.success(res, { url: file.path, filename: file.filename })
})

export default router
