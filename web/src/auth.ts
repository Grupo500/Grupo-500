import NextAuth from 'next-auth'
import Google      from 'next-auth/providers/google'
import Microsoft   from 'next-auth/providers/microsoft-entra-id'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { jwtVerify } from 'jose'
import { authConfig } from './auth.config'
import { prisma } from '@/lib/prisma'

// Huella del documento (contraseña del estudiante), idéntica a la app de simulacros.
// El documento nunca se guarda en texto plano: en la DB vive como este hash.
export function hashDocumento(documento: string): string {
  return createHash('sha256').update(`sim:${documento.trim()}`).digest('hex')
}

/**
 * Entrar con una cuenta Microsoft (Hotmail, Outlook, Live).
 *
 * Media docena del equipo no tiene Gmail, así que el botón de Google no les
 * sirve y solo pueden entrar con contraseña. Esto les da la misma puerta.
 *
 * Va condicionado a que existan las credenciales: sin ellas el proveedor se
 * registraría con clientId vacío y el botón llevaría a un error de Microsoft.
 * Así, mientras no estén configuradas en Vercel, simplemente no existe.
 *
 * El emisor por defecto es `common`, que es justo el que acepta cuentas
 * personales además de las corporativas. Para que funcione, la app en el
 * portal de Microsoft debe estar registrada como "cuentas de cualquier
 * directorio y cuentas personales de Microsoft".
 */
