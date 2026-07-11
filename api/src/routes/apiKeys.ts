import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/apiKeys.controller'

const router = Router()

router.use(authenticate, requireRole('ADMIN'))

router.get('/', asyncHandler(ctrl.listar))
router.post('/', asyncHandler(ctrl.crear))
router.delete('/:id', asyncHandler(ctrl.revocar))

export default router
