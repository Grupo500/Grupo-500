import { auth } from '@/auth'
import { encode } from 'next-auth/jwt'
import { NextResponse } from 'next/server'

// Genera un JWT firmado para que los Client Components puedan llamar al Express API
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const token = await encode({
    token: {
      sub:   session.user.id,
      email: session.user.email ?? '',
      role:  session.user.role,
    },
    secret: process.env.NEXTAUTH_SECRET!,
    salt:   'authjs.session-token',
  })

  return NextResponse.json({ token })
}
