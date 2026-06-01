import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/asesores.controller'

const router = Router()

router.use(authenticate)

router.get('/',                        requireRole('ADMIN'), asyncHandler(ctrl.listar))
router.get('/me',                                          asyncHandler(ctrl.me))
router.get('/me/estadisticas',                             asyncHandler(ctrl.misEstadisticas))
router.get('/:id/estadisticas',        requireRole('ADMIN'), asyncHandler(ctrl.estadisticas))
router.patch('/:id',                   requireRole('ADMIN'), asyncHandler(ctrl.actualizar))

export default router
