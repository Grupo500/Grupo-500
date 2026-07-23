import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { BRITO_BANCO_EXAMEN_ID } from '@/lib/britoBanco'
import { ArrowLeft, Pencil } from 'lucide-react'
import SubirImagen from './SubirImagen'

// Gestión de imágenes: muestra TODAS las preguntas del simulacro (filtros de
// simulacro y sesión para navegar). Solo admin.
export default async function AdminImagenesPage({
  searchParams,
}: {
  searchParams: Promise<{ sim?: string; sesion?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')
  const role = ((session.user as any).role ?? 'VENDEDOR') as 'ADMIN' | 'VENDEDOR' | 'ESTUDIANTE'
  if (role !== 'ADMIN') redirect('/no-autorizado')

  const sp = await searchParams
  const simId = parseInt(sp.sim ?? '1')
  const sesionFiltro = (parseInt(sp.sesion ?? '0') || 0) as 0 | 1 | 2

  const examenes = await prisma.examen.findMany({ where: { id: { not: BRITO_BANCO_EXAMEN_ID } }, orderBy: { id: 'asc' }, select: { id: true } })

  const preguntas = await prisma.preguntaExamen.findMany({
    where: { examenId: simId, ...(sesionFiltro ? { sesion: sesionFiltro } : {}) },
    orderBy: [{ sesion: 'asc' }, { numero: 'asc' }],
    select: { id: true, numero: true, sesion: true, area: true, enunciado: true, imagenUrl: true },
  })

  const conImagen = preguntas.filter(p => p.imagenUrl).length
  const sinImagen = preguntas.length - conImagen

  const pill = (activo: boolean) =>
    `px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
      activo ? 'bg-primary text-on-primary' : 'bg-surface-high text-on-surface-variant hover:text-primary'
    }`

  return (
    <main className="min-h-dvh edu-bg-pattern">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <Link href="/examenes/admin" className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface mb-6">
          <ArrowLeft className="w-4 h-4" /> Panel
        </Link>

        <h1 className="text-2xl font-bold text-on-surface mb-1">Gestión de imágenes</h1>
        <p className="text-sm text-on-surface-variant mb-5">
          Sube la imagen de cada pregunta. Aparece automáticamente en el examen.
        </p>

        {/* Conteos */}
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-error/10 text-error">{sinImagen} sin imagen</span>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-primary-container text-secondary">{conImagen} con imagen</span>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-surface-high text-on-surface-variant">{preguntas.length} mostrando</span>
        </div>

        {/* Filtro: simulacro */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs font-semibold text-on-surface-variant w-20">Simulacro</span>
          {examenes.map(ex => (
            <Link key={ex.id} href={`/examenes/admin/imagenes?sim=${ex.id}&sesion=${sesionFiltro}`} className={pill(simId === ex.id)}>
              {ex.id}
            </Link>
          ))}
        </div>

        {/* Filtro: sesión */}
        <div className="flex items-center gap-2 mb-7 flex-wrap">
          <span className="text-xs font-semibold text-on-surface-variant w-20">Sesión</span>
          {[0, 1, 2].map(ses => (
            <Link key={ses} href={`/examenes/admin/imagenes?sim=${simId}&sesion=${ses}`} className={pill(sesionFiltro === ses)}>
              {ses === 0 ? 'Ambas' : `Sesión ${ses}`}
            </Link>
          ))}
        </div>

        {preguntas.length === 0 ? (
          <div className="text-center py-16 text-on-surface-variant">No hay preguntas en esta selección.</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {preguntas.map(p => (
              <div key={String(p.id)} className="flex flex-col gap-2">
                <SubirImagen
                  preguntaId={String(p.id)}
                  numero={p.numero}
                  area={p.area ?? ''}
                  enunciado={p.enunciado}
                  imagenUrlInicial={p.imagenUrl}
                />
                <Link
                  href={`/examenes/admin/preguntas/${p.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant hover:text-primary transition-colors px-1"
                >
                  <Pencil className="w-3 h-3" /> Editar pregunta
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
