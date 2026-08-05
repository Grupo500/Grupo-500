// Redacción de datos sensibles antes de escribirlos en cualquier registro.
//
// Hay endpoints que reciben credenciales por query string y no por capricho:
// `EventSource` (SSE) no permite cabeceras custom, así que `/api/eventos` recibe
// el JWT en la URL, y los webhooks de terceros solo permiten configurar una URL.
// Viajan cifrados por HTTPS; el problema es que quedaban escritos en los logs y
// en Sentry, donde siguen siendo válidos hasta que expiran.
//
// Esto no cambia cómo se autentica nada: solo evita que el secreto quede
// guardado.

/** Nombres de query param cuyo valor nunca debe registrarse. */
const PARAMS_SENSIBLES = new Set([
  'token', 'access_token', 'refresh_token', 'id_token',
  'secreto', 'secret', 'client_secret',
  'key', 'apikey', 'api_key', 'apiKey',
  'password', 'clave', 'pass',
  'firma', 'signature', 'sig',
  'code', 'hottok',
  // El ticket de SSE ya es de un solo uso y dura 30 s, pero mientras vive sirve
  // para abrir una conexión: no hay razón para dejarlo escrito.
  'ticket',
])

/**
 * Reemplaza el valor de los query params sensibles por `***`.
 *
 * Trabaja sobre la cadena tal cual, sin decodificar ni reordenar: un log debe
 * parecerse a la petición real, y normalizar la URL escondería justamente los
 * casos raros que uno quiere ver cuando está depurando.
 */
export function redactarUrl(url: string | undefined): string {
  if (!url) return ''
  const corte = url.indexOf('?')
  if (corte < 0) return url

  const base = url.slice(0, corte)
  const partes = url.slice(corte + 1).split('&').map(par => {
    const igual = par.indexOf('=')
    if (igual <= 0) return par
    const nombre = par.slice(0, igual)
    return PARAMS_SENSIBLES.has(nombre.toLowerCase()) ? `${nombre}=***` : par
  })

  return `${base}?${partes.join('&')}`
}

/** Igual que redactarUrl pero sobre un query string suelto, sin el "?". */
export function redactarQueryString(qs: string | undefined): string {
  if (!qs) return ''
  return redactarUrl(`?${qs}`).slice(1)
}

/** ¿La URL trae algún parámetro sensible? Útil para avisar en desarrollo. */
export function tieneParamSensible(url: string | undefined): boolean {
  return redactarUrl(url) !== (url ?? '')
}
