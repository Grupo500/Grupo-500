import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/reportes.controller'


const router = Router()

router.use(authenticate, requireRole('ADMIN', 'VENDEDOR'))

// Accesibles para ADMIN/VENDEDOR (los controllers filtran por asesorId si es VENDEDOR)
router.get('/dashboard',       asyncHandler(ctrl.dashboard))
router.get('/mi-resumen',      asyncHandler(ctrl.miResumenAsesor))
router.get('/mis-ventas',      asyncHandler(ctrl.misVentasResumen))
router.get('/cursos',          asyncHandler(ctrl.cursosMasVendidos))
router.get('/por-cobrar',      asyncHandler(ctrl.pendientesPorCobrar))
router.get('/cuotas',          asyncHandler(ctrl.cuotas))
router.get('/ventas-grafica',  asyncHandler(ctrl.ventasGrafica))
router.get('/medios-pago',     asyncHandler(ctrl.mediosPago))
router.get('/asesores',        asyncHandler(ctrl.rankingAsesores))

// El resto solo para admin
router.use(requireRole('ADMIN'))
router.get('/ingresos',        asyncHandler(ctrl.ingresos))
router.get('/financiero',         asyncHandler(ctrl.financiero))
router.get('/financiero-periodo', asyncHandler(ctrl.financieroPeriodo))
router.get('/estudiantes-por-mes', asyncHandler(ctrl.estudiantesPorMes))
router.get('/diagnostico-atribucion', asyncHandler(ctrl.diagnosticoAtribucion))
router.post('/resolver-atribucion',   asyncHandler(ctrl.resolverAtribucion))

export default router
