import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/estudiantes.controller'
import { uploadExcel } from '../middleware/upload'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'

const router = Router()

router.use(authenticate)

router.get('/', asyncHandler(ctrl.listar))
router.post('/', asyncHandler(ctrl.crear))
router.get('/plantilla', requireRole('ADMIN'), asyncHandler(ctrl.plantillaImport))
router.post('/import', requireRole('ADMIN'), uploadExcel.single('file'), asyncHandler(ctrl.importar))
router.get('/:id', asyncHandler(ctrl.obtener))
router.patch('/:id', asyncHandler(ctrl.actualizar))
router.delete('/:id', requireRole('ADMIN'), asyncHandler(ctrl.eliminar))
router.get('/:id/rendimiento', asyncHandler(ctrl.rendimiento))
router.get('/:id/historial',  asyncHandler(ctrl.historial))

// ── PATCH /estudiantes/:id/verificar — Confirmar matrícula ───────────────────
router.patch('/:id/verificar', asyncHandler(async (req, res) => {
  const { verificado } = req.body
  const userName = (req as any).userName ?? (req as any).userEmail ?? 'Admin'

  const estudiante = await prisma.estudiante.update({
    where: { id: req.params.id },
    data: {
      verificado:    !!verificado,
      verificadoPor: verificado ? userName : null,
      verificadoAt:  verificado ? new Date() : null,
    },
  })
  return ApiResponse.success(res, { verificado: estudiante.verificado, verificadoAt: estudiante.verificadoAt })
}))

export default router
