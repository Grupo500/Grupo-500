import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/redes.controller'
import * as ROLES from '../utils/roles'

const router = Router()

router.use(authenticate, requireRole('ADMIN', ...ROLES.MARKETING))

router.get('/config',            asyncHandler(ctrl.estadoConfig))
router.post('/config',           requireRole('ADMIN'), asyncHandler(ctrl.guardarConfig))

router.get('/oauth-url',         asyncHandler(ctrl.oauthUrl))
router.post('/conectar',         asyncHandler(ctrl.conectar))

router.get('/cuentas',           asyncHandler(ctrl.listarCuentas))
router.delete('/cuentas/:id',    requireRole('ADMIN'), asyncHandler(ctrl.eliminarCuenta))

router.get('/publicaciones',                 asyncHandler(ctrl.listarPublicaciones))
router.post('/publicaciones',                asyncHandler(ctrl.crearPublicacion))
router.patch('/publicaciones/:id/cancelar',  asyncHandler(ctrl.cancelarPublicacion))
router.post('/publicaciones/:id/ahora',      asyncHandler(ctrl.publicarAhora))
router.delete('/publicaciones/:id',          asyncHandler(ctrl.eliminarPublicacion))

export default router
