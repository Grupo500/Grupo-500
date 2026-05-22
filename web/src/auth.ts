import NextAuth from 'next-auth'
import Google      from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { authConfig } from './auth.config'
import { prisma } from '@/lib/prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      // Al entrar con Google, actualizar la foto en la DB con la del perfil de Google
      if (account?.provider === 'google' && profile?.sub && user.email) {
        const picture = (profile as any).picture as string | undefined
        if (picture) {
          await prisma.user.updateMany({
            where: { email: user.email },
            data:  { image: picture },
          })
        }
      }
      return true
    },
  },
  providers: [
    Google({
      clientId:     process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
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

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
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
  ],
})
