import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { obtenerPerfilActual } from '../acciones'
import { Flame, Heart, Trophy, Lock, Check, ArrowLeft } from 'lucide-react'
import { CerrarSesionIcono } from '../CerrarSesionIcono'
import { PerfilMenu } from '../PerfilMenu'

const MATERIAS = ['Lectura Crítica', 'Matemáticas', 'Sociales y Ciudadanas', 'Ciencias Naturales', 'Inglés']
const ROLES_PERMITIDOS = ['ESTUDIANTE', 'ADMIN']

const COLOR_MATERIA: Record<string, { banner: string; glow: string }> = {
  'Lectura Crítica': { banner: 'from-violet-500 to-violet-700', glow: 'shadow-violet-500/30' },
  'Matemáticas': { banner: 'from-blue-500 to-blue-700', glow: 'shadow-blue-500/30' },
  'Sociales y Ciudadanas': { banner: 'from-amber-500 to-amber-700', glow: 'shadow-amber-500/30' },
  'Ciencias Naturales': { banner: 'from-emerald-500 to-emerald-700', glow: 'shadow-emerald-500/30' },
  'Inglés': { banner: 'from-rose-500 to-rose-700', glow: 'shadow-rose-500/30' },
}

// Desplazamiento horizontal en zig-zag, estilo sendero de Duolingo.
const OFFSETS_X = [0, 56, 88, 56, 0, -56, -88, -56]

