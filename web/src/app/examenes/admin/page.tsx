import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ArrowLeft, Users, ListChecks, CheckCircle2, Image as ImageIcon } from 'lucide-react'

// Panel de admin de simulacros. Solo ADMIN. Tablero con estadísticas por simulacro.
export default async function AdminSimulacrosPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')
  const role = ((session.user as any).role ?? 'VENDEDOR') as 'ADMIN' | 'VENDEDOR' | 'ESTUDIANTE'
  if (role !== 'ADMIN') redirect('/no-autorizado')

  const [examenes, totalEst, intentosTodos, intentosTerm] = await Promise.all([
    prisma.examen.findMany({ orderBy: { id: 'asc' }, select: { id: true, titulo: true, activo: true } }),
    prisma.estudianteExamen.count(),
    prisma.intentoExamen.groupBy({ by: ['examenId'], _count: { _all: true } }),
    prisma.intentoExamen.groupBy({
      by: ['examenId'],
      where: { finalizadoAt: { not: null } },
      _count: { _all: true },
      _avg: { puntaje: true },
    }),
  ])

  const totalIntentos  = intentosTodos.reduce((s, i) => s + i._count._all, 0)
  const totalTerminados = intentosTerm.reduce((s, i) => s + i._count._all, 0)

  const statsPorExamen = new Map<number, { total: number; terminados: number; promedio: number }>()
  for (const ex of examenes) {
    const todos = intentosTodos.find(i => i.examenId === ex.id)?._count._all ?? 0
    const term  = intentosTerm.find(i => i.examenId === ex.id)
    statsPorExamen.set(ex.id, {
      total: todos,
      terminados: term?._count._all ?? 0,
      promedio: term?._avg.puntaje ? Math.round(Number(term._avg.puntaje)) : 0,
    })
  }

  const stat = (label: string, valor: number, Icon: any) => (
    <div className="bg-surface-lowest border border-outline-variant rounded-xl p-4">
      <div className="flex items-center gap-2 text-on-surface-variant mb-1.5">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-on-surface tabular-nums">{valor}</p>
    </div>
  )

  return (
    <main className="min-h-dvh edu-bg-pattern">
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <Link href="/inicio" className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface mb-6">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-on-surface">Panel de simulacros</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">Administración · Grupo 500</p>
        </div>

        {/* Estadísticas globales */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {stat('Estudiantes', totalEst, Users)}
          {stat('Intentos', totalIntentos, ListChecks)}
          {stat('Terminados', totalTerminados, CheckCircle2)}
        </div>

        {/* Simulacros */}
        <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Simulacros</h2>
        <div className="space-y-3">
          {examenes.map(ex => {
            const s = statsPorExamen.get(ex.id)!
            return (
              <div key={ex.id} className="bg-surface-lowest border border-outline-variant rounded-xl p-4 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[140px]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-on-surface">{ex.titulo}</span>
                    <span className={ex.activo
                      ? 'text-xs px-2.5 py-0.5 rounded-full bg-primary-container text-secondary'
                      : 'text-xs px-2.5 py-0.5 rounded-full bg-surface-high text-on-surface-variant'}>
                      {ex.activo ? 'Activo' : 'Cerrado'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-sm">
                  <span className="text-on-surface"><b className="tabular-nums">{s.terminados}</b> <span className="text-on-surface-variant text-xs">terminaron</span></span>
                  <span className="text-on-surface"><b className="tabular-nums">{s.promedio}</b> <span className="text-on-surface-variant text-xs">pts prom.</span></span>
                </div>
                <Link
                  href={`/examenes/admin/imagenes?sim=${ex.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-high border border-outline-variant text-xs font-medium text-on-surface-variant hover:text-primary hover:border-primary/30 transition-colors"
                >
                  <ImageIcon className="w-3.5 h-3.5" /> Imágenes
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
