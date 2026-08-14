import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/marketing.controller'
import * as ROLES from '../utils/roles'

const router = Router()

router.use(authenticate, requireRole('ADMIN', ...ROLES.MARKETING))

router.get('/miembros', asyncHandler(ctrl.listarMiembros))

router.get('/contenidos',          asyncHandler(ctrl.listarContenidos))
router.post('/contenidos',         asyncHandler(ctrl.crearContenido))
router.patch('/contenidos/:id',    asyncHandler(ctrl.actualizarContenido))
router.delete('/contenidos/:id',   asyncHandler(ctrl.eliminarContenido))
router.post('/contenidos/:id/entregables', asyncHandler(ctrl.crearEntregable))

router.get('/entregables',    asyncHandler(ctrl.listarEntregables))
router.delete('/entregables/:id', asyncHandler(ctrl.eliminarEntregable))

// Cobros freelance. El propio controlador acota qué ve cada quien y quién
// puede aprobar; la ruta no lo restringe porque todo el área entra a ver los
// suyos.
router.get('/cobros',             asyncHandler(ctrl.listarCobros))
router.patch('/cobros/:id/aprobar', asyncHandler(ctrl.aprobarCobro))
router.patch('/cobros/:id/pagar',   asyncHandler(ctrl.pagarCobro))


export default router
