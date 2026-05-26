import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/simulacros.controller'

const router = Router()

router.use(authenticate)

router.get('/', asyncHandler(ctrl.listar))
router.post('/', asyncHandler(ctrl.subir))
router.post('/:id/analizar', asyncHandler(ctrl.analizar))
router.get('/:id/resultados', asyncHandler(ctrl.resultados))
router.delete('/:id', asyncHandler(ctrl.eliminar))

export default router
