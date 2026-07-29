import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as ctrl from '../controllers/finanzas.controller'
import * as clientes from '../controllers/finanzasClientes.controller'
import * as marketing from '../controllers/finanzasMarketing.controller'
import * as calidad from '../controllers/finanzasCalidad.controller'
import * as atribucion from '../controllers/finanzasAtribucion.controller'

const router = Router()

// Finanzas es una vista de dirección: no se segmenta por asesor, así que toda
// el área es solo para ADMIN.
router.use(authenticate)
router.use(requireRole('ADMIN'))

router.get('/resumen', asyncHandler(ctrl.resumen))
router.get('/cierre',  asyncHandler(ctrl.cierreMensual))
router.get('/mix',     asyncHandler(ctrl.mixComercial))

router.get('/clientes', asyncHandler(clientes.rfvClientes))
router.get('/diario',   asyncHandler(clientes.reporteDiario))

router.get('/marketing',     asyncHandler(marketing.marketing))
router.post('/inversion',    asyncHandler(marketing.crearInversion))
router.delete('/inversion/:id', asyncHandler(marketing.eliminarInversion))
router.get('/precio',        asyncHandler(marketing.precioYCambio))

router.get('/calidad',        asyncHandler(calidad.controlCalidad))
router.get('/parametros',     asyncHandler(calidad.parametros))
router.put('/parametros/umbrales', asyncHandler(calidad.actualizarUmbrales))
router.post('/precios-oficiales',  asyncHandler(calidad.crearPrecioOficial))
router.delete('/precios-oficiales/:id', asyncHandler(calidad.eliminarPrecioOficial))

router.get('/atribucion',            asyncHandler(atribucion.atribucion))
router.post('/atribucion/asignar',   asyncHandler(atribucion.asignarAsesor))
router.post('/atribucion/homologar', asyncHandler(atribucion.homologarAfiliado))
router.delete('/atribucion/alias/:alias', asyncHandler(atribucion.eliminarAlias))

export default router
