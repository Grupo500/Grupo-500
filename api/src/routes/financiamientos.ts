import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/financiamientos.controller'

const router = Router()

router.use(authenticate)

router.get('/', asyncHandler(ctrl.listar))
router.post('/', asyncHandler(ctrl.crear))
router.get('/:id', asyncHandler(ctrl.obtener))
router.patch('/:id', asyncHandler(ctrl.actualizar))

export default router
