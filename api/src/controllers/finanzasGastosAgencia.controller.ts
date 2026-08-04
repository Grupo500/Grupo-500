import { Request, Response } from 'express'
import { ApiResponse } from '../utils/response'
import {
  obtenerGastosAgencia, gastosAgenciaConfigurado, ultimoSnapshot,
} from '../services/gastosAgencia'

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
    return ApiResponse.error(
      res,
      'Falta configurar GASTOS_AGENCIA_SHEET_ID en el servidor',
      503,
    )
  }

  try {
    const datos = await obtenerGastosAgencia(req.query.refrescar === '1')
    return ApiResponse.success(res, datos)
  } catch (e) {
    // Antes de dejar el panel en blanco, servimos la última copia buena.
    const previo = ultimoSnapshot()
    if (previo) {
      return ApiResponse.success(res, {
        ...previo,
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
