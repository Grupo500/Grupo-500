import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import '../../../examen.css'
import PreviewCliente from './PreviewCliente'

export default async function PreviewExamenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sesion?: string }>
}) {
  const { id } = await params
  const sp = await searchParams

  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') redirect('/no-autorizado')

  const examId = parseInt(id)
  if (isNaN(examId)) redirect('/examenes/admin')

  const sesionActual = parseInt(sp.sesion ?? '1') === 2 ? 2 : 1

  const [examen, preguntas] = await Promise.all([
    prisma.examen.findUnique({ where: { id: examId } }),
    prisma.preguntaExamen.findMany({
      where: { examenId: examId, sesion: sesionActual },
      orderBy: { numero: 'asc' },
      select: {
        id: true, numero: true, area: true, contexto: true, enunciado: true,
        opcionA: true, opcionB: true, opcionC: true, opcionD: true,
        imagenUrl: true, correcta: true,
      },
    }),
  ])

  if (!examen) redirect('/examenes/admin')

  const qs = preguntas.map(p => ({
    id: Number(p.id),
    numero: p.numero ?? 0,
    area: p.area ?? '',
    contexto: p.contexto,
    enunciado: p.enunciado,
    opcion_a: p.opcionA,
    opcion_b: p.opcionB,
    opcion_c: p.opcionC,
    opcion_d: p.opcionD,
    imagen_url: p.imagenUrl,
    correcta: p.correcta,
  }))

  return (
    <div className="examen-sim">
      <PreviewCliente
        examenId={examId}
        titulo={examen.titulo}
        sesion={sesionActual}
        preguntas={qs}
      />
    </div>
  )
}
