import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ArrowLeft } from 'lucide-react'
import FormEditarPregunta from './FormEditarPregunta'

export default async function EditarPreguntaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') redirect('/no-autorizado')

  const pregunta = await prisma.preguntaExamen.findUnique({
    where: { id: BigInt(id) },
  })
  if (!pregunta) redirect('/examenes/admin')

  return (
    <main className="min-h-dvh edu-bg-pattern">
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        <Link
          href={`/examenes/admin/imagenes?sim=${pregunta.examenId}`}
          className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <span className="bg-primary text-on-primary font-bold rounded-lg px-3 py-1 text-lg tabular-nums">
            {pregunta.numero ?? '—'}
          </span>
          <div>
            <h1 className="text-xl font-bold text-on-surface">Editar pregunta</h1>
            <p className="text-sm text-on-surface-variant">
              Simulacro {pregunta.examenId} · Sesión {pregunta.sesion} · {pregunta.area ?? 'Sin área'}
            </p>
          </div>
        </div>

        <FormEditarPregunta
          preguntaId={String(pregunta.id)}
          inicial={{
            enunciado:   pregunta.enunciado,
            contexto:    pregunta.contexto    ?? '',
            opcionA:     pregunta.opcionA     ?? '',
            opcionB:     pregunta.opcionB     ?? '',
            opcionC:     pregunta.opcionC     ?? '',
            opcionD:     pregunta.opcionD     ?? '',
            opcionE:     pregunta.opcionE     ?? '',
            opcionF:     pregunta.opcionF     ?? '',
            opcionG:     pregunta.opcionG     ?? '',
            opcionH:     pregunta.opcionH     ?? '',
            correcta:    pregunta.correcta,
            area:        pregunta.area        ?? '',
            explicacion: pregunta.explicacion ?? '',
            retroA:      (pregunta.retroOpciones as Record<string, string> | null)?.A ?? '',
            retroB:      (pregunta.retroOpciones as Record<string, string> | null)?.B ?? '',
            retroC:      (pregunta.retroOpciones as Record<string, string> | null)?.C ?? '',
            retroD:      (pregunta.retroOpciones as Record<string, string> | null)?.D ?? '',
          }}
        />
      </div>
    </main>
  )
}
