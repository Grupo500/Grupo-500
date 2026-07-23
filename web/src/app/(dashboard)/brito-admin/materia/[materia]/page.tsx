import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/ui/PageHeader'
import { ArrowLeft, ListChecks, HelpCircle, ChevronRight } from 'lucide-react'
import { NuevaLeccionForm } from '../../NuevaLeccionForm'
import { NuevaPreguntaForm } from '../../preguntas/nueva/NuevaPreguntaForm'

const MATERIAS = ['Lectura Crítica', 'Matemáticas', 'Sociales y Ciudadanas', 'Ciencias Naturales', 'Inglés']

export default async function MateriaAdminPage({ params }: { params: Promise<{ materia: string }> }) {
  const { materia: materiaParam } = await params
  const materia = decodeURIComponent(materiaParam)
  if (!MATERIAS.includes(materia)) notFound()

  const session = await auth()
  if (!session?.user) redirect('/sign-in')
  if ((session.user as any).role !== 'ADMIN') redirect('/no-autorizado')

  const [lecciones, totalPreguntas] = await Promise.all([
    prisma.britoLeccion.findMany({
      where: { materia },
      orderBy: { orden: 'asc' },
      include: { _count: { select: { preguntas: true, completadas: true } } },
    }),
    prisma.preguntaExamen.count({ where: { area: materia } }),
  ])

  return (
    <div className="space-y-6 animate-fade-in">
      <Link href="/brito-admin" className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface">
        <ArrowLeft className="w-4 h-4" /> Volver a Brito
      </Link>

      <PageHeader title={materia} subtitle="Crea preguntas para el banco y arma las lecciones de esta materia." />

      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="bg-surface-lowest border border-outline-variant rounded-xl p-4">
          <div className="flex items-center gap-2 text-on-surface-variant mb-1.5">
            <ListChecks className="w-4 h-4" />
            <span className="text-xs font-medium">Lecciones</span>
          </div>
          <p className="text-2xl font-bold text-on-surface tabular-nums">{lecciones.length}</p>
        </div>
        <div className="bg-surface-lowest border border-outline-variant rounded-xl p-4">
          <div className="flex items-center gap-2 text-on-surface-variant mb-1.5">
            <HelpCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Preguntas en el banco</span>
          </div>
          <p className="text-2xl font-bold text-on-surface tabular-nums">{totalPreguntas}</p>
        </div>
      </div>

      {/* ── Constructor de preguntas ── */}
      <div>
        <h2 className="text-sm font-semibold text-on-surface mb-3">Nueva pregunta para {materia}</h2>
        <NuevaPreguntaForm materias={[materia]} />
      </div>

      {/* ── Lecciones de esta materia ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-on-surface">Lecciones</h2>
          <NuevaLeccionForm materias={[materia]} />
        </div>

        {lecciones.length === 0 ? (
          <p className="text-sm text-on-surface-variant/70 italic">Sin lecciones todavía — crea preguntas arriba y luego arma la primera lección.</p>
        ) : (
          <div className="space-y-2">
            {lecciones.map(l => (
              <Link
                key={l.id}
                href={`/brito-admin/${l.id}`}
                className="flex items-center gap-4 bg-surface-lowest border border-outline-variant rounded-xl p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">{l.titulo}</p>
                  <p className="text-xs text-on-surface-variant">Orden {l.orden}</p>
                </div>
                <div className="flex items-center gap-5 text-sm shrink-0">
                  <span className="text-on-surface"><b className="tabular-nums">{l._count.preguntas}</b> <span className="text-on-surface-variant text-xs">preguntas</span></span>
                  <span className="text-on-surface"><b className="tabular-nums">{l._count.completadas}</b> <span className="text-on-surface-variant text-xs">completadas</span></span>
                </div>
                <ChevronRight className="w-4 h-4 text-on-surface-variant shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
