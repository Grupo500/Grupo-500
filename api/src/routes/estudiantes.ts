import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/estudiantes.controller'
import { uploadExcel } from '../middleware/upload'

const router = Router()

router.use(authenticate)

router.get('/', asyncHandler(ctrl.listar))
router.post('/', asyncHandler(ctrl.crear))
router.post('/import', requireRole('ADMIN'), uploadExcel.single('file'), asyncHandler(ctrl.importar))
router.get('/:id', asyncHandler(ctrl.obtener))
router.patch('/:id', asyncHandler(ctrl.actualizar))
router.delete('/:id', requireRole('ADMIN'), asyncHandler(ctrl.eliminar))
router.get('/:id/rendimiento', asyncHandler(ctrl.rendimiento))
router.get('/:id/historial',  asyncHandler(ctrl.historial))

export default router
