import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/colegios.controller'

const router = Router()

router.use(authenticate)

router.get('/', asyncHandler(ctrl.listar))
router.post('/', asyncHandler(ctrl.crear))
router.get('/:id', asyncHandler(ctrl.obtener))
router.patch('/:id', asyncHandler(ctrl.actualizar))
router.delete('/:id', requireRole('ADMIN'), asyncHandler(ctrl.eliminar))

export default router
