import { DefaultSession, DefaultUser } from 'next-auth'
import { DefaultJWT } from 'next-auth/jwt'

// Roles del sistema: staff (ADMIN/VENDEDOR) + estudiantes de simulacros (ESTUDIANTE)
type Rol = 'ADMIN' | 'VENDEDOR' | 'ESTUDIANTE'

declare module 'next-auth' {
  interface Session {
    user: {
      id:   string
      role: Rol
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    role: Rol
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id:   string
    role: Rol
  }
}
