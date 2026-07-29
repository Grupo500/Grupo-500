import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Nunito } from 'next/font/google'
import { prisma } from '@/lib/prisma'
import { obtenerPerfilActual } from '../acciones'
import { obtenerEstadoLiga } from '../ligas'
import { RankingModal } from '../RankingModal'
import { MATERIAS, MATERIA_INFO } from '@/lib/britoMaterias'
import {
  Lock, ArrowLeft, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { CerrarSesionIcono } from '../CerrarSesionIcono'
import { PerfilMenu } from '../PerfilMenu'

const nunito = Nunito({ subsets: ['latin'], weight: ['400', '600', '700', '800'] })

const ROLES_PERMITIDOS = ['ESTUDIANTE', 'ADMIN']

// Cada sección tiene su propio degradado de banner, rotando la paleta.
const COLORES_SECCION = [
  { de: '#1E5FA8', a: '#2E86D9', halo: 'rgba(30,95,168,0.30)' },
  { de: '#17845F', a: '#22C56E', halo: 'rgba(23,132,95,0.30)' },
  { de: '#A63F6C', a: '#D6598F', halo: 'rgba(166,63,108,0.30)' },
  { de: '#C97E1E', a: '#F5A623', halo: 'rgba(201,126,30,0.30)' },
  { de: '#5B4FB0', a: '#7C6FDB', halo: 'rgba(91,79,176,0.30)' },
]

// Constantes de layout del sendero (posicionamiento absoluto, curva suave entre nodos).
const NODE = 72
const CONTENT_W = 370
const ROW_GAP = 170
const SIGN_BLOCK = 210
const TOP_PAD = 28
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

export default async function MapaBritoPage({
  searchParams,
}: {
  searchParams: Promise<{ seccion?: string }>
}) {
  const { seccion: seccionParam } = await searchParams
  const session = await auth()
  if (!ROLES_PERMITIDOS.includes((session?.user as any)?.role)) redirect('/brito')

  const perfil = await obtenerPerfilActual()
  if (!perfil) redirect('/brito')
  const estudianteId = perfil.estudianteId

  const [lecciones, completadas, estudiante, estadoLiga] = await Promise.all([
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
    obtenerEstadoLiga(estudianteId),
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
      return { sesion, nodos: [...nodosMateria, repaso], completa: todasCompletadas }
    })
    .filter((s): s is { sesion: number; nodos: NodoLeccion[]; completa: boolean } => s !== null)

  // Paginación: se muestra una sola sección a la vez. Una sección queda
  // accesible cuando la anterior está completa; la primera siempre lo está.
  const accesibles = secciones.map((_, i) => i === 0 || secciones[i - 1].completa)
  const indicePorDefecto = Math.max(
    0,
    secciones.findIndex(s => s.nodos.some(n => n.status === 'current'))
  )
  const pedido = seccionParam ? secciones.findIndex(s => s.sesion === Number(seccionParam)) : -1
  const indiceActivo = pedido >= 0 && accesibles[pedido] ? pedido : indicePorDefecto
  const seccionActiva = secciones[indiceActivo]
  const hayAnterior = indiceActivo > 0
  const haySiguiente = indiceActivo < secciones.length - 1
  const siguienteDesbloqueada = haySiguiente && accesibles[indiceActivo + 1]
  const seccionesVisibles = seccionActiva ? [seccionActiva] : []

  // Layout absoluto: se calculan las coordenadas (top/left) de cada nodo,
  // los puntos de la curva del sendero por sección, y la posición final de la bandera.
  let y = TOP_PAD
  let gIndex = 0
  const rutas: string[] = []
  const divisores: number[] = []
  const bloques = seccionesVisibles.map((sec, secIdx) => {
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
    const color = COLORES_SECCION[(sec.sesion - 1 + COLORES_SECCION.length) % COLORES_SECCION.length]
    const hechas = sec.nodos.filter(n => n.status === 'completed').length
    return { sesion: sec.sesion, headerTop, nodos, color, hechas, totalNodos: sec.nodos.length }
  })

  const totalHeight = y + BOTTOM_PAD

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
            <RankingModal estado={estadoLiga} miId={estudianteId} variante="icono" />
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
            className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] bg-[#EAF1FA] text-[#1E5FA8] text-sm font-semibold"
          >
            <img src="/brito/icons/aprender.png" alt="" className="w-8 h-8 object-contain" /> Aprender
          </Link>
          <RankingModal estado={estadoLiga} miId={estudianteId} variante="navitem" />
          <span
            title="Próximamente"
            className="flex flex-col gap-0.5 px-3 py-2.5 rounded-[10px] opacity-50 cursor-default"
          >
            <span className="flex items-center gap-3 text-[#57564f] text-sm font-semibold">
              <img src="/brito/icons/regalo.png" alt="" className="w-8 h-8 object-contain" /> Recompensas
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#9a998f] ml-[44px]">Próximamente</span>
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

          {/* Salida al selector de módulos. Va al final y separada: es la única
              opción que saca de Brito, y arriba competiría con la navegación
              del propio juego. */}
          <Link
            href="/inicio"
            className="flex items-center gap-3 px-3 py-2.5 mt-auto rounded-[10px] text-[#57564f] text-sm font-semibold hover:bg-[#F4F3EE] transition-colors"
          >
            <span className="w-8 h-8 flex items-center justify-center shrink-0">
              <ArrowLeft className="w-[18px] h-[18px]" />
            </span>
            Otros módulos
          </Link>
        </aside>

        {/* Sendero central */}
        <div className="lg:overflow-y-auto" style={{ background: '#EEF2F7' }}>
          {sinCorazones && (
            <div className="hidden lg:block max-w-md mx-auto mt-6 bg-[#FCE9F0] border border-[#F3C6D8] rounded-xl p-4 text-center">
              <p className="text-sm font-bold text-[#B33D6E]">Te quedaste sin corazones</p>
              <p className="text-xs text-[#B33D6E]/70 mt-0.5">Se regeneran 1 cada 4 horas. Vuelve pronto o hazte Premium.</p>
            </div>
          )}

          {seccionActiva && secciones.length > 1 && (
            <div className="sticky top-0 z-10 backdrop-blur-md bg-[#EEF2F7]/85 border-b border-[#DDE3EB]">
              <div className="mx-auto flex items-center justify-between gap-2 px-3 py-2.5" style={{ maxWidth: CONTENT_W + 40 }}>
                {hayAnterior ? (
                  <Link
                    href={`/brito/mapa?seccion=${secciones[indiceActivo - 1].sesion}`}
                    className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-[#1E5FA8] shadow-sm transition-colors hover:bg-[#EAF1FA]"
                  >
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </Link>
                ) : (
                  <span className="w-[92px]" />
                )}

                <span className="text-[12px] font-bold text-[#6b6a63]">
                  Sección {seccionActiva.sesion} de {secciones.length}
                </span>

                {siguienteDesbloqueada ? (
                  <Link
                    href={`/brito/mapa?seccion=${secciones[indiceActivo + 1].sesion}`}
                    className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-[#1E5FA8] shadow-sm transition-colors hover:bg-[#EAF1FA]"
                  >
                    Siguiente <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : haySiguiente ? (
                  <span
                    title="Completa esta sección para desbloquear la siguiente"
                    className="flex cursor-default items-center gap-1 rounded-full bg-[#E4E7EC] px-3 py-1.5 text-[12px] font-bold text-[#9a998f]"
                  >
                    Siguiente <Lock className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <span className="w-[92px]" />
                )}
              </div>
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
                    className="absolute left-1/2 overflow-hidden rounded-[20px] px-5 py-4"
                    style={{
                      top: bloque.headerTop,
                      transform: 'translateX(-50%)',
                      width: 'min(500px, 92vw)',
                      background: `linear-gradient(115deg, ${bloque.color.de} 0%, ${bloque.color.a} 100%)`,
                      boxShadow: `0 10px 24px -6px ${bloque.color.halo}`,
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                        style={{ background: 'rgba(255,255,255,0.92)' }}
                      >
                        <img src="/brito/icons/libro.png" alt="" className="h-7 w-7 object-contain" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <span
                          className="inline-block rounded-full px-2.5 py-[3px] text-[10px] font-bold uppercase tracking-wider text-white"
                          style={{ background: 'rgba(255,255,255,0.22)' }}
                        >
                          Sección {bloque.sesion}
                        </span>
                        <div className="mt-1.5 text-[18px] font-bold leading-tight text-white">
                          Practica todas las materias
                        </div>
                      </div>
                    </div>

                    <div className="mt-3.5 flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.25)' }}>
                        <div
                          className="h-full rounded-full bg-white transition-all"
                          style={{ width: `${Math.round((bloque.hechas / bloque.totalNodos) * 100)}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[11.5px] font-extrabold text-white/90">
                        {bloque.hechas}/{bloque.totalNodos}
                      </span>
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
                          <img src="/brito/icons/repaso.png" alt="" className="w-10 h-10 object-contain" />
                        ) : (
                          <img src={info?.icono} alt="" className="w-11 h-11 object-contain" />
                        )}
                      </div>
                    )
                    return (
                      <div key={nodo.id} className="absolute" style={{ top: nodo.top, left: nodo.left, width: NODE }}>
                        {nodo.status === 'current' && (
                          // El contenedor externo centra; el interno anima. Si se juntan,
                          // el transform de animate-bounce pisa el translateX(-50%) del centrado.
                          <div className="absolute" style={{ top: -34, left: '50%', transform: 'translateX(-50%)' }}>
                            <div
                              className="relative whitespace-nowrap text-white font-extrabold text-[11.5px] px-3.5 py-1.5 rounded-full animate-bounce"
                              style={{ background: '#F5A623', boxShadow: '0 4px 10px rgba(245,166,35,0.4)' }}
                            >
                              EMPEZAR
                              <div className="absolute" style={{ bottom: -4, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 8, height: 8, background: '#F5A623' }} />
                            </div>
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
                          <div className="font-semibold text-xs" style={{ color: subjectColor }}>{nodo.materia}</div>
                          <div className="text-[11px] font-normal text-[#79786f] mt-0.5">{nodo.titulo}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel lateral — solo desktop */}
        <aside className="hidden lg:flex flex-col gap-4 bg-white border-l border-[#ECEAE2] p-6">
          <div className="rounded-2xl p-4 flex flex-col gap-3.5" style={{ background: '#EAF1FA', border: '1px solid #DCE8F5' }}>
            <div className="flex items-center gap-3">
              <img src="/brito/icons/racha.png" alt="" className="w-8 h-8 object-contain" />
              <div>
                <div className="font-bold text-base text-[#2B2B28]">{perfil.rachaActual} días</div>
                <div className="text-[11px] text-[#8a897f] font-medium">Racha actual</div>
              </div>
            </div>
            <div className="h-px bg-[#D9DEE5]" />
            <div className="flex items-center gap-3">
              <img src="/brito/icons/vidas.png" alt="" className="w-8 h-8 object-contain" />
              <div>
                <div className="font-bold text-base text-[#2B2B28]">{perfil.plan === 'PREMIUM' ? '∞' : perfil.corazones} vidas</div>
                <div className="text-[11px] text-[#8a897f] font-medium">Te quedan</div>
              </div>
            </div>
            <div className="h-px bg-[#D9DEE5]" />
            <div className="flex items-center gap-3">
              <img src="/brito/icons/xp.png" alt="" className="w-8 h-8 object-contain" />
              <div>
                <div className="font-bold text-base text-[#2B2B28]">{perfil.xpTotal} XP</div>
                <div className="text-[11px] text-[#8a897f] font-medium">Experiencia total</div>
              </div>
            </div>
          </div>

          <RankingModal estado={estadoLiga} miId={estudianteId} />
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
