import { DefaultSession, DefaultUser } from 'next-auth'
import { DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id:   string
      role: 'ADMIN' | 'VENDEDOR'
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    role: 'ADMIN' | 'VENDEDOR'
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id:   string
    role: 'ADMIN' | 'VENDEDOR'
  }
}
