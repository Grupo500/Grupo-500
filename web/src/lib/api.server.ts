import { auth } from '@/auth'
import { encode } from 'next-auth/jwt'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const session = await auth()

  let token: string | undefined

  if (session?.user) {
    // Generar JWT firmado con el secret de NextAuth para el Express API
    token = await encode({
      token: {
        sub:   session.user.id,
        email: session.user.email ?? '',
        role:  session.user.role,
      },
      secret: process.env.NEXTAUTH_SECRET!,
      salt:   'authjs.session-token',
    })
  }

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
