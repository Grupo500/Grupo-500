import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/cobros.controller'

const router = Router()

router.use(authenticate)

router.get('/calendario', asyncHandler(ctrl.calendario))
router.get('/proximos', asyncHandler(ctrl.proximos))
router.get('/saldos-pendientes', asyncHandler(ctrl.saldosPendientes))

export default router
