import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { SignJWT } from 'jose'
import { prisma } from '@/lib/prisma'

/** "Chrome en Windows", sacado del user-agent, para la lista de sesiones. */
function describirAgente(ua: string): { navegador: string | null; dispositivo: string | null } {
  const dispositivo = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Macintosh|Mac OS/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : null
  const navegador = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : null
  return { navegador, dispositivo }
}

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

  // La sesión abierta, como fila: este punto se toca en cada carga de
  // pantalla, así que aquí se anota (o se refresca) dónde está abierta la
  // cuenta. Es lo que Ajustes > Seguridad lista y lo que "cerrar las demás"
  // apaga (Hotman, 22-ago).
  const sid = session.user.sid
  if (sid && session.user.id) {
    const ua = (await headers()).get('user-agent') ?? ''
    const { navegador, dispositivo } = describirAgente(ua)
    await prisma.sesionActiva.upsert({
      where:  { sid },
      create: { sid, userId: session.user.id, navegador, dispositivo },
      update: { ultimaVezEn: new Date(), navegador, dispositivo },
    }).catch(() => {})
  }

  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)

  const token = await new SignJWT({
    sub:   session.user.id,
    email: session.user.email ?? '',
    role:  session.user.role,
    ...(sid ? { sid } : {}),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)

  return NextResponse.json({ token })
}
