import { auth } from '@/auth'
import { NextResponse } from 'next/server'

// Proxy interno del Panel de Edición: la CSP de la app (connect-src 'self' + Railway)
// bloquea que el navegador llame directo a panel.grupo500educacion.co, así que este
// route handler trae los datos de Trello del lado servidor y los sirve same-origin.
const STATS_URL = 'https://panel.grupo500educacion.co/api/stats'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const res = await fetch(STATS_URL, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data, {
      status: res.status,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json({ error: 'TRELLO_PROXY_ERROR', detail: 'No se pudo consultar el panel' }, { status: 502 })
  }
}
