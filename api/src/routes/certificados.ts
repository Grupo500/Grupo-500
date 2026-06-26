import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/certificados.controller'

const router = Router()

router.use(authenticate)

router.get('/', asyncHandler(ctrl.listar))
router.post('/', asyncHandler(ctrl.generar))
router.get('/estudiante/:estudianteId', asyncHandler(ctrl.porEstudiante))
router.get('/:id', asyncHandler(ctrl.obtener))
router.delete('/:id', requireRole('ADMIN'), asyncHandler(ctrl.eliminar))
router.post('/:id/enviar-whatsapp', asyncHandler(ctrl.enviarWhatsapp))
router.post('/:id/enviar-correo', asyncHandler(ctrl.enviarCorreo))

export default router
