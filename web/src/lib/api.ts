const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// ── Token cache ───────────────────────────────────────────────────────────────
// Evita un round-trip a /api/auth/token en cada query.
// El JWT del Express API dura 1h — cacheamos 50 min para renovar con margen.
let _cachedToken: string | null = null
let _tokenExpiry  = 0
let _fetchPromise: Promise<string | null> | null = null

export async function getClientToken(): Promise<string | null> {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken

  // Evitar race condition: si ya hay una petición en vuelo, esperarla
  if (_fetchPromise) return _fetchPromise

  _fetchPromise = (async () => {
    try {
      const res = await fetch('/api/auth/token')
      if (!res.ok) return null
      const { token } = await res.json()
      _cachedToken  = token
      _tokenExpiry  = Date.now() + 50 * 60 * 1000 // 50 min
      return token
    } catch {
      return null
    } finally {
      _fetchPromise = null
    }
  })()

  return _fetchPromise
}

/** Invalida el caché del token (llamar tras logout o cambio de sesión) */
export function clearTokenCache() {
  _cachedToken = null
  _tokenExpiry  = 0
}

// ── Fetcher cliente ───────────────────────────────────────────────────────────
export function createClientFetcher(token: string | null) {
  return async function clientFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Error desconocido' }))
      throw new Error(error.error || `HTTP ${res.status}`)
    }

    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return null as T
    }

    return res.json()
  }
}

// ── Helper rápido: fetcher ya autenticado en una llamada ──────────────────────
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getClientToken()
  return createClientFetcher(token)(path, options)
}
