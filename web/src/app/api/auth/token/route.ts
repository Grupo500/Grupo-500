import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'

// Genera un JWT estándar HS256 para que los Client Components puedan llamar al Express API
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)

  const token = await new SignJWT({
    sub:   session.user.id,
    email: session.user.email ?? '',
    role:  session.user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)

  return NextResponse.json({ token })
}
