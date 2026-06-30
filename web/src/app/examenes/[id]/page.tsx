import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import ExamenCliente from './ExamenCliente'

// Misma lógica que simulacros-grupo500/src/app/simulacro/[id]/page.tsx,
// portada a Prisma/NextAuth en vez de Supabase/cookie propia.
export default async function PaginaExamen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sesion?: string }>
}) {
  const { id } = await params
  const sp = await searchParams

  const session = await auth()
  if ((session?.user as any)?.role !== 'ESTUDIANTE') redirect('/sign-in')
  const estudId = session!.user.id

  const examId = parseInt(id)
  if (isNaN(examId)) redirect('/examenes')

  const examen = await prisma.examen.findUnique({ where: { id: examId } })
  if (!examen || !examen.activo) redirect('/examenes')

  const ahora = Date.now()
  if (examen.abreAt && ahora < examen.abreAt.getTime()) redirect('/examenes')
  if (examen.cierraAt && ahora > examen.cierraAt.getTime()) redirect('/examenes')

  // Buscar o crear intento
  let intento = await prisma.intentoExamen.findUnique({
    where: { estudianteId_examenId: { estudianteId: estudId, examenId: examId } },
  })

  if (!intento) {
    intento = await prisma.intentoExamen.create({
      data: { estudianteId: estudId, examenId: examId },
    })
  }
  if (intento.finalizadoAt) redirect(`/examenes/${examId}/resultado`)

  // Sesión actual
  const sesionParam = parseInt(sp?.sesion ?? '1')
  const sesionSolicitada = sesionParam === 2 ? 2 : 1

  // Si pide sesión 2 pero no terminó sesión 1, redirigir
  if (sesionSolicitada === 2 && (intento.sesionActual ?? 1) < 2) {
    redirect(`/examenes/${examId}`)
  }
  const sesion = sesionSolicitada as 1 | 2

  // Preguntas de esta sesión (sin correcta ni explicación)
  const preguntasDb = await prisma.preguntaExamen.findMany({
    where: { examenId: examId, sesion },
    orderBy: { numero: 'asc' },
    select: {
      id: true, numero: true, area: true, contexto: true, enunciado: true,
      opcionA: true, opcionB: true, opcionC: true, opcionD: true,
      opcionE: true, opcionF: true, opcionG: true, opcionH: true, imagenUrl: true,
    },
  })

  const preguntas = preguntasDb.map(p => ({
    id: Number(p.id),
    numero: p.numero ?? 0,
    area: p.area ?? '',
    contexto: p.contexto,
    enunciado: p.enunciado,
    opcion_a: p.opcionA,
    opcion_b: p.opcionB,
    opcion_c: p.opcionC,
    opcion_d: p.opcionD,
    opcion_e: p.opcionE,
    opcion_f: p.opcionF,
    opcion_g: p.opcionG,
    opcion_h: p.opcionH,
    imagen_url: p.imagenUrl,
  }))

  // Respuestas previas de esta sesión
  const todasResp = (intento.respuestas as Record<string, Record<string, string>>) ?? {}
  const respPrevias: Record<string, string> = todasResp[`s${sesion}`] ?? {}

  return (
    <ExamenCliente
      simulacroId={examId}
      titulo={examen.titulo}
      sesion={sesion}
      preguntas={preguntas}
      respuestasPrevias={respPrevias}
      iniciadoAt={intento.iniciadoAt.toISOString()}
      duracionMin={examen.duracionMin}
    />
  )
}
