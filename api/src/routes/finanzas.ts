import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/finanzas.controller'

const router = Router()

// Finanzas es una vista de dirección: no se segmenta por asesor, así que toda
// el área es solo para ADMIN.
router.use(authenticate)
router.use(requireRole('ADMIN'))

router.get('/resumen', asyncHandler(ctrl.resumen))
router.get('/cierre',  asyncHandler(ctrl.cierreMensual))
router.get('/mix',     asyncHandler(ctrl.mixComercial))

export default router
