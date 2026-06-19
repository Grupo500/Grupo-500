import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/notificaciones.controller'

const router = Router()

router.use(authenticate)
router.post('/suscribir',   asyncHandler(ctrl.suscribir))
router.post('/desuscribir', asyncHandler(ctrl.desuscribir))

export default router
