import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/ui/PageHeader'
import { Users, ListChecks, Flame, ChevronRight, FilePlus } from 'lucide-react'
import { NuevaLeccionForm } from './NuevaLeccionForm'

const MATERIAS = ['Lectura Crítica', 'Matemáticas', 'Sociales y Ciudadanas', 'Ciencias Naturales', 'Inglés']

export default async function BritoAdminPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')
  if ((session.user as any).role !== 'ADMIN') redirect('/no-autorizado')

  const [lecciones, totalPerfiles, totalCompletadas] = await Promise.all([
    prisma.britoLeccion.findMany({
      orderBy: [{ materia: 'asc' }, { orden: 'asc' }],
      include: { _count: { select: { preguntas: true, completadas: true } } },
    }),
    prisma.britoPerfil.count(),
    prisma.britoLeccionCompletada.count(),
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

  const porMateria = MATERIAS.map(materia => ({
    materia,
    lecciones: lecciones.filter(l => l.materia === materia),
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Brito" subtitle="Modo de práctica gamificado · con Brito te vas a convertir en cerebrito" />

      <div className="grid grid-cols-3 gap-3">
        {stat('Estudiantes con perfil', totalPerfiles, Users)}
        {stat('Lecciones creadas', lecciones.length, ListChecks)}
        {stat('Lecciones completadas', totalCompletadas, Flame)}
      </div>

      <div className="flex items-center gap-2">
        <NuevaLeccionForm materias={MATERIAS} />
        <Link
          href="/brito-admin/preguntas/nueva"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-outline-variant text-sm font-semibold text-on-surface-variant hover:text-on-surface hover:border-primary/30 transition-colors"
        >
          <FilePlus className="w-4 h-4" /> Nueva pregunta
        </Link>
      </div>

      <div className="space-y-6">
        {porMateria.map(({ materia, lecciones: ls }) => (
          <div key={materia}>
            <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">{materia}</h2>
            {ls.length === 0 ? (
              <p className="text-sm text-on-surface-variant/70 italic">Sin lecciones todavía</p>
            ) : (
              <div className="space-y-2">
                {ls.map(l => (
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
        ))}
      </div>
    </div>
  )
}
