import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/marketing.controller'

const router = Router()

router.use(authenticate, requireRole('ADMIN', 'MARKETING'))

router.get('/miembros', asyncHandler(ctrl.listarMiembros))

router.get('/contenidos',          asyncHandler(ctrl.listarContenidos))
router.post('/contenidos',         asyncHandler(ctrl.crearContenido))
router.patch('/contenidos/:id',    asyncHandler(ctrl.actualizarContenido))
router.delete('/contenidos/:id',   asyncHandler(ctrl.eliminarContenido))
router.post('/contenidos/:id/entregables', asyncHandler(ctrl.crearEntregable))

router.get('/entregables',    asyncHandler(ctrl.listarEntregables))
router.delete('/entregables/:id', asyncHandler(ctrl.eliminarEntregable))

router.get('/guiones',        asyncHandler(ctrl.listarGuiones))
router.post('/guiones',       asyncHandler(ctrl.crearGuion))
router.patch('/guiones/:id',  asyncHandler(ctrl.actualizarGuion))
router.delete('/guiones/:id', asyncHandler(ctrl.eliminarGuion))

export default router
