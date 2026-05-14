import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/no-autorizado(.*)',
  '/verificando(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl

  // Rutas públicas: dejar pasar sin verificación
  if (isPublicRoute(request)) {
    return NextResponse.next()
  }

  // Rutas protegidas: primero verificar sesión Clerk
  const { userId, getToken } = await auth()
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  // Verificar que el usuario esté registrado en la DB
  // Esta verificación ocurre ANTES de que cualquier página renderice
  try {
    const token = await getToken()
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

    const res = await fetch(`${API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token ?? ''}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      // No está en DB → acceso denegado, sin importar cómo llegó aquí
      return NextResponse.redirect(new URL('/no-autorizado', request.url))
    }
  } catch {
    // Si el API falla (error de red, timeout) → bloquear por seguridad
    return NextResponse.redirect(new URL('/no-autorizado', request.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
