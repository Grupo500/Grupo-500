import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import { uploadFirma } from '../middleware/upload'
import { getFirmas, subirFirma } from '../controllers/config.controller'
import { asyncHandler } from '../middleware/errorHandler'

const router = Router()

router.use(authenticate)

// Cualquier usuario autenticado puede leer las firmas (para generar el PDF)
router.get('/firmas', asyncHandler(getFirmas))

// Solo ADMIN puede subir firmas
router.post('/firmas/sebastian', requireRole('ADMIN'), uploadFirma.single('firma'), asyncHandler(subirFirma('sebastian')))
router.post('/firmas/andres',    requireRole('ADMIN'), uploadFirma.single('firma'), asyncHandler(subirFirma('andres')))

export default router
