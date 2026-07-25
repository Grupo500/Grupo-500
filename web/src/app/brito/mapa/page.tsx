import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Nunito } from 'next/font/google'
import { prisma } from '@/lib/prisma'
import { obtenerPerfilActual } from '../acciones'
import {
  Trophy, Lock, ArrowLeft, Route, Gift, Flag,
  BookOpen, RotateCw, ArrowRight,
} from 'lucide-react'
import { CerrarSesionIcono } from '../CerrarSesionIcono'
import { PerfilMenu } from '../PerfilMenu'

const nunito = Nunito({ subsets: ['latin'], weight: ['400', '600', '700', '800'] })

const MATERIAS = ['Lectura Crítica', 'Matemáticas', 'Sociales y Ciudadanas', 'Ciencias Naturales', 'Inglés']
const ROLES_PERMITIDOS = ['ESTUDIANTE', 'ADMIN']

const MATERIA_INFO: Record<string, { color: string; icono: string }> = {
  'Lectura Crítica': { color: '#7C6FDB', icono: '/brito/icons/lectura-critica.png' },
  'Matemáticas': { color: '#3B82D6', icono: '/brito/icons/matematicas.png' },
  'Sociales y Ciudadanas': { color: '#D69A2D', icono: '/brito/icons/sociales.png' },
  'Ciencias Naturales': { color: '#2FA37A', icono: '/brito/icons/ciencias.png' },
  'Inglés': { color: '#D6598F', icono: '/brito/icons/ingles.png' },
}

// Constantes de layout del sendero (posicionamiento absoluto, curva suave entre nodos).
const NODE = 72
const CONTENT_W = 370
const ROW_GAP = 170
const SIGN_BLOCK = 140
const TOP_PAD = 60
const BOTTOM_PAD = 140
const OFFSETS = [0, 20, 40, 20, 0, -20, -40, -20]
const BUBBLE_W = 160

