import { Router } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { authenticate } from '../middleware/auth'
import { suscribir, desuscribir } from '../controllers/notificaciones.controller'

const router = Router()

router.post('/suscribir',   authenticate, asyncHandler(suscribir))
router.post('/desuscribir', authenticate, asyncHandler(desuscribir))

export default router
