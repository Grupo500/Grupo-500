import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { estadoRegistro, quincenaActual } from '@/lib/contabilidadMarketing'

// Exporta la quincena completa a CSV (solo contabilidad/ADMIN).
// Con BOM y «;» como separador para que Excel en es-CO lo abra directo.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (((session?.user as any)?.role ?? '') !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo contabilidad puede exportar.' }, { status: 403 })
  }

  const q = req.nextUrl.searchParams.get('q') ?? quincenaActual()
  if (!/^\d{4}-\d{2}-Q[12]$/.test(q)) {
    return NextResponse.json({ error: 'Quincena inválida.' }, { status: 400 })
  }

  const registros = await prisma.contabRegistro.findMany({
    where: { quincena: q },
    include: { persona: { include: { dept: true } } },
    orderBy: [{ persona: { deptId: 'asc' } }, { persona: { nombre: 'asc' } }, { id: 'asc' }],
  })

  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const filas = [
    ['Departamento', 'Persona', 'Cédula', 'Categoría', 'Actividad', 'Fecha', 'Valor COP', 'Estado', 'Revisado', 'Link'],
    ...registros.map(r => [
      r.persona.dept.nombre, r.persona.nombre, r.persona.cedula ?? '',
      r.categoria, r.actividad, r.fecha, r.valor,
      estadoRegistro(r), r.revisado ? 'Sí' : 'No', r.link ?? '',
    ]),
  ]
  const csv = '﻿' + filas.map(f => f.map(esc).join(';')).join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="contabilidad-${q}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
