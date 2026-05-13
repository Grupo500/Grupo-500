import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/certificados.controller'

const router = Router()

router.use(authenticate)

router.post('/', asyncHandler(ctrl.generar))
router.get('/:id', asyncHandler(ctrl.obtener))
router.get('/estudiante/:estudianteId', asyncHandler(ctrl.porEstudiante))

export default router
