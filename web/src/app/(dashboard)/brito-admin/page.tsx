import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Users, ListChecks, Flame, ChevronRight,
  BookOpen, Calculator, Landmark, FlaskConical, Languages,
  type LucideIcon,
} from 'lucide-react'

const MATERIAS: { nombre: string; icon: LucideIcon; tono: string }[] = [
  { nombre: 'Lectura Crítica',        icon: BookOpen,      tono: 'violet' },
  { nombre: 'Matemáticas',            icon: Calculator,    tono: 'blue' },
  { nombre: 'Sociales y Ciudadanas',  icon: Landmark,       tono: 'amber' },
  { nombre: 'Ciencias Naturales',     icon: FlaskConical,  tono: 'emerald' },
  { nombre: 'Inglés',                 icon: Languages,     tono: 'rose' },
]

const TONOS: Record<string, { bg: string; text: string; ring: string }> = {
  violet:  { bg: 'bg-violet-500/10',  text: 'text-violet-600 dark:text-violet-400',   ring: 'group-hover:border-violet-500/30' },
  blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-600 dark:text-blue-400',       ring: 'group-hover:border-blue-500/30' },
  amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-600 dark:text-amber-400',     ring: 'group-hover:border-amber-500/30' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', ring: 'group-hover:border-emerald-500/30' },
  rose:    { bg: 'bg-rose-500/10',    text: 'text-rose-600 dark:text-rose-400',       ring: 'group-hover:border-rose-500/30' },
}

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

  const stat = (label: string, valor: number, Icon: LucideIcon, gradient: string, shadow: string, delay: number) => (
    <div
      className="relative overflow-hidden rounded-2xl p-4 animate-card-enter"
      style={{ background: gradient, boxShadow: shadow, animationDelay: `${delay}ms` }}
    >
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-2xl pointer-events-none" aria-hidden />
      <div className="relative w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <p className="relative text-3xl font-extrabold text-white tabular-nums leading-none mb-1.5">{valor}</p>
      <p className="relative text-xs font-medium text-white/80">{label}</p>
    </div>
  )

  const leccionesPorMateria = new Map<string, number>()
  for (const l of lecciones) leccionesPorMateria.set(l.materia, (leccionesPorMateria.get(l.materia) ?? 0) + 1)

  const preguntasMap = new Map(preguntasPorMateria.map(p => [p.area, p._count]))

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Brito" subtitle="Modo de práctica gamificado · con Brito te vas a convertir en cerebrito" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stat(
          'Estudiantes con perfil', totalPerfiles, Users,
          'linear-gradient(135deg, #7c3aed 0%, #4338ca 100%)',
          '0 8px 24px -6px rgba(124,58,237,0.45)',
          0,
        )}
        {stat(
          'Lecciones creadas', lecciones.length, ListChecks,
          'linear-gradient(135deg, #2563eb 0%, #0891b2 100%)',
          '0 8px 24px -6px rgba(37,99,235,0.45)',
          60,
        )}
        {stat(
          'Lecciones completadas', totalCompletadas, Flame,
          'linear-gradient(135deg, #f97316 0%, #e11d48 100%)',
          '0 8px 24px -6px rgba(249,115,22,0.45)',
          120,
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {MATERIAS.map(({ nombre, icon: Icon, tono }, i) => {
          const t = TONOS[tono]
          const numLecciones = leccionesPorMateria.get(nombre) ?? 0
          const numPreguntas = preguntasMap.get(nombre) ?? 0
          return (
            <Link
              key={nombre}
              href={`/brito-admin/materia/${encodeURIComponent(nombre)}`}
              className={`group flex items-center gap-4 bg-surface-lowest border border-outline-variant rounded-2xl p-5 hover:-translate-y-0.5 hover:shadow-md transition-all animate-card-enter ${t.ring}`}
              style={{ animationDelay: `${180 + i * 60}ms` }}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${t.bg}`}>
                <Icon className={`w-5 h-5 ${t.text}`} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate mb-1.5">{nombre}</p>
                <div className="flex items-center gap-4">
                  <span className="flex items-baseline gap-1">
                    <b className="text-lg font-bold text-on-surface tabular-nums leading-none">{numLecciones}</b>
                    <span className="text-[11px] text-on-surface-variant">lecciones</span>
                  </span>
                  <span className="flex items-baseline gap-1">
                    <b className="text-lg font-bold text-on-surface tabular-nums leading-none">{numPreguntas}</b>
                    <span className="text-[11px] text-on-surface-variant">preguntas</span>
                  </span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-on-surface-variant shrink-0 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
