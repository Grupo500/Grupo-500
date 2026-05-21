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
  providers: [
    Google({
      clientId:     process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
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
          image: user.imageUrl,
          role:  user.role,
        }
      },
    }),
  ],
})
