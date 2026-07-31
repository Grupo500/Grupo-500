import * as Sentry from '@sentry/node'

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
  })
}
