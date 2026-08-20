import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { prisma } from '@/lib/prisma'

// Genera un JWT estándar HS256 para que los Client Components puedan llamar al Express API
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Rescate de la foto de Google: vive en la sesión desde que la persona entró,
  // pero si nunca llegó a la base NADIE MÁS la ve —el resto de la app lee la
  // foto de la base, no de la sesión ajena—. Aquí se guarda, y este punto se
  // toca en cada carga de pantalla, así que no hay que esperar a que venza el
  // token para que aparezca. Solo escribe si la base está vacía: una foto
  // subida a mano desde Ajustes manda sobre la de Google.
  if (session.user.image && session.user.id) {
    await prisma.user.updateMany({
      where: { id: session.user.id, image: null },
      data:  { image: session.user.image },
    }).catch(() => {})
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
