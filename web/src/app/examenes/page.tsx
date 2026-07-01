import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ArrowLeft, ClipboardList, Settings, ArrowRight, Clock } from 'lucide-react'

export default async function ExamenesPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const role = ((session.user as any).role ?? 'VENDEDOR') as 'ADMIN' | 'VENDEDOR' | 'ESTUDIANTE'
  if (role === 'VENDEDOR') redirect('/no-autorizado')

  const examenes = await prisma.examen.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, titulo: true, descripcion: true, activo: true, duracionMin: true },
  })

  const intentos = role === 'ESTUDIANTE'
    ? await prisma.intentoExamen.findMany({
        where: { estudianteId: session.user.id },
        select: { examenId: true, finalizadoAt: true },
      })
    : []
  const intentoPorExamen = new Map(intentos.map(i => [i.examenId, i]))

  return (
    <main
      className="min-h-dvh relative overflow-hidden flex flex-col"
      style={{ background: 'linear-gradient(160deg, #003060 0%, #2094ff 55%, #21b9f7 100%)' }}
    >
      {/* Halos de fondo */}
      <div className="absolute -top-20 -left-16 w-72 h-72 rounded-full bg-[#635cef]/20 blur-3xl pointer-events-none animate-float-slow" aria-hidden />
      <div className="absolute top-1/2 -right-20 w-80 h-80 rounded-full bg-[#95daff]/15 blur-3xl pointer-events-none animate-float-slow" style={{ animationDelay: '2.5s' }} aria-hidden />

      <div className="relative z-10 flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-8 md:py-12 gap-6">

        {/* Header */}
        <div className="animate-card-enter">
          <Link href="/inicio" className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors mb-5 font-medium">
            <ArrowLeft className="w-4 h-4" /> Volver
          </Link>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #21b9f7, #2094ff)' }}>
                <ClipboardList className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight drop-shadow-sm">Simulacros</h1>
                <p className="text-sm text-white/70 font-medium">Exámenes tipo Saber 11</p>
              </div>
            </div>
            {role === 'ADMIN' && (
              <Link
                href="/examenes/admin"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 backdrop-blur-sm border border-white/25 text-sm font-semibold text-white hover:bg-white/25 transition-all duration-200"
              >
                <Settings className="w-4 h-4" /> Administrar
              </Link>
            )}
          </div>
        </div>

        {/* Lista de exámenes */}
        <div className="space-y-3">
          {examenes.map((ex, i) => {
            const intento = intentoPorExamen.get(ex.id)
            const terminado = !!intento?.finalizadoAt
            const enProgreso = !!intento && !terminado

            return (
              <div
                key={ex.id}
                className="bg-white rounded-2xl p-4 shadow-[0_12px_32px_-8px_rgba(0,30,60,0.4)] border border-white/60 animate-card-enter"
                style={{ animationDelay: `${0.08 + i * 0.06}s` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-[#001d3d]">{ex.titulo}</p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                        ex.activo
                          ? 'bg-[#cce4ff] text-[#2094ff]'
                          : 'bg-[#f0f0f0] text-[#5a74a8]'
                      }`}>
                        {ex.activo ? 'Disponible' : 'Cerrado'}
                      </span>
                      {terminado && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-[#dde3ff] text-[#4361ee]">
                          Completado
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {ex.descripcion && (
                        <p className="text-xs text-[#2a4172]">{ex.descripcion}</p>
                      )}
                      {ex.duracionMin && (
                        <span className="flex items-center gap-1 text-xs text-[#5a74a8]">
                          <Clock className="w-3 h-3" /> {ex.duracionMin} min por sesión
                        </span>
                      )}
                    </div>
                  </div>

                  {role === 'ESTUDIANTE' && ex.activo && (
                    <Link
                      href={terminado ? `/examenes/${ex.id}/resultado` : `/examenes/${ex.id}`}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all duration-200 hover:brightness-105 active:scale-95 whitespace-nowrap flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #2094ff, #1a7de0)', boxShadow: '0 4px 12px -4px rgba(26,125,224,0.5)' }}
                    >
                      {terminado ? 'Ver resultado' : enProgreso ? 'Continuar' : 'Presentar'}
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            )
          })}

          {examenes.length === 0 && (
            <div className="bg-white/15 backdrop-blur-sm rounded-2xl border border-white/25 p-8 text-center animate-card-enter">
              <p className="text-white/70 text-sm font-medium">No hay simulacros disponibles por ahora.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
