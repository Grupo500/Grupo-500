const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// Cliente para componentes 'use client' — recibe el token via useClientToken()
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

// Helper para obtener token JWT desde la sesión del cliente
// Llama al endpoint /api/auth/token que genera el JWT para el Express API
export async function getClientToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/token')
    if (!res.ok) return null
    const { token } = await res.json()
    return token
  } catch {
    return null
  }
}
