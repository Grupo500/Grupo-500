import { NextRequest, NextResponse } from 'next/server'

// Proxy para servir PDFs desde Cloudinary sin restricciones de iframe
// Cloudinary raw files tienen X-Frame-Options: DENY — este proxy los sirve
// desde el mismo origen de Vercel, evitando el bloqueo.
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return new NextResponse('URL requerida', { status: 400 })
  }

  // Solo permitir URLs de Cloudinary (seguridad)
  const allowed = ['res.cloudinary.com', 'cloudinary.com']
  const isAllowed = allowed.some(domain => {
    try { return new URL(url).hostname.endsWith(domain) } catch { return false }
  })

  if (!isAllowed) {
    return new NextResponse('URL no permitida', { status: 403 })
  }

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Grupo500Bot/1.0)' },
    })

    if (!response.ok) {
      return new NextResponse('Error al obtener el archivo', { status: response.status })
    }

    const buffer = await response.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': 'inline',
        'Cache-Control':       'public, max-age=3600',
        // Sin X-Frame-Options → permite el iframe desde el mismo origen
      },
    })
  } catch {
    return new NextResponse('Error interno', { status: 500 })
  }
}
