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
      const isPublicPage     = ['/sign-in', '/sign-up', '/no-autorizado', '/verificando'].some(p =>
        request.nextUrl.pathname.startsWith(p)
      )

      if (isLoggedIn && isAuthPage) {
        return NextResponse.redirect(new URL('/dashboard', request.nextUrl))
      }
      if (!isLoggedIn && !isPublicPage) {
        return NextResponse.redirect(new URL('/sign-in', request.nextUrl))
      }
      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.id   = user.id ?? token.sub ?? ''
        token.role = (user as any).role ?? 'VENDEDOR'
      }
      return token
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id   = token.id   as string
        session.user.role = token.role as 'ADMIN' | 'VENDEDOR'
      }
      return session
    },
  },
  providers: [], // Se completan en auth.ts
}