export default async function MapaBritoPage() {
  const session = await auth()
  if (!ROLES_PERMITIDOS.includes((session?.user as any)?.role)) redirect('/brito')

  const perfil = await obtenerPerfilActual()
  if (!perfil) redirect('/brito')
  const estudianteId = perfil.estudianteId

  const [lecciones, completadas, estudiante] = await Promise.all([
    prisma.britoLeccion.findMany({
      orderBy: [{ materia: 'asc' }, { orden: 'asc' }],
      include: { _count: { select: { preguntas: true } } },
    }),
    prisma.britoLeccionCompletada.findMany({
      where: { estudianteId },
      select: { leccionId: true },
      distinct: ['leccionId'],
    }),
    prisma.estudianteExamen.findUnique({
      where: { id: estudianteId },
      select: { nombre: true, email: true },
    }),
  ])
  const completadasSet = new Set(completadas.map(c => c.leccionId))

  const porMateria = MATERIAS.map(materia => {
    const ls = lecciones.filter(l => l.materia === materia && l._count.preguntas > 0)
    let previaCompletada = true
    const conEstado = ls.map(l => {
      const completada = completadasSet.has(l.id)
      const desbloqueada = previaCompletada
      previaCompletada = completada
      return { ...l, completada, desbloqueada }
    })
    return { materia, lecciones: conEstado }
  }).filter(m => m.lecciones.length > 0)

  const sinCorazones = perfil.plan !== 'PREMIUM' && perfil.corazones <= 0

  return (
    <main className="min-h-dvh" style={{ background: 'linear-gradient(180deg, #003060 0%, #0b1f3a 100%)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-md bg-[#003060]/80 border-b border-white/10">
        <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link href="/inicio" title="Volver al inicio" className="text-white/60 hover:text-white transition-colors shrink-0">
              <ArrowLeft className="w-4.5 h-4.5" />
            </Link>
            <div className="w-9 h-9 rounded-full overflow-hidden border border-white/20 shrink-0">
              <Image src="/brito/brito-hero.jpg" alt="Brito" width={36} height={36} className="object-cover w-full h-full" />
            </div>
            <span className="text-white font-bold text-sm">Brito</span>
          </div>

          {/* Stats centradas */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-4 text-white text-sm font-semibold">
            <span className="flex items-center gap-1"><Flame className="w-4 h-4 text-orange-400" /> {perfil.rachaActual}</span>
            <span className="flex items-center gap-1">
              <Heart className="w-4 h-4 text-red-400" />
              {perfil.plan === 'PREMIUM' ? '∞' : perfil.corazones}
            </span>
            <span className="flex items-center gap-1 text-amber-300">{perfil.xpTotal} XP</span>
            <Link href="/brito/ranking" title="Ranking" className="text-white/70 hover:text-white transition-colors">
              <Trophy className="w-4 h-4" />
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <PerfilMenu
              nombre={estudiante?.nombre ?? 'Estudiante'}
              email={estudiante?.email ?? ''}
              plan={perfil.plan === 'PREMIUM' ? 'PREMIUM' : 'FREE'}
              xpTotal={perfil.xpTotal}
              rachaMejor={perfil.rachaMejor}
              imagenUrl={(session?.user as any)?.image ?? null}
            />
            <CerrarSesionIcono />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        {sinCorazones && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
            <p className="text-sm font-semibold text-red-200">Te quedaste sin corazones</p>
            <p className="text-xs text-red-200/70 mt-0.5">Se regeneran 1 cada 4 horas. Vuelve pronto o hazte Premium.</p>
          </div>
        )}

        <div className="max-w-md mx-auto space-y-10">
          {porMateria.map(({ materia, lecciones: ls }) => {
            const color = COLOR_MATERIA[materia] ?? COLOR_MATERIA['Lectura Crítica']
            const completadasCount = ls.filter(l => l.completada).length
            const indiceActual = ls.findIndex(l => l.desbloqueada && !l.completada)

            return (
              <div key={materia}>
                {/* Banner de la sección */}
                <div className={`bg-gradient-to-r ${color.banner} rounded-2xl px-5 py-4 mb-8 shadow-lg ${color.glow}`}>
                  <p className="text-white/80 text-[11px] font-bold uppercase tracking-wider">
                    Lección {Math.min(completadasCount + 1, ls.length)} de {ls.length}
                  </p>
                  <h2 className="text-white font-extrabold text-lg leading-tight">{materia}</h2>
                </div>

                {/* Sendero de lecciones en zig-zag */}
                <div className="flex flex-col items-center gap-7">
                  {ls.map((l, idx) => {
                    const bloqueada = !l.desbloqueada
                    const esActual = idx === indiceActual
                    const offset = OFFSETS_X[idx % OFFSETS_X.length]

                    const nodo = (
                      <div
                        className={[
                          'rounded-full flex items-center justify-center shadow-lg transition-transform relative',
                          esActual ? 'w-20 h-20' : 'w-16 h-16',
                          bloqueada
                            ? 'bg-white/10 border border-white/10'
                            : l.completada
                            ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 hover:scale-105 active:scale-95'
                            : 'bg-gradient-to-br from-[#ffb703] to-[#fb8500] hover:scale-105 active:scale-95',
                          esActual ? 'ring-4 ring-white/15' : '',
                        ].join(' ')}
                      >
                        {bloqueada ? (
                          <Lock className="w-5 h-5 text-white/40" />
                        ) : l.completada ? (
                          <Check className="w-6 h-6 text-white" />
                        ) : (
                          <span className="text-white font-bold text-base">{idx + 1}</span>
                        )}
                      </div>
                    )

                    return (
                      <div
                        key={l.id}
                        className="flex flex-col items-center gap-1.5 relative"
                        style={{ transform: `translateX(${offset}px)` }}
                      >
                        {esActual && (
                          <span className="absolute -top-11 px-3 py-1.5 rounded-xl bg-white text-[#001d3d] text-xs font-extrabold shadow-md whitespace-nowrap animate-bounce">
                            EMPEZAR
                            <span className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-3 h-3 bg-white rotate-45" />
                          </span>
                        )}
                        {bloqueada ? (
                          <div className="opacity-60">{nodo}</div>
                        ) : (
                          <Link href={`/brito/leccion/${l.id}`}>{nodo}</Link>
                        )}
                        <span className="text-[11px] text-white/70 font-medium text-center leading-tight max-w-24">{l.titulo}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {porMateria.length === 0 && (
          <div className="flex flex-col items-center text-center mt-16 gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden border border-white/20 opacity-80">
              <Image src="/brito/brito-hero.jpg" alt="Brito" width={80} height={80} className="object-cover w-full h-full" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Brito está preparando tus lecciones</p>
              <p className="text-white/60 text-xs mt-1 max-w-[240px]">Todavía no hay lecciones publicadas. Vuelve pronto para empezar a practicar.</p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