const microsoft = process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET
  ? [Microsoft({
      clientId:     process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      // Quien ya tiene cuenta con contraseña entra con Microsoft al mismo
      // perfil, en vez de que se le cree uno duplicado con el mismo correo.
      allowDangerousEmailAccountLinking: true,
      // El perfil por defecto lee el correo de `email` y además baja la foto
      // desde Microsoft Graph. En las cuentas personales `email` suele venir
      // vacío —el correo está en `preferred_username`— y sin correo el
      // usuario no se puede cruzar con su asesor. La foto se deja de lado:
      // la app ya cae en las iniciales cuando no hay imagen.
      profile: (perfil: any) => ({
        id:    perfil.sub,
        name:  perfil.name ?? null,
        email: perfil.email ?? perfil.preferred_username ?? null,
        image: null,
        // Solo se usa si Microsoft trae un correo que no existe en la app y
        // hay que crear la cuenta. A quien ya está registrado se le respeta
        // el rol de la base: el callback jwt lo lee de ahí.
        role: 'VENDEDOR' as const,
      }),
    })]
  : []

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      // Cuenta suspendida: se le niega la entrada desde la puerta. El API
      // también la rechaza en cada petición (CUENTA_SUSPENDIDA), así que una
      // sesión que ya estaba abierta muere sola — esto solo evita abrir nuevas.
      if (user.email) {
        const cuenta = await prisma.user.findFirst({
          where:  { email: { equals: user.email.trim(), mode: 'insensitive' } },
          select: { suspendido: true },
        })
        if (cuenta?.suspendido) return false
      }
      // Al entrar con Google, actualizar la foto en la DB con la del perfil de Google
      if (account?.provider === 'google' && profile?.sub && user.email) {
        const picture = (profile as any).picture as string | undefined
        if (picture) {
          await prisma.user.updateMany({
            // Email insensible a mayúsculas
            where: { email: { equals: user.email.trim(), mode: 'insensitive' } },
            data:  { image: picture },
          })
        }
      }
      return true
    },
    async jwt({ token, user, account, profile, trigger, session }) {
      // Un update() con datos (desde Ajustes) se aplica AL INSTANTE: el nombre
      // nuevo no debe esperar el viaje de vuelta a la base para verse en el
      // menu — la base se relee igual abajo, como confirmacion.
      if (trigger === 'update' && (session as any)?.name) {
        token.name = (session as any).name
      }
      // Login inicial: guardar datos en el token
      if (user) {
        token.id    = user.id ?? token.sub ?? ''
        token.role  = (user as any).role ?? 'VENDEDOR'
        token.image = user.image ?? null
      }
      // Google OAuth: foto del perfil de Google
      if (account?.provider === 'google' && profile) {
        token.image = (profile as any).picture ?? token.image ?? null
      }

      // La base manda sobre el nombre y el correo.
      //
      // Antes solo se leían "si el token no los traía", así que el nombre de
      // Google se quedaba pegado: alguien cambiaba su nombre en Ajustes, se
      // guardaba bien en la base, y el menú de arriba seguía mostrando el
      // viejo hasta el fin de los tiempos —volver a entrar tampoco servía,
      // porque el login lo repone desde Google—. Aquí es donde se decide qué
      // nombre lleva la persona en la app, y ese es el que ella escribió.
      //
      // Se relee al entrar, al guardar el perfil (`update`), cuando falte algo,
      // y si no se relee hace más de cinco minutos. Ese último caso es el que
      // importa: sin él, a quien cambia su nombre desde otro dispositivo —o a
      // quien un admin le cambia el rol— la sesión le seguiría mostrando lo
      // viejo hasta cerrar sesión. Consultar en cada petición sería una consulta
      // por navegación; cinco minutos es barato y se siente inmediato.
      const VENCE = 5 * 60_000
      const leidoEn = (token as any).leidoEn as number | undefined
      const releer = Boolean(user) || trigger === 'update' ||
                     !token.image || !token.name ||
                     !leidoEn || Date.now() - leidoEn > VENCE

      if (releer && token.sub) {
        let dbUser = await prisma.user.findUnique({
          where:  { id: token.sub },
          select: { id: true, image: true, nombre: true, email: true, role: true },
        })
        // Sesión huérfana: el usuario del token ya no existe con ese id. Pasó
        // masivamente el 18-ago-2026 —el borrado de la base recreó las cuentas
        // con ids nuevos— y toda sesión anterior quedó apuntando al vacío: el
        // API respondía USUARIO_NO_REGISTRADO a todo y las pantallas se veían
        // en ceros. Se re-resuelve por correo, que sobrevive a la reencarnación.
        if (!dbUser && token.email) {
          dbUser = await prisma.user.findFirst({
            where:  { email: { equals: String(token.email), mode: 'insensitive' } },
            select: { id: true, image: true, nombre: true, email: true, role: true },
          })
          if (dbUser) {
            token.sub = dbUser.id
            token.id  = dbUser.id
          }
        }
        if (dbUser) {
          if (dbUser.nombre) token.name = dbUser.nombre
          if (dbUser.email)  token.email = dbUser.email
          if (dbUser.role)   token.role = dbUser.role
          if (dbUser.image && !token.image) token.image = dbUser.image

          // La foto de Google vive en el token desde que la persona entró,
          // pero si nunca llegó a la base, NADIE MÁS la ve: el resto de la
          // app lee la foto de la base, no de la sesión ajena. Le pasó a casi
          // todo el equipo de marketing —se veían a sí mismos con foto y entre
          // ellos con iniciales—. Aquí se cura sola en la siguiente relectura.
          if (!dbUser.image && token.image) {
            await prisma.user.update({
              where: { id: dbUser.id },
              data:  { image: String(token.image) },
            }).catch(() => {})
          }
        }
        ;(token as any).leidoEn = Date.now()
      }
      return token
    },
  },
  providers: [
    Google({
      clientId:     process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    ...microsoft,
    Credentials({
      credentials: {
        email:    { label: 'Email',      type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = z.object({
          email:    z.string().email(),
          password: z.string().min(1),
        }).safeParse(credentials)

        if (!parsed.success) return null

        // Comparación de email insensible a mayúsculas
        const user = await prisma.user.findFirst({
          where: { email: { equals: parsed.data.email.trim(), mode: 'insensitive' } },
        })

        if (!user?.hashedPassword) return null

        const valid = await bcrypt.compare(parsed.data.password, user.hashedPassword)
        if (!valid) return null

        return {
          id:    user.id,
          email: user.email,
          name:  user.nombre,
          image: user.image,
          role:  user.role,
        }
      },
    }),
    // Estudiantes de simulacros — login con correo + número de documento.
    // No están en la tabla User (staff); viven en EstudianteExamen.
    Credentials({
      id: 'estudiante',
      credentials: {
        email:     { label: 'Correo',    type: 'email' },
        documento: { label: 'Documento', type: 'text'  },
      },
      async authorize(credentials) {
        const parsed = z.object({
          email:     z.string().email(),
          documento: z.string().min(1),
        }).safeParse(credentials)

        if (!parsed.success) return null

        const estudiante = await prisma.estudianteExamen.findFirst({
          where: {
            email:         { equals: parsed.data.email.trim(), mode: 'insensitive' },
            documentoHash: hashDocumento(parsed.data.documento),
          },
        })

        if (!estudiante) return null

        return {
          id:    estudiante.id,
          email: estudiante.email,
          name:  estudiante.nombre,
          role:  'ESTUDIANTE' as const,
        }
      },
    }),

    // Passkeys / WebAuthn — recibe JWT firmado por el API tras verificar la biometría
    Credentials({
      id: 'credentials-passkey',
      credentials: { token: { label: 'Token', type: 'text' } },
      async authorize(credentials) {
        if (!credentials?.token) return null

        try {
          const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
          const { payload } = await jwtVerify(String(credentials.token), secret)

          if (!payload.sub) return null

          const user = await prisma.user.findUnique({
            where: { id: payload.sub },
          })

          if (!user) return null

          return {
            id:    user.id,
            email: user.email,
            name:  user.nombre,
            image: user.image,
            role:  user.role,
          }
        } catch {
          return null
        }
      },
    }),
  ],
})
