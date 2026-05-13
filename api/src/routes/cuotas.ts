import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/cuotas.controller'

const router = Router()

router.use(authenticate)

router.patch('/:id', asyncHandler(ctrl.actualizar))

export default router
