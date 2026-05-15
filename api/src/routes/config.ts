import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import { uploadFirma } from '../middleware/upload'
import { getFirmas, subirFirma } from '../controllers/config.controller'
import { asyncHandler } from '../utils/errors'

const router = Router()

router.use(requireAuth)

// Cualquier usuario autenticado puede leer las firmas (para generar el PDF)
router.get('/firmas', asyncHandler(getFirmas))

// Solo ADMIN puede subir firmas
router.post('/firmas/sebastian', requireRole('ADMIN'), uploadFirma.single('firma'), asyncHandler(subirFirma('sebastian')))
router.post('/firmas/andres',    requireRole('ADMIN'), uploadFirma.single('firma'), asyncHandler(subirFirma('andres')))

export default router
