import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ArrowLeft, ClipboardList, Settings } from 'lucide-react'

// Landing del módulo de simulacros (motor de examen).
// Solo estudiantes y admin. La UI completa del examen llega en la siguiente fase;
// por ahora lista los exámenes disponibles desde la base ya migrada.
export default async function ExamenesPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const role = ((session.user as any).role ?? 'VENDEDOR') as 'ADMIN' | 'VENDEDOR' | 'ESTUDIANTE'
  if (role === 'VENDEDOR') redirect('/no-autorizado')

  const examenes = await prisma.examen.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, titulo: true, descripcion: true, activo: true, duracionMin: true },
  })

  return (
    <main className="min-h-dvh edu-bg-pattern">
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        <Link href="/inicio" className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface mb-6">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-primary-container text-secondary flex items-center justify-center">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-on-surface">Simulacros</h1>
            <p className="text-sm text-on-surface-variant">Exámenes tipo Saber 11</p>
          </div>
          {role === 'ADMIN' && (
            <Link
              href="/examenes/admin"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-high border border-outline-variant text-sm font-medium text-on-surface-variant hover:text-primary hover:border-primary/30 transition-colors"
            >
              <Settings className="w-4 h-4" /> Administrar
            </Link>
          )}
        </div>

        <div className="space-y-3">
          {examenes.map(ex => (
            <div key={ex.id} className="bg-surface-lowest border border-outline-variant rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-on-surface">{ex.titulo}</p>
                  {ex.descripcion && <p className="text-xs text-on-surface-variant mt-0.5">{ex.descripcion}</p>}
                </div>
                <span className={ex.activo
                  ? 'text-xs px-2.5 py-1 rounded-full bg-primary-container text-secondary'
                  : 'text-xs px-2.5 py-1 rounded-full bg-surface-high text-on-surface-variant'}>
                  {ex.activo ? 'Disponible' : 'Cerrado'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-on-surface-variant mt-6">
          El motor de examen (responder preguntas en dos sesiones y ver resultados) se conecta en la siguiente fase.
        </p>
      </div>
    </main>
  )
}
