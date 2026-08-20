import { Router } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { authenticate } from '../middleware/auth'
import { suscribir, desuscribir } from '../controllers/notificaciones.controller'
import * as bandeja from '../controllers/notificacionesBandeja.controller'

const router = Router()

// El permiso del navegador para los avisos de escritorio.
router.post('/suscribir',   authenticate, asyncHandler(suscribir))
router.post('/desuscribir', authenticate, asyncHandler(desuscribir))

// La bandeja: los avisos que quedan guardados aunque el push no llegue.
router.get('/',            authenticate, asyncHandler(bandeja.listar))
router.patch('/leidas',    authenticate, asyncHandler(bandeja.marcarTodasLeidas))
router.patch('/:id/leida', authenticate, asyncHandler(bandeja.marcarLeida))

export default router
