const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// Cliente para componentes 'use client' — recibe el token de Clerk via useAuth()
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

    return res.json()
  }
}
