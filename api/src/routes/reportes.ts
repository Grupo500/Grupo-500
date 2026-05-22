import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/reportes.controller'


const router = Router()

router.use(authenticate)

// Dashboard es accesible para todos los roles (el controller filtra por asesorId si es VENDEDOR)
router.get('/dashboard',       asyncHandler(ctrl.dashboard))

// El resto solo para admin
router.use(requireRole('ADMIN'))
router.get('/ingresos',        asyncHandler(ctrl.ingresos))
router.get('/asesores',        asyncHandler(ctrl.rankingAsesores))
router.get('/cursos',          asyncHandler(ctrl.cursosMasVendidos))
router.get('/financiero',         asyncHandler(ctrl.financiero))
router.get('/financiero-periodo', asyncHandler(ctrl.financieroPeriodo))
router.get('/ventas-grafica',  asyncHandler(ctrl.ventasGrafica))
router.get('/marketing',       asyncHandler(ctrl.marketing))
router.get('/medios-pago',     asyncHandler(ctrl.mediosPago))

export default router
