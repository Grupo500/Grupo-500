import { Request, Response } from 'express'
import { z } from 'zod'
import { ApiResponse } from '../utils/response'
import {
  obtenerGastosAgencia, gastosAgenciaConfigurado, ultimoSnapshot,
} from '../services/gastosAgencia'
import {
  actualizarContabilidad, actualizarNomina, agregarPersonaNomina,
  actualizarProduccion, actualizarTarifario,
  escrituraDisponible, ConflictoSheet, NoUbicado,
} from '../services/gastosAgenciaEscritura'

/**
 * Gastos de la agencia, leídos del Google Sheet de contabilidad interna.
 *
 * Devuelve el snapshot normalizado completo en vez de agregados por rango: son
 * doce puntos por categoría, caben de sobra en una respuesta, y así el filtro
 * por periodo del panel es instantáneo y no vuelve a pegarle al sheet.
 *
 * `?refrescar=1` salta la caché de 5 minutos del servicio.
 */
export async function gastosAgencia(req: Request, res: Response) {
  if (!gastosAgenciaConfigurado()) {
    return ApiResponse.error(res, 'Falta configurar GASTOS_AGENCIA_SHEET_ID en el servidor', 503)
  }

  try {
    const datos = await obtenerGastosAgencia(req.query.refrescar === '1')
    // `edicion` le dice al panel si puede mostrar los campos editables: sin
    // cuenta de servicio la lectura funciona pero la escritura no.
    return ApiResponse.success(res, { ...datos, edicion: escrituraDisponible() })
  } catch (e) {
    // Antes de dejar el panel en blanco, servimos la última copia buena.
    const previo = ultimoSnapshot()
    if (previo) {
      return ApiResponse.success(res, {
        ...previo,
        edicion: escrituraDisponible(),
        desactualizado: true,
        avisos: [
          ...previo.avisos,
          'El Google Sheet no respondió, estás viendo la última lectura guardada.',
        ],
      })
    }
    const msg = e instanceof Error ? e.message : 'No pude leer el sheet de gastos'
    return ApiResponse.error(res, msg, 502)
  }
}

// ── escritura ───────────────────────────────────────────────────────────

const importe = z.number().finite().min(0).max(1e12).nullable()
const mes = z.number().int().min(0).max(11)

/**
 * Traduce los fallos de escritura a códigos que el panel sepa interpretar.
 *
 * El 409 es el importante: significa que el dato cambió en el sheet y hay que
 * mostrarle al usuario el valor nuevo en vez de sobreescribirlo a ciegas.
 */
function responderError(res: Response, e: unknown) {
  if (e instanceof ConflictoSheet) {
    return res.status(409).json({
      success: false,
      error: e.message,
      valorActual: e.valorActual,
    })
  }
  if (e instanceof NoUbicado) {
    return ApiResponse.error(res, e.message, 422)
  }
  const msg = e instanceof Error ? e.message : 'No pude escribir en el sheet'
  const sinConfigurar = /cuenta de servicio/i.test(msg)
  return ApiResponse.error(res, msg, sinConfigurar ? 503 : 502)
}

const quien = (req: Request) => req.userName ?? req.userId ?? 'desconocido'

export async function editarContabilidad(req: Request, res: Response) {
  const cuerpo = z.object({
    anio: z.string().regex(/^20\d{2}$/),
    categoriaClave: z.string().min(1).max(80),
    mes,
    valor: importe,
    valorAnterior: importe,
  }).safeParse(req.body)

  if (!cuerpo.success) return ApiResponse.error(res, 'Datos inválidos para editar la contabilidad', 400)

  try {
    const r = await actualizarContabilidad({ ...cuerpo.data, usuario: quien(req) })
    return ApiResponse.success(res, r)
  } catch (e) {
    return responderError(res, e)
  }
}

export async function editarNomina(req: Request, res: Response) {
  const cuerpo = z.object({
    indice: z.number().int().min(0).max(5000),
    nombreEsperado: z.string().min(1).max(200),
    campo: z.enum(['monto', 'pagado', 'banco']),
    valor: z.union([z.number().finite().min(0).max(1e12), z.boolean(), z.string().max(120), z.null()]),
    valorAnterior: z.union([z.number().finite(), z.boolean(), z.string().max(120), z.null()]),
  }).safeParse(req.body)

  if (!cuerpo.success) return ApiResponse.error(res, 'Datos inválidos para editar la nómina', 400)

  try {
    const r = await actualizarNomina({ ...cuerpo.data, usuario: quien(req) })
    return ApiResponse.success(res, r)
  } catch (e) {
    return responderError(res, e)
  }
}

export async function crearPersonaNomina(req: Request, res: Response) {
  const cuerpo = z.object({
    nombre: z.string().trim().min(3).max(200),
    banco: z.string().trim().max(80).nullable().optional(),
    monto: importe.optional(),
    pagado: z.boolean().optional(),
  }).safeParse(req.body)

  if (!cuerpo.success) return ApiResponse.error(res, 'Datos inválidos para agregar a la nómina', 400)

  try {
    const r = await agregarPersonaNomina({ ...cuerpo.data, usuario: quien(req) })
    return ApiResponse.created(res, r)
  } catch (e) {
    return responderError(res, e)
  }
}

export async function editarProduccion(req: Request, res: Response) {
  const cuerpo = z.object({
    bloqueTitulo: z.string().min(3).max(200),
    tipo: z.string().min(1).max(120),
    mes,
    valor: z.number().finite().min(0).max(1e6).nullable(),
    valorAnterior: z.number().finite().nullable(),
  }).safeParse(req.body)

  if (!cuerpo.success) return ApiResponse.error(res, 'Datos inválidos para editar la producción', 400)

  try {
    const r = await actualizarProduccion({ ...cuerpo.data, usuario: quien(req) })
    return ApiResponse.success(res, r)
  } catch (e) {
    return responderError(res, e)
  }
}

export async function editarTarifario(req: Request, res: Response) {
  const cuerpo = z.object({
    bloque: z.enum(['salarios', 'videos', 'ediciones']),
    concepto: z.string().min(1).max(160),
    valor: importe,
    valorAnterior: importe,
  }).safeParse(req.body)

  if (!cuerpo.success) return ApiResponse.error(res, 'Datos inválidos para editar el tarifario', 400)

  try {
    const r = await actualizarTarifario({ ...cuerpo.data, usuario: quien(req) })
    return ApiResponse.success(res, r)
  } catch (e) {
    return responderError(res, e)
  }
}
