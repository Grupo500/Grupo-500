import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { obtenerPerfilActual } from '../../acciones'
import { TomarLeccion } from './TomarLeccion'

export default async function LeccionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if ((session?.user as any)?.role !== 'ESTUDIANTE') redirect('/brito')

  const perfil = await obtenerPerfilActual()
  if (!perfil) redirect('/brito')
  if (perfil.plan !== 'PREMIUM' && perfil.corazones <= 0) redirect('/brito/mapa')

  const leccion = await prisma.britoLeccion.findUnique({
    where: { id },
    include: {
      preguntas: {
        orderBy: { orden: 'asc' },
        include: { pregunta: true },
      },
    },
  })
  if (!leccion || leccion.preguntas.length === 0) notFound()

  const preguntas = leccion.preguntas.map(lp => {
    const p = lp.pregunta
    return {
      id: p.id.toString(),
      contexto: p.contexto,
      enunciado: p.enunciado,
      imagenUrl: p.imagenUrl,
      opciones: [
        { letra: 'A', texto: p.opcionA },
        { letra: 'B', texto: p.opcionB },
        { letra: 'C', texto: p.opcionC },
        { letra: 'D', texto: p.opcionD },
        { letra: 'E', texto: p.opcionE },
        { letra: 'F', texto: p.opcionF },
        { letra: 'G', texto: p.opcionG },
        { letra: 'H', texto: p.opcionH },
      ].filter((o): o is { letra: string; texto: string } => !!o.texto),
    }
  })

  return (
    <TomarLeccion
      leccionId={leccion.id}
      leccionTitulo={leccion.titulo}
      preguntas={preguntas}
      corazonesIniciales={perfil.corazones}
      plan={perfil.plan === 'PREMIUM' ? 'PREMIUM' : 'FREE'}
    />
  )
}
