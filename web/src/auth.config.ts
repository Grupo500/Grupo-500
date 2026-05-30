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
      const isAuthPage       = request.nextUrl.pathname.startsWith('/sign-in')
      const isPublicPage     = [
        '/sign-in', '/sign-up', '/no-autorizado', '/verificando',
        '/inscripcion', // Hub de inscripciones y formulario público
      ].some(p => request.nextUrl.pathname.startsWith(p))
        || request.nextUrl.pathname === '/' // Landing page

      if (isLoggedIn && isAuthPage) {
        return NextResponse.redirect(new URL('/dashboard', request.nextUrl))
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
      }
      // Google OAuth: tomar foto del perfil de Google si no tenemos una
      if (account?.provider === 'google' && profile) {
        token.image = (profile as any).picture ?? token.image ?? null
      }
      return token
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id    = token.id    as string
        session.user.role  = token.role  as 'ADMIN' | 'VENDEDOR'
        session.user.image = token.image as string | null
      }
      return session
    },
  },
  providers: [], // Se completan en auth.ts
}
