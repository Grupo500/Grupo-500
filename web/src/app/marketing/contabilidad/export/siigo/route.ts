import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { quincenaActual } from '@/lib/contabilidadMarketing'
import {
  FilaSiigo, LARGO_DESCRIPCION, LARGO_OBSERVACIONES, fechaSiigo, libroSiigo, recortar,
} from '@/lib/siigo'

// Comprobante contable de la quincena en el formato de importación de Siigo.
// Los códigos del plan de cuentas no se inventan ni se queman en el código:
// viven en ConfigApp, igual que las credenciales de Meta. Si falta alguno, la
// descarga se niega y dice cuál — un archivo con códigos inventados lo rechaza
// Siigo en el mejor caso, y en el peor entra mal a la contabilidad.

const CLAVES = {
  tipo: 'SIIGO_TIPO_COMPROBANTE',
  consecutivo: 'SIIGO_CONSECUTIVO',
  gasto: 'SIIGO_CUENTA_GASTO',
  contrapartida: 'SIIGO_CUENTA_CONTRAPARTIDA',
} as const

const NOMBRE_LEGIBLE: Record<string, string> = {
  SIIGO_TIPO_COMPROBANTE: 'Tipo de comprobante (código numérico de 3 dígitos)',
  SIIGO_CONSECUTIVO: 'Consecutivo del comprobante',
  SIIGO_CUENTA_GASTO: 'Código de la cuenta contable del gasto (nivel transaccional)',
  SIIGO_CUENTA_CONTRAPARTIDA: 'Código de la cuenta contable de la contrapartida (crédito)',
}

/** Último día de la quincena: Q1 cierra el 15, Q2 el último del mes. */
function fechaCierre(quincena: string): Date {
  const [anio, mes, q] = [Number(quincena.slice(0, 4)), Number(quincena.slice(5, 7)), quincena.slice(8)]
  return q === 'Q1' ? new Date(anio, mes - 1, 15) : new Date(anio, mes, 0)
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (((session?.user as any)?.role ?? '') !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo contabilidad puede exportar.' }, { status: 403 })
  }

  const q = req.nextUrl.searchParams.get('q') ?? quincenaActual()
  if (!/^\d{4}-\d{2}-Q[12]$/.test(q)) {
    return NextResponse.json({ error: 'Quincena inválida.' }, { status: 400 })
  }

  const [config, registros] = await Promise.all([
    prisma.configApp.findMany({ where: { clave: { startsWith: 'SIIGO_' } } }),
    prisma.contabRegistro.findMany({
      where: { quincena: q, rechazado: false },
      include: { persona: { include: { dept: true } } },
      orderBy: [{ persona: { deptId: 'asc' } }, { persona: { nombre: 'asc' } }, { id: 'asc' }],
    }),
  ])

  const valor = new Map(config.map(c => [c.clave, c.valor.trim()]))
  const faltantes = Object.values(CLAVES).filter(k => !valor.get(k)).map(k => NOMBRE_LEGIBLE[k])

  if (registros.length === 0) {
    return NextResponse.json({ error: 'Esta quincena no tiene registros para exportar.' }, { status: 400 })
  }

  // La identificación del tercero es obligatoria en el modelo y sale de la
  // cédula de cada persona. Sin ella Siigo rechaza la fila, así que se avisa
  // por nombre en vez de exportar el comprobante incompleto.
  const sinCedula = [...new Set(
    registros.filter(r => !r.persona.cedula?.trim()).map(r => r.persona.nombre),
  )].sort()

  if (faltantes.length > 0 || sinCedula.length > 0) {
    return NextResponse.json({
      error: 'Falta información para armar el comprobante; sin ella Siigo rechaza la importación.',
      configuracionPendiente: faltantes,
      personasSinCedula: sinCedula,
      comoResolver: faltantes.length > 0
        ? 'Los códigos contables se guardan en ConfigApp con las claves SIIGO_*.'
        : 'Agrega la cédula en la ficha de cada persona.',
    }, { status: 409 })
  }

  const fecha = fechaSiigo(fechaCierre(q))
  const comunes = {
    tipoComprobante: valor.get(CLAVES.tipo)!,
    consecutivoComprobante: valor.get(CLAVES.consecutivo)!,
    fechaElaboracion: fecha,
  }

  // Partida doble: cada actividad entra como gasto al débito y como cuenta por
  // pagar a la persona al crédito, de modo que el comprobante siempre cuadra.
  const filas: FilaSiigo[] = []
  for (const r of registros) {
    const centro = valor.get(`SIIGO_CENTRO_${r.persona.deptId.toUpperCase()}`) ?? ''
    const base = {
      ...comunes,
      identificacionTercero: r.persona.cedula!.trim(),
      centroCostos: centro,
      descripcion: recortar(r.actividad, LARGO_DESCRIPCION),
      observaciones: recortar(`${r.categoria} · ${r.persona.dept.nombre} · ${r.fecha}`, LARGO_OBSERVACIONES),
    }
    filas.push({ ...base, codigoCuenta: valor.get(CLAVES.gasto)!, debito: r.valor })
    filas.push({ ...base, codigoCuenta: valor.get(CLAVES.contrapartida)!, credito: r.valor })
  }

  const archivo = await libroSiigo(filas)
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="comprobante-siigo-${q}.xlsx"`,
    },
  })
}
