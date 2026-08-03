import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/afiliaciones.controller'

const router = Router()

router.use(authenticate, requireRole('ADMIN', 'VENDEDOR'))

router.get('/mis',          asyncHandler(ctrl.listarMisAfiliaciones))
router.post('/:cursoId',    asyncHandler(ctrl.marcarAfiliacion))
router.delete('/:cursoId',  asyncHandler(ctrl.desmarcarAfiliacion))
router.get('/resumen',      requireRole('ADMIN'), asyncHandler(ctrl.resumenEquipo))

export default router
