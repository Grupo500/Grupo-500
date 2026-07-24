import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { obtenerPerfilActual } from '../acciones'
import { Flame, Heart, Trophy, Lock, Check, ArrowLeft, Gem, Map as MapIcon, Gift, Flag, Compass } from 'lucide-react'
import { CerrarSesionIcono } from '../CerrarSesionIcono'
import { PerfilMenu } from '../PerfilMenu'

const MATERIAS = ['Lectura Crítica', 'Matemáticas', 'Sociales y Ciudadanas', 'Ciencias Naturales', 'Inglés']
const ROLES_PERMITIDOS = ['ESTUDIANTE', 'ADMIN']

const COLOR_MATERIA: Record<string, { texto: string }> = {
  'Lectura Crítica': { texto: 'text-violet-700' },
  'Matemáticas': { texto: 'text-blue-700' },
  'Sociales y Ciudadanas': { texto: 'text-amber-700' },
  'Ciencias Naturales': { texto: 'text-emerald-700' },
  'Inglés': { texto: 'text-rose-700' },
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

  // Orden real en el que las lecciones aparecen en el sendero: sección
  // ascendente y, dentro de cada sección, el orden fijo de MATERIAS.
  const disponibles = lecciones.filter(l => l._count.preguntas > 0)
  const seccionesDisponibles = Array.from(new Set(disponibles.map(l => l.sesion))).sort((a, b) => a - b)
  const secuencia = seccionesDisponibles.flatMap(sesion =>
    MATERIAS.flatMap(materia => disponibles.filter(l => l.materia === materia && l.sesion === sesion).map(l => ({ ...l, materia })))
  )

  // Una sola cadena de desbloqueo global: solo la primera lección del sendero
  // empieza desbloqueada; completarla desbloquea la siguiente, y así sucesivamente.
  let previaCompletada = true
  const secuenciaConEstado = secuencia.map((l, idx) => {
    const completada = completadasSet.has(l.id)
    const desbloqueada = previaCompletada
    previaCompletada = completada
    return { ...l, completada, desbloqueada, ordenGlobal: idx + 1 }
  })

  const porSeccion = seccionesDisponibles
    .map(sesion => ({ sesion, lecciones: secuenciaConEstado.filter(l => l.sesion === sesion) }))
    .filter(s => s.lecciones.length > 0)

  const totalCompletadas = completadas.length
  const sinCorazones = perfil.plan !== 'PREMIUM' && perfil.corazones <= 0

  return (
    <main
      className="min-h-dvh"
      style={{
        background: '#f3e6c8',
        backgroundImage:
          'radial-gradient(circle at 15% 20%, rgba(180,150,90,0.12) 0, transparent 45%), radial-gradient(circle at 85% 75%, rgba(180,150,90,0.12) 0, transparent 45%)',
      }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-md bg-[#fdf6e3]/90 border-b border-[#d8c090]">
        <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link href="/inicio" title="Volver al inicio" className="text-[#8a6a35]/70 hover:text-[#8a6a35] transition-colors shrink-0">
              <ArrowLeft className="w-4.5 h-4.5" />
            </Link>
            <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-[#fdf6e3] shadow-[0_0_0_1.5px_#c9a86a] shrink-0">
              <Image src="/brito/brito-hero.jpg" alt="Brito" width={36} height={36} className="object-cover w-full h-full" />
            </div>
            <span className="text-[#5a4322] font-bold text-sm">Brito</span>
          </div>

          {/* Stats centradas (solo móvil — en desktop se muestran en el panel lateral) */}
          <div className="lg:hidden absolute left-1/2 -translate-x-1/2 flex items-center gap-4 text-[#5a4322] text-sm font-semibold">
            <span className="flex items-center gap-1"><Flame className="w-4 h-4 text-orange-500" /> {perfil.rachaActual}</span>
            <span className="flex items-center gap-1">
              <Heart className="w-4 h-4 text-red-500" />
              {perfil.plan === 'PREMIUM' ? '∞' : perfil.corazones}
            </span>
            <span className="flex items-center gap-1 text-amber-700">{perfil.xpTotal} XP</span>
            <Link href="/brito/ranking" title="Ranking" className="text-[#8a6a35]/70 hover:text-[#8a6a35] transition-colors">
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

      <div className="w-full px-4 md:px-8 py-8">
        {sinCorazones && (
          <div className="mb-6 max-w-md mx-auto lg:mx-0 bg-red-50 border border-red-300 rounded-xl p-4 text-center">
            <p className="text-sm font-semibold text-red-700">Te quedaste sin corazones</p>
            <p className="text-xs text-red-700/70 mt-0.5">Se regeneran 1 cada 4 horas. Vuelve pronto o hazte Premium.</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_320px] gap-10 lg:items-stretch">
          {/* Nav lateral izquierda — solo desktop */}
          <aside className="hidden lg:block lg:border-r lg:border-[#d8c090] lg:pr-6">
          <div className="sticky top-24 flex flex-col gap-1">
            <Link
              href="/brito/mapa"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#e8a33d]/20 text-[#b3781f] text-sm font-bold"
            >
              <MapIcon className="w-[18px] h-[18px]" /> Aprender
            </Link>
            <Link
              href="/brito/ranking"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#7a6640] hover:text-[#5a4322] hover:bg-[#e8dcc0] transition-colors text-sm font-medium"
            >
              <Trophy className="w-[18px] h-[18px]" /> Ligas
            </Link>
            <span
              title="Próximamente"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#a99a76] text-sm font-medium cursor-default"
            >
              <Gift className="w-[18px] h-[18px]" /> Recompensas
            </span>
            <PerfilMenu
              nombre={estudiante?.nombre ?? 'Estudiante'}
              email={estudiante?.email ?? ''}
              plan={perfil.plan === 'PREMIUM' ? 'PREMIUM' : 'FREE'}
              xpTotal={perfil.xpTotal}
              rachaMejor={perfil.rachaMejor}
              imagenUrl={(session?.user as any)?.image ?? null}
              variante="navitem"
            />
          </div>
          </aside>

          {/* Sendero de secciones — centrado en el espacio disponible */}
          <div className="max-w-md mx-auto space-y-14">
            <div className="flex items-center justify-center gap-2 text-[#8a6a35]">
              <Compass className="w-[18px] h-[18px]" />
              <span className="text-xs font-bold uppercase tracking-widest">Mapa de aventuras Brito</span>
            </div>

            {porSeccion.map(({ sesion, lecciones: ls }) => (
              <div key={sesion}>
                {/* Banner de la sección */}
                <div className="bg-[#fdf6e3] border-2 border-dashed border-[#c9a86a] rounded-2xl px-5 py-4 mb-10 shadow-[2px_2px_0_#d8c090] text-center">
                  <p className="text-[#a9834a] text-[11px] font-bold uppercase tracking-wider">Sección {sesion}</p>
                  <h2 className="text-[#5a4322] font-extrabold text-lg leading-tight">Practica todas las materias</h2>
                </div>

                {/* Sendero de lecciones en zig-zag */}
                <div className="flex flex-col items-center gap-7">
                  {ls.map((l, idx) => {
                    const color = COLOR_MATERIA[l.materia] ?? COLOR_MATERIA['Lectura Crítica']
                    const bloqueada = !l.desbloqueada
                    const esActual = l.desbloqueada && !l.completada
                    const offset = OFFSETS_X[idx % OFFSETS_X.length]

                    const nodo = (
                      <div
                        className={[
                          'rounded-full flex items-center justify-center transition-transform relative border-[3px] border-[#fdf6e3]',
                          esActual ? 'w-20 h-20' : 'w-16 h-16',
                          bloqueada
                            ? 'bg-[#d9c9a3] shadow-[0_0_0_2px_#c9b483]'
                            : l.completada
                            ? 'bg-[#5aab7e] shadow-[0_0_0_2px_#4a8f68] hover:scale-105 active:scale-95'
                            : 'bg-[#e8a33d] shadow-[0_0_0_2px_#c9822a] hover:scale-105 active:scale-95',
                        ].join(' ')}
                      >
                        {bloqueada ? (
                          <Lock className="w-5 h-5 text-[#8a7550]" />
                        ) : l.completada ? (
                          <Check className="w-6 h-6 text-white" />
                        ) : (
                          <span className="text-white font-bold text-base">{l.ordenGlobal}</span>
                        )}
                      </div>
                    )

                    return (
                      <div
                        key={l.id}
                        className="flex flex-col items-center gap-1 relative"
                        style={{ transform: `translateX(${offset}px)` }}
                      >
                        {esActual && (
                          <span className="absolute -top-11 px-3 py-1.5 rounded-xl bg-[#fdf6e3] border-2 border-[#c9a86a] text-[#5a4322] text-xs font-extrabold shadow-sm whitespace-nowrap animate-bounce">
                            EMPEZAR
                            <span className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-[#fdf6e3] border-r-2 border-b-2 border-[#c9a86a] rotate-45" />
                          </span>
                        )}
                        {bloqueada ? (
                          <div className="opacity-70">{nodo}</div>
                        ) : (
                          <Link href={`/brito/leccion/${l.id}`}>{nodo}</Link>
                        )}
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${color.texto}`}>{l.materia}</span>
                        <span className="text-[11px] text-[#7a6640] font-medium text-center leading-tight max-w-24">{l.titulo}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {porSeccion.length > 0 && (
              <div className="flex flex-col items-center gap-2 pt-2">
                <div className="w-14 h-14 rounded-full bg-[#fdf6e3] border-2 border-dashed border-[#c9a86a] flex items-center justify-center">
                  <Flag className="w-5 h-5 text-[#a9834a]" />
                </div>
                <span className="text-[11px] text-[#a9834a] font-medium">Meta del recorrido</span>
              </div>
            )}

            {porSeccion.length === 0 && (
              <div className="flex flex-col items-center text-center mt-16 gap-4">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#fdf6e3] shadow-[0_0_0_2px_#c9a86a] opacity-90">
                  <Image src="/brito/brito-hero.jpg" alt="Brito" width={80} height={80} className="object-cover w-full h-full" />
                </div>
                <div>
                  <p className="text-[#5a4322] font-semibold text-sm">Brito está preparando tus lecciones</p>
                  <p className="text-[#7a6640] text-xs mt-1 max-w-[240px]">Todavía no hay lecciones publicadas. Vuelve pronto para empezar a practicar.</p>
                </div>
              </div>
            )}
          </div>

          {/* Panel lateral — solo desktop */}
          <aside className="hidden lg:block lg:border-l lg:border-[#d8c090] lg:pl-8">
          <div className="sticky top-24 space-y-4">
            <div className="bg-[#fdf6e3] border border-[#d8c090] rounded-2xl p-4 space-y-3 shadow-[2px_2px_0_#e8dcc0]">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-[#7a6640] font-medium"><Flame className="w-4 h-4 text-orange-500" /> Racha</span>
                <span className="text-[#5a4322] font-bold">{perfil.rachaActual}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-[#7a6640] font-medium"><Heart className="w-4 h-4 text-red-500" /> Vidas</span>
                <span className="text-[#5a4322] font-bold">{perfil.plan === 'PREMIUM' ? '∞' : perfil.corazones}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-[#7a6640] font-medium"><Gem className="w-4 h-4 text-sky-600" /> XP</span>
                <span className="text-[#5a4322] font-bold">{perfil.xpTotal}</span>
              </div>
            </div>

            <Link
              href="/brito/ranking"
              className="block bg-[#fdf6e3] border border-[#d8c090] rounded-2xl p-4 shadow-[2px_2px_0_#e8dcc0] hover:border-[#c9a86a] transition-colors"
            >
              <p className="text-[#5a4322] font-bold text-sm mb-2">¡Compite en las Ligas!</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#e8a33d]/15 border border-[#e8a33d]/30 flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5 text-amber-600" />
                </div>
                <p className="text-[#7a6640] text-xs leading-snug">
                  {totalCompletadas > 0 ? 'Ve el ranking semanal y tu posición.' : 'Completa tu primera lección para entrar al ranking.'}
                </p>
              </div>
            </Link>
          </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
