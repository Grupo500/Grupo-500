import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/ui/PageHeader'
import { ArrowLeft } from 'lucide-react'
import { GestorPreguntas } from './GestorPreguntas'

const MATERIAS = ['Lectura Crítica', 'Matemáticas', 'Sociales y Ciudadanas', 'Ciencias Naturales', 'Inglés']

export default async function LeccionAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect('/sign-in')
  if ((session.user as any).role !== 'ADMIN') redirect('/no-autorizado')

  const leccion = await prisma.britoLeccion.findUnique({
    where: { id },
    include: {
      preguntas: {
        orderBy: { orden: 'asc' },
        include: { pregunta: { select: { id: true, area: true, numero: true, enunciado: true } } },
      },
    },
  })
  if (!leccion) notFound()

  const preguntasActuales = leccion.preguntas.map(lp => ({
    id: lp.pregunta.id.toString(),
    area: lp.pregunta.area,
    numero: lp.pregunta.numero,
    enunciado: lp.pregunta.enunciado,
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <Link href="/brito-admin" className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface">
        <ArrowLeft className="w-4 h-4" /> Volver a Brito
      </Link>

      <PageHeader title={leccion.titulo} subtitle={`${leccion.materia} · orden ${leccion.orden}`} />

      <GestorPreguntas
        leccionId={leccion.id}
        materiaDefault={leccion.materia}
        materias={MATERIAS}
        preguntasActuales={preguntasActuales}
      />
    </div>
  )
}
