import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/negociaciones.controller'

const router = Router()
router.use(authenticate)

router.get('/',        asyncHandler(ctrl.listar))
router.post('/',       asyncHandler(ctrl.crear))
router.patch('/:id',   asyncHandler(ctrl.actualizar))
router.delete('/:id',  asyncHandler(ctrl.eliminar))

export default router
