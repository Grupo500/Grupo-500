import * as Sentry from '@sentry/node'
import { redactarUrl, redactarQueryString } from './utils/redactar'

/**
 * Quita las credenciales de todo lo que se envía a Sentry.
 *
 * `setupExpressErrorHandler` adjunta los datos de la petición por su cuenta, así
 * que redactar la URL en nuestro errorHandler no alcanzaba: la URL cruda se iba
 * igual. Y con muestreo de trazas activo también viaja en el nombre de la
 * transacción y en los atributos de los spans, o sea en peticiones que ni
 * fallaron.
 *
 * Sentry es un tercero: un token que llegue ahí sigue siendo válido hasta que
 * expira.
 */
function limpiarCredenciales<T extends object>(evento: T): T {
  const e = evento as Record<string, any>
  const req = e.request as { url?: string; query_string?: unknown } | undefined
  if (req?.url) req.url = redactarUrl(req.url)
  if (typeof req?.query_string === 'string') {
    req.query_string = redactarQueryString(req.query_string)
  } else if (req?.query_string && typeof req.query_string === 'object') {
    // Sentry también lo manda como pares; se redacta clave por clave.
    const pares = req.query_string as Record<string, unknown>
    for (const clave of Object.keys(pares)) {
      if (redactarQueryString(`${clave}=x`) !== `${clave}=x`) pares[clave] = '***'
    }
  }

  // El nombre de la transacción suele ser la ruta, pero no siempre.
  if (typeof e.transaction === 'string') {
    e.transaction = redactarUrl(e.transaction)
  }

  // Atributos de spans donde Sentry guarda la URL completa.
  const CLAVES_URL = ['http.url', 'url.full', 'url.query', 'http.target', 'http.query']
  const spans = e.spans as { data?: Record<string, unknown> }[] | undefined
  for (const span of spans ?? []) {
    for (const clave of CLAVES_URL) {
      const v = span.data?.[clave]
      if (typeof v === 'string') {
        span.data![clave] = clave.endsWith('query') ? redactarQueryString(v) : redactarUrl(v)
      }
    }
  }
  const datos = (e.contexts as { trace?: { data?: Record<string, unknown> } } | undefined)?.trace?.data
  for (const clave of CLAVES_URL) {
    const v = datos?.[clave]
    if (typeof v === 'string') {
      datos![clave] = clave.endsWith('query') ? redactarQueryString(v) : redactarUrl(v)
    }
  }

  return evento
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    // Ruido no accionable: el cliente (ej. webhook de Trengo) corta la conexión
    // antes de que terminemos de leer el body, o Railway tiene un blip interno
    // pasajero entre el backend y Postgres. Ninguno de los dos indica un bug
    // nuestro — ver issues GRUPO500-API-C y GRUPO500-API-D.
    ignoreErrors: [
      'request aborted',
      /Can't reach database server/,
    ],
    beforeSend: (evento) => limpiarCredenciales(evento),
    beforeSendTransaction: (evento) => limpiarCredenciales(evento),
  })
}
