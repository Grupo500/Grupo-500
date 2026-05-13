import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/reportes.controller'

const router = Router()

router.use(authenticate, requireRole('ADMIN'))

router.get('/dashboard', asyncHandler(ctrl.dashboard))
router.get('/ingresos', asyncHandler(ctrl.ingresos))
router.get('/asesores', asyncHandler(ctrl.rankingAsesores))
router.get('/cursos', asyncHandler(ctrl.cursosMasVendidos))

export default router
