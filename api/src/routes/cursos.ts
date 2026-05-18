import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/cursos.controller'

const router = Router()

router.use(authenticate)

router.get('/', asyncHandler(ctrl.listar))
router.post('/', requireRole('ADMIN'), asyncHandler(ctrl.crear))
router.get('/:id', asyncHandler(ctrl.obtener))
router.patch('/:id', requireRole('ADMIN'), asyncHandler(ctrl.actualizar))
router.delete('/:id', requireRole('ADMIN'), asyncHandler(ctrl.eliminar))
router.post('/asignar', requireRole('ADMIN'), asyncHandler(ctrl.asignarACurso))

export default router