function smoothPath(pts: [number, number][]): string {
  if (!pts.length) return ''
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(i + 2, pts.length - 1)]
    const c1x = p1[0] + (p2[0] - p0[0]) / 5
    const c1y = p1[1] + (p2[1] - p0[1]) / 5
    const c2x = p2[0] - (p3[0] - p1[0]) / 5
    const c2y = p2[1] - (p3[1] - p1[1]) / 5
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`
  }
  return d
}

function circuloEstilo(status: 'completed' | 'current' | 'locked') {
  if (status === 'completed') return { background: '#22C56E', boxShadow: '0 6px 0 #159354, 0 8px 14px rgba(0,0,0,0.15)' }
  if (status === 'current') return { background: '#F5A623', boxShadow: '0 6px 0 #C97E1E, 0 8px 14px rgba(0,0,0,0.15)' }
  return { background: '#D8D8D2', boxShadow: '0 6px 0 #B5B5AE, 0 8px 14px rgba(0,0,0,0.1)' }
}

type NodoLeccion = {
  id: string
  materia: string
  titulo: string
  status: 'completed' | 'current' | 'locked'
  esRepaso?: boolean
}

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
  const secuenciaConEstado = secuencia.map(l => {
    const completada = completadasSet.has(l.id)
    const desbloqueada = previaCompletada
    previaCompletada = completada
    const status: NodoLeccion['status'] = completada ? 'completed' : desbloqueada ? 'current' : 'locked'
    return { id: l.id, materia: l.materia, titulo: l.titulo, status }
  })

  const secciones = seccionesDisponibles
    .map(sesion => {
      const nodosMateria = secuenciaConEstado.filter((_, idx) => secuencia[idx].sesion === sesion)
      if (nodosMateria.length === 0) return null
      const todasCompletadas = nodosMateria.every(n => n.status === 'completed')
      const repaso: NodoLeccion = {
        id: `repaso-${sesion}`,
        materia: 'Repaso',
        titulo: 'Repaso de la sección',
        status: todasCompletadas ? 'completed' : 'locked',
        esRepaso: true,
      }
      return { sesion, nodos: [...nodosMateria, repaso] }
    })
    .filter((s): s is { sesion: number; nodos: NodoLeccion[] } => s !== null)

  // Layout absoluto: se calculan las coordenadas (top/left) de cada nodo,
  // los puntos de la curva del sendero por sección, y la posición final de la bandera.
  let y = TOP_PAD
  let gIndex = 0
  const rutas: string[] = []
  const divisores: number[] = []
  const bloques = secciones.map((sec, secIdx) => {
    if (secIdx > 0) divisores.push(y + 35)
    const headerTop = y
    y += SIGN_BLOCK
    const puntos: [number, number][] = []
    const nodos = sec.nodos.map(n => {
      const off = OFFSETS[gIndex % OFFSETS.length]
      const centerX = CONTENT_W / 2 + off
      const centerY = y + NODE / 2
      puntos.push([centerX, centerY])
      const bubbleSide: 'left' | 'right' = gIndex % 2 === 0 ? 'right' : 'left'
      const top = y
      y += ROW_GAP
      gIndex++
      return { ...n, top, left: centerX - NODE / 2, bubbleSide }
    })
    rutas.push(smoothPath(puntos))
    return { sesion: sec.sesion, headerTop, nodos }
  })

  let flag: { top: number; left: number } | null = null
  if (bloques.length > 0) {
    const off = OFFSETS[gIndex % OFFSETS.length]
    const flagCenterX = CONTENT_W / 2 + off
    flag = { top: y, left: flagCenterX - NODE / 2 }
  }
  const totalHeight = y + NODE + BOTTOM_PAD

  const totalCompletadas = completadas.length
  const sinCorazones = perfil.plan !== 'PREMIUM' && perfil.corazones <= 0

  return (
    <main className={`${nunito.className} min-h-dvh`} style={{ background: '#FAFAF7', color: '#2B2B28' }}>
      {/* Header móvil */}
      <div className="lg:hidden sticky top-0 z-10 backdrop-blur-md bg-white/90 border-b border-[#ECEAE2]">
        <div className="relative max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link href="/inicio" title="Volver al inicio" className="text-[#6b6a63] hover:text-[#2B2B28] transition-colors shrink-0">
              <ArrowLeft className="w-4.5 h-4.5" />
            </Link>
            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
              <Image src="/brito/brito-hero.jpg" alt="Brito" width={36} height={36} className="object-cover w-full h-full" />
            </div>
            <span className="text-[#2B2B28] font-extrabold text-sm">Brito</span>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-4 text-sm font-bold">
            <span className="flex items-center gap-1">
              <img src="/brito/icons/racha.png" alt="" className="w-5 h-5 object-contain" /> {perfil.rachaActual}
            </span>
            <span className="flex items-center gap-1">
              <img src="/brito/icons/vidas.png" alt="" className="w-5 h-5 object-contain" />
              {perfil.plan === 'PREMIUM' ? '∞' : perfil.corazones}
            </span>
            <span className="flex items-center gap-1">
              <img src="/brito/icons/xp.png" alt="" className="w-5 h-5 object-contain" /> {perfil.xpTotal}
            </span>
            <Link href="/brito/ranking" title="Ranking" className="text-[#6b6a63] hover:text-[#2B2B28] transition-colors">
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

      {sinCorazones && (
        <div className="lg:hidden mx-4 mt-4 bg-[#FCE9F0] border border-[#F3C6D8] rounded-xl p-4 text-center">
          <p className="text-sm font-bold text-[#B33D6E]">Te quedaste sin corazones</p>
          <p className="text-xs text-[#B33D6E]/70 mt-0.5">Se regeneran 1 cada 4 horas. Vuelve pronto o hazte Premium.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] lg:h-dvh">
        {/* Nav lateral izquierda — solo desktop */}
        <aside className="hidden lg:flex flex-col gap-1.5 bg-white border-r border-[#ECEAE2] p-6">
          <div className="flex items-center gap-2.5 pb-5 mb-2 border-b border-[#ECEAE2]">
            <div className="w-8 h-8 rounded-[10px] bg-[#1E5FA8] text-white flex items-center justify-center font-extrabold text-sm">B</div>
            <span className="font-extrabold text-lg text-[#2B2B28]">Brito</span>
          </div>

          <Link
            href="/brito/mapa"
            className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] bg-[#EAF1FA] text-[#1E5FA8] text-sm font-bold"
          >
            <Route className="w-[18px] h-[18px]" /> Aprender
          </Link>
          <Link
            href="/brito/ranking"
            className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[#57564f] hover:bg-[#F5F3EC] transition-colors text-sm font-bold"
          >
            <Trophy className="w-[18px] h-[18px]" /> Ligas
          </Link>
          <span
            title="Próximamente"
            className="flex flex-col gap-0.5 px-3 py-2.5 rounded-[10px] opacity-50 cursor-default"
          >
            <span className="flex items-center gap-3 text-[#57564f] text-sm font-bold">
              <Gift className="w-[18px] h-[18px]" /> Recompensas
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#9a998f] ml-[30px]">Próximamente</span>
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
        </aside>

        {/* Sendero central */}
        <div className="lg:overflow-y-auto" style={{ background: '#EEF2F7' }}>
          {sinCorazones && (
            <div className="hidden lg:block max-w-md mx-auto mt-6 bg-[#FCE9F0] border border-[#F3C6D8] rounded-xl p-4 text-center">
              <p className="text-sm font-bold text-[#B33D6E]">Te quedaste sin corazones</p>
              <p className="text-xs text-[#B33D6E]/70 mt-0.5">Se regeneran 1 cada 4 horas. Vuelve pronto o hazte Premium.</p>
            </div>
          )}

          {bloques.length === 0 ? (
            <div className="flex flex-col items-center text-center py-20 gap-4 px-6">
              <div className="w-20 h-20 rounded-full overflow-hidden shadow-md">
                <Image src="/brito/brito-hero.jpg" alt="Brito" width={80} height={80} className="object-cover w-full h-full" />
              </div>
              <div>
                <p className="text-[#2B2B28] font-bold text-sm">Brito está preparando tus lecciones</p>
                <p className="text-[#6b6a63] text-xs mt-1 max-w-[240px]">Todavía no hay lecciones publicadas. Vuelve pronto para empezar a practicar.</p>
              </div>
            </div>
          ) : (
            <div className="relative mx-auto py-4" style={{ width: CONTENT_W, height: totalHeight }}>
              <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none">
                {rutas.map((d, i) => (
                  <path key={i} d={d} fill="none" stroke="#DCD7C8" strokeWidth={4} strokeLinecap="round" strokeDasharray="1 16" />
                ))}
              </svg>

              {divisores.map((top, i) => (
                <div key={i}>
                  <div className="absolute h-px" style={{ top, left: 0, width: 76, background: '#D9DEE5' }} />
                  <div className="absolute h-px" style={{ top, right: 0, width: 76, background: '#D9DEE5' }} />
                </div>
              ))}

              {bloques.map(bloque => (
                <div key={bloque.sesion}>
                  <div
                    className="absolute left-1/2 -translate-x-1/2 bg-white rounded-xl px-4 py-3 text-center shadow-sm flex items-center justify-center gap-2"
                    style={{ top: bloque.headerTop, width: 200, boxShadow: '0 2px 8px rgba(40,30,10,0.06)' }}
                  >
                    <BookOpen className="w-4 h-4 text-[#1E5FA8] shrink-0" />
                    <div>
                      <div className="font-extrabold text-[15px] text-[#2B2B28] leading-tight">Sección {bloque.sesion}</div>
                      <div className="text-[11.5px] font-semibold text-[#8a897f]">Practica todas las materias</div>
                    </div>
                  </div>

                  {bloque.nodos.map(nodo => {
                    const info = MATERIA_INFO[nodo.materia]
                    const subjectColor = nodo.esRepaso ? '#1E5FA8' : info?.color ?? '#1E5FA8'
                    const circulo = (
                      <div
                        className={`w-[72px] h-[72px] rounded-full border-[5px] border-white flex items-center justify-center relative transition-transform ${nodo.status !== 'locked' ? 'hover:-translate-y-[3px]' : ''} ${nodo.status === 'current' ? 'brito-pulse' : ''}`}
                        style={circuloEstilo(nodo.status)}
                      >
                        {nodo.status === 'locked' ? (
                          <Lock className="w-[22px] h-[22px] text-[#9a998f]" />
                        ) : nodo.esRepaso ? (
                          <RotateCw className="w-[26px] h-[26px] text-white" />
                        ) : (
                          <img src={info?.icono} alt="" className="w-11 h-11 object-contain" />
                        )}
                      </div>
                    )
                    return (
                      <div key={nodo.id} className="absolute" style={{ top: nodo.top, left: nodo.left, width: NODE }}>
                        {nodo.status === 'current' && (
                          <div
                            className="absolute whitespace-nowrap text-white font-extrabold text-[11.5px] px-3.5 py-1.5 rounded-full animate-bounce"
                            style={{ top: -34, left: '50%', transform: 'translateX(-50%)', background: '#F5A623', boxShadow: '0 4px 10px rgba(245,166,35,0.4)' }}
                          >
                            EMPEZAR
                            <div className="absolute rotate-45" style={{ bottom: -4, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 8, height: 8, background: '#F5A623' }} />
                          </div>
                        )}

                        {nodo.esRepaso || nodo.status === 'locked' ? (
                          <div className={nodo.status === 'locked' ? 'opacity-90' : ''}>{circulo}</div>
                        ) : (
                          <Link href={`/brito/leccion/${nodo.id}`}>{circulo}</Link>
                        )}

                        <div
                          className="absolute bg-white rounded-[14px] px-2.5 py-1.5 shadow-sm"
                          style={{
                            top: 36,
                            transform: 'translateY(-50%)',
                            width: BUBBLE_W,
                            boxShadow: '0 2px 8px rgba(40,30,10,0.12)',
                            textAlign: nodo.bubbleSide === 'left' ? 'right' : 'left',
                            ...(nodo.bubbleSide === 'left' ? { right: 80 } : { left: 80 }),
                          }}
                        >
                          <div className="font-bold text-xs" style={{ color: subjectColor }}>{nodo.materia}</div>
                          <div className="text-[11px] font-semibold text-[#79786f] mt-0.5">{nodo.titulo}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}

              {flag && (
                <>
                  <div
                    className="absolute w-[72px] h-[72px] rounded-full flex items-center justify-center"
                    style={{ top: flag.top, left: flag.left, background: '#1E5FA8', boxShadow: '0 4px 12px rgba(30,95,168,0.25)' }}
                  >
                    <Flag className="w-[26px] h-[26px] text-white" />
                  </div>
                  <div className="absolute text-center" style={{ top: flag.top + 88, left: flag.left, width: NODE }}>
                    <div className="font-bold text-[12.5px] text-[#57564f]">Meta</div>
                    <div className="text-[11px] font-semibold text-[#8a897f]">Fin de la sección</div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Panel lateral — solo desktop */}
        <aside className="hidden lg:flex flex-col gap-4 bg-white border-l border-[#ECEAE2] p-6">
          <div className="rounded-2xl p-4 flex flex-col gap-3.5" style={{ background: '#EAF1FA', border: '1px solid #DCE8F5' }}>
            <div className="flex items-center gap-3">
              <img src="/brito/icons/racha.png" alt="" className="w-8 h-8 object-contain" />
              <div>
                <div className="font-extrabold text-base text-[#2B2B28]">{perfil.rachaActual} días</div>
                <div className="text-[11px] text-[#8a897f] font-semibold">Racha actual</div>
              </div>
            </div>
            <div className="h-px bg-[#D9DEE5]" />
            <div className="flex items-center gap-3">
              <img src="/brito/icons/vidas.png" alt="" className="w-8 h-8 object-contain" />
              <div>
                <div className="font-extrabold text-base text-[#2B2B28]">{perfil.plan === 'PREMIUM' ? '∞' : perfil.corazones} vidas</div>
                <div className="text-[11px] text-[#8a897f] font-semibold">Te quedan</div>
              </div>
            </div>
            <div className="h-px bg-[#D9DEE5]" />
            <div className="flex items-center gap-3">
              <img src="/brito/icons/xp.png" alt="" className="w-8 h-8 object-contain" />
              <div>
                <div className="font-extrabold text-base text-[#2B2B28]">{perfil.xpTotal} XP</div>
                <div className="text-[11px] text-[#8a897f] font-semibold">Experiencia total</div>
              </div>
            </div>
          </div>

          <Link
            href="/brito/ranking"
            className="rounded-2xl p-4 flex flex-col gap-2"
            style={{ background: '#EAF1FA', border: '1px solid #DCE8F5' }}
          >
            <Trophy className="w-[26px] h-[26px] text-[#1E5FA8]" />
            <div className="font-extrabold text-[15px] text-[#2B2B28]">¡Compite en las Ligas!</div>
            <p className="text-xs font-semibold text-[#6b6a63] leading-snug">
              {totalCompletadas > 0 ? 'Sube posiciones y gana medallas cada semana.' : 'Completa tu primera lección para entrar al ranking.'}
            </p>
            <div
              className="mt-1.5 rounded-full py-2.5 px-4 flex items-center justify-center gap-1.5 text-white font-bold text-[13px]"
              style={{ background: '#1E5FA8', boxShadow: '0 4px 12px rgba(30,95,168,0.28)' }}
            >
              Ver ranking <ArrowRight className="w-4 h-4" />
            </div>
          </Link>
        </aside>
      </div>

      <style>{`
        @keyframes pulseRing {
          0%, 100% { box-shadow: 0 6px 0 #C97E1E, 0 8px 14px rgba(0,0,0,0.15), 0 0 0 0 rgba(245,166,35,0.35); }
          50% { box-shadow: 0 6px 0 #C97E1E, 0 8px 14px rgba(0,0,0,0.15), 0 0 0 8px rgba(245,166,35,0); }
        }
        .brito-pulse { animation: pulseRing 2.4s ease-out infinite; }
      `}</style>
    </main>
  )
}
