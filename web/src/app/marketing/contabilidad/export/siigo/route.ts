import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { quincenaActual } from '@/lib/contabilidadMarketing'
import { libroSiigo } from '@/lib/siigo'
import { armarComprobante } from '@/lib/siigoDatos'

// Comprobante contable de la quincena en el formato de importación de Siigo.
// Se descarga con lo que haya: si aún faltan los códigos del plan de cuentas o
// la cédula de alguien, esas columnas van vacías para que el contador las
// complete en Excel. El archivo se llama "borrador" mientras eso pase, y el
// panel muestra al lado qué es lo que falta.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (((session?.user as any)?.role ?? '') !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo contabilidad puede exportar.' }, { status: 403 })
  }

  const q = req.nextUrl.searchParams.get('q') ?? quincenaActual()
  if (!/^\d{4}-\d{2}-Q[12]$/.test(q)) {
    return NextResponse.json({ error: 'Quincena inválida.' }, { status: 400 })
  }

  const comprobante = await armarComprobante(q)
  if (comprobante.registros === 0) {
    return NextResponse.json({ error: 'Esta quincena no tiene registros para exportar.' }, { status: 400 })
  }

  const archivo = await libroSiigo(comprobante.filas)
  const nombre = `comprobante-siigo-${q}${comprobante.completo ? '' : '-borrador'}.xlsx`

  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombre}"`,
    },
  })
}
