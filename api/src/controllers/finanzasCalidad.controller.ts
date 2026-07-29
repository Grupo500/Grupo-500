import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { ApiResponse } from '../utils/response'
import { diaColombia } from '../services/ranking'
import { leerUmbrales, guardarUmbrales } from '../services/finanzasParametros'

type Semaforo = 'correcto' | 'revisar' | 'error' | 'informativo'

interface Verificacion {
  area: string
  nombre: string
  resultado: number
  esperado: number | null
  estado: Semaforo
  comentario?: string
  enlace?: string
}

/**
 * Verificaciones sobre los datos cargados.
 *
 * El criterio para el semáforo es qué tan lejos queda la cifra de ser
 * utilizable: "error" es algo que hace mentir a un indicador, "revisar" es
 * algo que conviene mirar pero no invalida nada, e "informativo" es contexto.
 */
export async function controlCalidad(_req: Request, res: Response) {
  const [
    sinAsesor, sinEmail, cuotasSinTotal, pagosSinNeto, pagosSinTrm,
    duplicados, cursosSinFamilia, cursosSinPrecio, inscripcionesSinPrecio,
    pagosAntiguos, totalPagos, totalCursos, inversionCargada,
  ] = await Promise.all([
    prisma.pago.count({ where: { estado: 'PAGADO', asesorId: null } }),
    // `email` no es nulable en Estudiante: el vacío es la cadena en blanco.
    prisma.estudiante.count({ where: { email: '' } }),
    // Un pago marcado como cuota sin saber de cuántas: el saldo no se puede calcular.
    prisma.pago.count({ where: { enPartes: true, OR: [{ cuotasTotal: null }, { cuotasTotal: { lte: 1 } }] } }),
    prisma.pago.count({ where: { estado: 'PAGADO', montoNeto: null } }),
    prisma.pago.count({ where: { estado: 'PAGADO', trm: null } }),
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM (
        SELECT "referenciaPago" FROM "Pago"
        WHERE "referenciaPago" IS NOT NULL AND "referenciaPago" <> ''
        GROUP BY "referenciaPago" HAVING COUNT(*) > 1
      ) d`,
    prisma.curso.count({ where: { familia: null } }),
    prisma.curso.count({ where: { OR: [{ precio: 0 }, { precio: { lt: 0 } }] } }),
    prisma.cursoEstudiante.count({ where: { precioAcordado: null } }),
    prisma.pago.count({ where: { estado: 'PAGADO', fechaPago: { lt: new Date('2026-01-01') } } }),
    prisma.pago.count({ where: { estado: 'PAGADO' } }),
    prisma.curso.count(),
    prisma.inversionPublicitaria.count(),
  ])

  const nDuplicados = Number(duplicados[0]?.n ?? 0)

  const verificaciones: Verificacion[] = [
    // ── Ventas ────────────────────────────────────────────────────────────
    {
      area: 'Ventas', nombre: 'Pagos sin asesor asignado',
      resultado: sinAsesor, esperado: 0,
      estado: sinAsesor === 0 ? 'correcto' : 'revisar',
      comentario: 'No suman a nadie en el ranking ni generan comisión. Suelen ser cargos que Hotmart no atribuyó.',
      enlace: '/finanzas/mix',
    },
    {
      area: 'Ventas', nombre: 'Transacciones repetidas',
      resultado: nDuplicados, esperado: 0,
      estado: nDuplicados === 0 ? 'correcto' : 'error',
      comentario: 'Una misma referencia de Hotmart en más de un pago infla las ventas y lo cobrado.',
    },
    {
      area: 'Ventas', nombre: 'Cuotas sin número total de cuotas',
      resultado: cuotasSinTotal, esperado: 0,
      estado: cuotasSinTotal === 0 ? 'correcto' : 'error',
      comentario: 'Sin saber de cuántas cuotas es el plan no se puede calcular el saldo pendiente.',
    },
    {
      area: 'Ventas', nombre: 'Pagos anteriores a 2026',
      resultado: pagosAntiguos, esperado: 0,
      estado: pagosAntiguos === 0 ? 'correcto' : 'informativo',
      comentario: 'Quedan fuera del acumulado. El inicio del modelo se configura con FINANZAS_FECHA_INICIO.',
    },

    // ── Comisiones y divisa ───────────────────────────────────────────────
    {
      area: 'Comisiones', nombre: 'Pagos sin neto registrado',
      resultado: pagosSinNeto, esperado: 0,
      estado: pagosSinNeto === 0 ? 'correcto' : pagosSinNeto > totalPagos * 0.1 ? 'error' : 'revisar',
      comentario: 'Sin neto no se puede calcular el coste de plataforma ni el valor de vida del cliente.',
    },
    {
      area: 'Comisiones', nombre: 'Pagos sin tasa de cambio',
      resultado: pagosSinTrm, esperado: 0,
      estado: pagosSinTrm === 0 ? 'correcto' : 'informativo',
      comentario: 'Solo afecta a las ventas en dólares. Las ventas en pesos no necesitan tasa.',
    },

    // ── Catálogo ──────────────────────────────────────────────────────────
    {
      area: 'Catálogo', nombre: 'Cursos sin línea de producto',
      resultado: cursosSinFamilia, esperado: 0,
      estado: cursosSinFamilia === 0 ? 'correcto' : 'revisar',
      comentario: 'Sus ventas caen en "Sin clasificar" dentro del mix comercial.',
      enlace: '/finanzas/mix',
    },
    {
      area: 'Catálogo', nombre: 'Cursos con precio en cero',
      resultado: cursosSinPrecio, esperado: 0,
      estado: cursosSinPrecio === 0 ? 'correcto' : 'revisar',
      comentario: 'Sin precio de lista no hay contra qué contrastar lo que se cobró.',
      enlace: '/finanzas/precio',
    },
    {
      area: 'Catálogo', nombre: 'Inscripciones sin precio acordado',
      resultado: inscripcionesSinPrecio, esperado: 0,
      estado: inscripcionesSinPrecio === 0 ? 'correcto' : 'informativo',
      comentario: 'Se usa el precio de lista del curso como referencia.',
    },

    // ── Publicidad ────────────────────────────────────────────────────────
    {
      area: 'Publicidad', nombre: 'Campañas de inversión cargadas',
      resultado: inversionCargada, esperado: null,
      estado: inversionCargada === 0 ? 'revisar' : 'informativo',
      comentario: inversionCargada === 0
        ? 'Sin inversión cargada no se pueden calcular el CAC ni el MER.'
        : 'El gasto se prorratea por los días del período declarado.',
      enlace: '/finanzas/marketing',
    },
  ]

  const cuenta = (e: Semaforo) => verificaciones.filter(v => v.estado === e).length

  return ApiResponse.success(res, {
    verificadoEn: diaColombia(new Date()),
    resumen: {
      errores: cuenta('error'),
      porRevisar: cuenta('revisar'),
      correctas: cuenta('correcto'),
      informativas: cuenta('informativo'),
      total: verificaciones.length,
    },
    contexto: { pagos: totalPagos, cursos: totalCursos },
    verificaciones,
  })
}

/** Lectura de todo lo configurable del área. */
export async function parametros(_req: Request, res: Response) {
  const [umbrales, cursos, inversion] = await Promise.all([
    leerUmbrales(),
    prisma.curso.findMany({
      where: { activo: true },
      select: {
        id: true, nombre: true, precio: true, familia: true,
        preciosOficiales: { orderBy: { vigenteDesde: 'desc' }, select: { id: true, precio: true, vigenteDesde: true, nota: true } },
      },
      orderBy: { nombre: 'asc' },
    }),
    prisma.inversionPublicitaria.findMany({ orderBy: [{ plataforma: 'asc' }, { desde: 'desc' }] }),
  ])

  const rango = await prisma.pago.aggregate({
    where: { estado: 'PAGADO' },
    _min: { fechaPago: true }, _max: { fechaPago: true },
  })

  return ApiResponse.success(res, {
    umbrales,
    fechaInicioModelo: process.env.FINANZAS_FECHA_INICIO ?? '2026-01-01',
    datos: {
      primerPago: diaColombia(rango._min.fechaPago ?? null),
      ultimoPago: diaColombia(rango._max.fechaPago ?? null),
    },
    cursos: cursos.map(c => ({
      id: c.id, nombre: c.nombre, familia: c.familia, precioActual: c.precio,
      historial: c.preciosOficiales.map(p => ({
        id: p.id, precio: p.precio, vigenteDesde: diaColombia(p.vigenteDesde), nota: p.nota,
      })),
    })),
    inversion: inversion.map(i => ({
      id: i.id, plataforma: i.plataforma, campania: i.campania,
      desde: diaColombia(i.desde), hasta: diaColombia(i.hasta),
      gastoCOP: i.gastoCOP, impresiones: i.impresiones, clics: i.clics, conversiones: i.conversiones,
    })),
  })
}

export async function actualizarUmbrales(req: Request, res: Response) {
  const numero = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : Number(v))
  const guardados = await guardarUmbrales({
    rReciente: numero(req.body.rReciente),
    rIntermedio: numero(req.body.rIntermedio),
    rInactivo: numero(req.body.rInactivo),
    fRecurrente: numero(req.body.fRecurrente),
    vAlto: numero(req.body.vAlto),
    vMedio: numero(req.body.vMedio),
    nuevoDias: numero(req.body.nuevoDias),
  })
  return ApiResponse.success(res, guardados)
}

/**
 * Agrega un precio oficial. Nunca edita el anterior: cada venta se compara
 * contra el precio que regía el día en que ocurrió, así que la historia
 * completa tiene que quedar.
 */
export async function crearPrecioOficial(req: Request, res: Response) {
  const { cursoId, precio, vigenteDesde, nota } = req.body
  if (!cursoId || precio === undefined || !vigenteDesde) {
    return ApiResponse.error(res, 'Faltan curso, precio o fecha de vigencia', 400)
  }

  const registro = await prisma.precioOficial.upsert({
    where: { cursoId_vigenteDesde: { cursoId: String(cursoId), vigenteDesde: new Date(String(vigenteDesde) + 'T00:00:00') } },
    create: {
      cursoId: String(cursoId),
      precio: Number(precio),
      vigenteDesde: new Date(String(vigenteDesde) + 'T00:00:00'),
      nota: nota ? String(nota) : null,
    },
    update: { precio: Number(precio), nota: nota ? String(nota) : null },
  })
  return ApiResponse.success(res, registro)
}

export async function eliminarPrecioOficial(req: Request, res: Response) {
  await prisma.precioOficial.delete({ where: { id: req.params.id } })
  return ApiResponse.success(res, { eliminado: true })
}
