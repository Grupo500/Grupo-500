import { Router } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { authenticate, requireRole } from '../middleware/auth'
import { sincronizar } from '../controllers/hubspot.controller'

const router = Router()

// Sincronizar leads de HubSpot → BD (solo ADMIN)
router.post('/sincronizar', authenticate, requireRole('ADMIN'), asyncHandler(sincronizar))

export default router
