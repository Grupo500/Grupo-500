import { Router, Request, Response } from 'express'
import { authenticate } from '../middleware/auth'
import { uploadPdf, uploadImage } from '../middleware/upload'
import { ApiResponse } from '../utils/response'

const router = Router()

router.use(authenticate)

// Upload de PDF (simulacros)
router.post('/pdf', uploadPdf.single('file'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' })
  const file = req.file as Express.Multer.File & { path: string; filename: string }
  return ApiResponse.success(res, {
    url:      file.path,
    filename: file.filename,
  })
})

// Upload de imagen / comprobante
router.post('/imagen', uploadImage.single('file'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' })
  const file = req.file as Express.Multer.File & { path: string; filename: string }
  return ApiResponse.success(res, {
    url:      file.path,
    filename: file.filename,
  })
})

export default router
