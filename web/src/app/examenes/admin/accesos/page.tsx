import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { BRITO_BANCO_EXAMEN_ID } from '@/lib/britoBanco'
import { ArrowLeft, Users } from 'lucide-react'
import CargarCsv from './CargarCsv'
import RetirarProducto from './RetirarProducto'

// Gestión de accesos diferenciados por producto (PRD simulacros §3.1–3.2).
export default async function AdminAccesosPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')
  const role = ((session.user as any).role ?? 'VENDEDOR') as 'ADMIN' | 'VENDEDOR' | 'ESTUDIANTE'
  if (role !== 'ADMIN') redirect('/no-autorizado')

  const [examenes, accesosActivos, accesosRetirados] = await Promise.all([
    prisma.examen.findMany({
      where: { id: { not: BRITO_BANCO_EXAMEN_ID } },
      orderBy: { id: 'asc' },
      select: { id: true, titulo: true, activo: true },
    }),
    prisma.accesoExamen.groupBy({
      by: ['examenId'],
      where: { retiradoAt: null },
      _count: { _all: true },
    }),
    prisma.accesoExamen.groupBy({
      by: ['examenId'],
      where: { retiradoAt: { not: null } },
      _count: { _all: true },
    }),
  ])

  const activosPorExamen = new Map(accesosActivos.map(a => [a.examenId, a._count._all]))
  const retiradosPorExamen = new Map(accesosRetirados.map(a => [a.examenId, a._count._all]))

  return (
    <main className="min-h-dvh edu-bg-pattern">
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <Link href="/examenes/admin" className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface mb-6">
          <ArrowLeft className="w-4 h-4" /> Panel de simulacros
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-on-surface">Accesos por producto</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Cada estudiante solo ve los simulacros que tenga habilitados. El cruce es por el ID interno del producto.
          </p>
        </div>

        <div className="mb-8">
          <CargarCsv />
        </div>

        <h2 className="text-xs font-semibold text-on-surface-variant mb-3">Habilitados por simulacro</h2>
        <div className="space-y-3">
          {examenes.map(ex => (
            <div key={ex.id} className="bg-surface-lowest border border-outline-variant rounded-xl p-4 flex items-center gap-4 flex-wrap">
              <span className="font-mono text-xs px-2 py-1 rounded bg-surface-high text-on-surface-variant">ID {ex.id}</span>
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
              <span className="flex items-center gap-1.5 text-sm text-on-surface">
                <Users className="w-4 h-4 text-on-surface-variant" />
                <b className="tabular-nums">{activosPorExamen.get(ex.id) ?? 0}</b>
                <span className="text-on-surface-variant text-xs">habilitados</span>
                {(retiradosPorExamen.get(ex.id) ?? 0) > 0 && (
                  <span className="text-on-surface-variant text-xs">· {retiradosPorExamen.get(ex.id)} retirados</span>
                )}
              </span>
              <RetirarProducto examenId={ex.id} habilitados={activosPorExamen.get(ex.id) ?? 0} />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
