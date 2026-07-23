import type { NextAuthConfig } from 'next-auth'
import { NextResponse } from 'next/server'

// Configuración edge-compatible (sin adapter, sin imports pesados)
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/sign-in',
    error:  '/sign-in',
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn       = !!auth?.user
      const path             = request.nextUrl.pathname
      const isAuthPage       = path.startsWith('/sign-in')
      // Solo la landing y el registro de Brito son públicos — el resto
      // (/brito/mapa, /brito/leccion/*, /brito/ranking) exige sesión ESTUDIANTE.
      const isBritoPublic    = path === '/brito' || path.startsWith('/brito/registro')
      const isPublicPage     = isBritoPublic || [
        '/sign-in', '/sign-up', '/no-autorizado', '/verificando',
        '/inscripcion',       // Hub de inscripciones, formularios públicos y builder forms
        '/examenes/acceso',   // Login de estudiantes (correo + documento)
        '/privacidad',        // Política de privacidad (pública, requerida por Play Store/App Store)
      ].some(p => path.startsWith(p))

      if (isLoggedIn && isAuthPage) {
        return NextResponse.redirect(new URL('/inicio', request.nextUrl))
      }
      if (!isLoggedIn && !isPublicPage) {
        return NextResponse.redirect(new URL('/sign-in', request.nextUrl))
      }
      return true
    },
    jwt({ token, user, account, profile }) {
      if (user) {
        token.id    = user.id ?? token.sub ?? ''
        token.role  = (user as any).role ?? 'VENDEDOR'
        token.image = user.image ?? null
        if (user.name) token.name = user.name
      }
      // Google OAuth: tomar foto y nombre del perfil de Google
      if (account?.provider === 'google' && profile) {
        token.image = (profile as any).picture ?? token.image ?? null
        if ((profile as any).name && !token.name) token.name = (profile as any).name
      }
      return token
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id    = token.id    as string
        session.user.role  = token.role  as 'ADMIN' | 'VENDEDOR' | 'ESTUDIANTE'
        session.user.image = token.image as string | null
        if (token.name) session.user.name = token.name as string
      }
      return session
    },
  },
  providers: [], // Se completan en auth.ts
}
