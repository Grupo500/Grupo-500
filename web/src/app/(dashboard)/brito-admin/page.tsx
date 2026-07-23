import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/ui/PageHeader'
import { Users, ListChecks, Flame, ChevronRight, HelpCircle } from 'lucide-react'

const MATERIAS = ['Lectura Crítica', 'Matemáticas', 'Sociales y Ciudadanas', 'Ciencias Naturales', 'Inglés']

export default async function BritoAdminPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')
  if ((session.user as any).role !== 'ADMIN') redirect('/no-autorizado')

  const [lecciones, totalPerfiles, totalCompletadas, preguntasPorMateria] = await Promise.all([
    prisma.britoLeccion.findMany({ select: { id: true, materia: true } }),
    prisma.britoPerfil.count(),
    prisma.britoLeccionCompletada.count(),
    prisma.preguntaExamen.groupBy({ by: ['area'], _count: true }),
  ])

  const stat = (label: string, valor: number, Icon: any) => (
    <div className="bg-surface-lowest border border-outline-variant rounded-xl p-4">
      <div className="flex items-center gap-2 text-on-surface-variant mb-1.5">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-on-surface tabular-nums">{valor}</p>
    </div>
  )

  const leccionesPorMateria = new Map<string, number>()
  for (const l of lecciones) leccionesPorMateria.set(l.materia, (leccionesPorMateria.get(l.materia) ?? 0) + 1)

  const preguntasMap = new Map(preguntasPorMateria.map(p => [p.area, p._count]))

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Brito" subtitle="Modo de práctica gamificado · con Brito te vas a convertir en cerebrito" />

      <div className="grid grid-cols-3 gap-3">
        {stat('Estudiantes con perfil', totalPerfiles, Users)}
        {stat('Lecciones creadas', lecciones.length, ListChecks)}
        {stat('Lecciones completadas', totalCompletadas, Flame)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {MATERIAS.map(materia => (
          <Link
            key={materia}
            href={`/brito-admin/materia/${encodeURIComponent(materia)}`}
            className="flex items-center gap-4 bg-surface-lowest border border-outline-variant rounded-xl p-5 hover:border-primary/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-on-surface truncate mb-2">{materia}</p>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1 text-on-surface-variant">
                  <ListChecks className="w-3.5 h-3.5" /> <b className="text-on-surface tabular-nums">{leccionesPorMateria.get(materia) ?? 0}</b> lecciones
                </span>
                <span className="flex items-center gap-1 text-on-surface-variant">
                  <HelpCircle className="w-3.5 h-3.5" /> <b className="text-on-surface tabular-nums">{preguntasMap.get(materia) ?? 0}</b> preguntas
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-on-surface-variant shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
