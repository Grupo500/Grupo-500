import { Router } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { authenticate, requireRole } from '../middleware/auth'
import { webhook, listarVentas, sincronizarProductos, sincronizarHistorialVentas } from '../controllers/hotmart.controller'

const router = Router()

// Webhook público — Hotmart llama aquí cuando hay una compra completada
router.post('/webhook', asyncHandler(webhook))

// Sincronizar productos de Hotmart → cursos en BD (solo ADMIN)
router.post('/sincronizar', authenticate, requireRole('ADMIN'), asyncHandler(sincronizarProductos))

// Consultar ventas históricas desde Hotmart API (solo ADMIN)
router.get('/ventas', authenticate, requireRole('ADMIN'), asyncHandler(listarVentas))

// Backfill: rellenar teléfonos de quienes ya pagaron, desde el historial (solo ADMIN)
router.post('/sincronizar-historial', authenticate, requireRole('ADMIN'), asyncHandler(sincronizarHistorialVentas))

export default router
