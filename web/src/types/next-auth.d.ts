import { DefaultSession, DefaultUser } from 'next-auth'
import { DefaultJWT } from 'next-auth/jwt'

// La lista vive en un solo sitio (`@/lib/roles`) para que sumar un rol no
// obligue a acordarse de este archivo, que es de los que nadie mira.
import type { Rol } from '@/lib/roles'

declare module 'next-auth' {
  interface Session {
    user: {
      id:   string
      role: Rol
      /** La sesión abierta (SesionActiva.sid); viaja al API dentro del token. */
      sid?: string
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
    sid?: string
  }
}
