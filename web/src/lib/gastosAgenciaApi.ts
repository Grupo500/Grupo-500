// Cliente de escritura del panel de gastos de agencia.
//
// No usa `apiFetch` porque el fetcher compartido se queda solo con `error` y
// descarta el resto del cuerpo. Aquí hace falta el `valorActual` que devuelve el
// 409 para poder decirle al usuario qué dice el sheet ahora en vez de un
// "conflicto" a secas.

import { getClientToken } from '@/lib/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

export class ErrorGastos extends Error {
  constructor(
    mensaje: string,
    public status: number,
    public valorActual?: string | number | boolean | null,
  ) {
    super(mensaje)
    this.name = 'ErrorGastos'
  }
  /** El dato cambió en el sheet desde que se cargó el panel. */
  get esConflicto() { return this.status === 409 }
  /** Falta la cuenta de servicio: la edición está apagada en el servidor. */
  get esSinConfigurar() { return this.status === 503 }
}

async function pedir<T>(ruta: string, metodo: 'PUT' | 'POST', cuerpo: unknown): Promise<T> {
  const token = await getClientToken()
  const res = await fetch(`${API_URL}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(cuerpo),
  })

  const datos = await res.json().catch(() => null) as
    { success?: boolean; data?: T; error?: string; valorActual?: string | number | boolean | null } | null

  if (!res.ok) {
    throw new ErrorGastos(
      datos?.error ?? `No pude guardar (HTTP ${res.status})`,
      res.status,
      datos?.valorActual,
    )
  }
  return datos?.data as T
}

const RUTA = '/finanzas/gastos-agencia'

export const guardarContabilidad = (cuerpo: {
  anio: string; categoriaClave: string; mes: number
  valor: number | null; valorAnterior: number | null
}) => pedir<{ valor: number | null }>(`${RUTA}/contabilidad`, 'PUT', cuerpo)

export const guardarNomina = (cuerpo: {
  indice: number; nombreEsperado: string
  campo: 'monto' | 'pagado' | 'banco'
  valor: number | boolean | string | null
  valorAnterior: number | boolean | string | null
}) => pedir<{ valor: unknown }>(`${RUTA}/nomina`, 'PUT', cuerpo)

export const crearPersonaNomina = (cuerpo: {
  nombre: string; banco?: string | null; monto?: number | null; pagado?: boolean
}) => pedir<{ fila: number }>(`${RUTA}/nomina`, 'POST', cuerpo)

export const guardarProduccion = (cuerpo: {
  bloqueTitulo: string; tipo: string; mes: number
  valor: number | null; valorAnterior: number | null
}) => pedir<{ valor: number | null }>(`${RUTA}/produccion`, 'PUT', cuerpo)

export const guardarTarifario = (cuerpo: {
  bloque: 'salarios' | 'videos' | 'ediciones'; concepto: string
  valor: number | null; valorAnterior: number | null
}) => pedir<{ valor: number | null }>(`${RUTA}/tarifario`, 'PUT', cuerpo)
