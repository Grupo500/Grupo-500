import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticateApiKey } from '../middleware/apiKeyAuth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/public.controller'

const router = Router()

router.use(authenticateApiKey)

// Más estricto que el rate limit general de /api — pensado para consumo externo
router.use(rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.apiKeyId ?? req.ip ?? 'anon',
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Límite de la API pública alcanzado.' },
}))

router.get('/estudiantes', asyncHandler(ctrl.listarEstudiantes))
router.get('/pagos', asyncHandler(ctrl.listarPagos))
router.get('/cursos', asyncHandler(ctrl.listarCursos))
router.get('/reportes/resumen', asyncHandler(ctrl.resumen))

export default router
