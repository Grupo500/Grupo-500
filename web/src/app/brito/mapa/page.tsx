import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { obtenerPerfilActual } from '../acciones'
import { obtenerEstadoLiga } from '../ligas'
import { RankingModal } from '../RankingModal'
import { MATERIAS, MATERIA_INFO } from '@/lib/britoMaterias'
import {
  Lock, ArrowLeft, ChevronLeft, ChevronRight, Star, Rocket, BookOpen, Orbit,
} from 'lucide-react'
import { CerrarSesionIcono } from '../CerrarSesionIcono'
import { PerfilMenu } from '../PerfilMenu'

const ROLES_PERMITIDOS = ['ESTUDIANTE', 'ADMIN']

// Cada sección tiene su propio color de banner, rotando la paleta.
const COLORES_SECCION = [
  { de: '#1E5FA8', halo: 'rgba(30,95,168,0.22)' },
  { de: '#17845F', halo: 'rgba(23,132,95,0.22)' },
  { de: '#A63F6C', halo: 'rgba(166,63,108,0.22)' },
  { de: '#C97E1E', halo: 'rgba(201,126,30,0.22)' },
  { de: '#5B4FB0', halo: 'rgba(91,79,176,0.22)' },
]

// Constantes de layout del sendero (posicionamiento absoluto, curva suave entre nodos).
const NODE = 84
const RING_R = 38
const CIRC = 2 * Math.PI * RING_R
const CONTENT_W = 370
const ROW_GAP = 176
const SIGN_BLOCK = 210
const TOP_PAD = 28
const BOTTOM_PAD = 60
const CHEST_BLOCK = 150
const OFFSETS = [-58, 62, -46, 66, -60, 48, -66, 54]
const CARD_W = 150

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

type NodoLeccion = {
  id: string
  materia: string
  titulo: string
  status: 'completed' | 'current' | 'locked'
  esRepaso?: boolean
  estrellas?: number
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
      select: { leccionId: true, correctas: true, total: true },
    }),
    prisma.estudianteExamen.findUnique({
      where: { id: estudianteId },
      select: { nombre: true, email: true },
    }),
    obtenerEstadoLiga(estudianteId),
  ])

  // Mejor desempeño por lección, traducido a estrellas de dominio (1 a 3).
  const mejorRatio = new Map<string, number>()
  for (const c of completadas) {
    const ratio = c.total > 0 ? c.correctas / c.total : 0
    if (ratio > (mejorRatio.get(c.leccionId) ?? -1)) mejorRatio.set(c.leccionId, ratio)
  }
  const estrellasDe = (leccionId: string) => {
    const ratio = mejorRatio.get(leccionId) ?? 0
    return ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1
  }
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
    return {
      id: l.id, materia: l.materia, titulo: l.titulo, status,
      estrellas: completada ? estrellasDe(l.id) : undefined,
    }
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
  // los puntos de la curva del sendero y la posición del cofre final.
  let y = TOP_PAD
  let gIndex = 0
  const rutas: string[] = []
  const bloques = seccionesVisibles.map(sec => {
    const headerTop = y
    y += SIGN_BLOCK
    const puntos: [number, number][] = []
    const nodos = sec.nodos.map(n => {
      const off = OFFSETS[gIndex % OFFSETS.length]
      const centerX = CONTENT_W / 2 + off
      const centerY = y + NODE / 2
      puntos.push([centerX, centerY])
      // La tarjeta va del lado contrario al que se desplaza el nodo.
      const cardSide: 'left' | 'right' = off < 0 ? 'right' : 'left'
      const top = y
      y += ROW_GAP
      gIndex++
      return { ...n, top, left: centerX - NODE / 2, cardSide }
    })
    const chestTop = y - 20
    puntos.push([CONTENT_W / 2, chestTop + 46])
    y = chestTop + CHEST_BLOCK
    rutas.push(smoothPath(puntos))
    const color = COLORES_SECCION[(sec.sesion - 1 + COLORES_SECCION.length) % COLORES_SECCION.length]
    const hechas = sec.nodos.filter(n => n.status === 'completed').length
    return { sesion: sec.sesion, headerTop, nodos, color, hechas, totalNodos: sec.nodos.length, chestTop, completa: sec.completa }
  })

  const totalHeight = y + BOTTOM_PAD

  const sinCorazones = perfil.plan !== 'PREMIUM' && perfil.corazones <= 0

  // Garabatos de cuaderno repartidos a lo largo del sendero.
  const doodles = [
    { top: totalHeight * 0.12, lado: 'left' as const, rot: -8, tipo: 'formula' as const },
    { top: totalHeight * 0.38, lado: 'right' as const, rot: 14, tipo: 'cohete' as const },
    { top: totalHeight * 0.62, lado: 'left' as const, rot: -10, tipo: 'libro' as const },
    { top: totalHeight * 0.84, lado: 'right' as const, rot: 9, tipo: 'planeta' as const },
  ]

  return (
    <main className="min-h-dvh" style={{ background: '#FAF8F0', color: '#2B2B28' }}>
      {/* Header móvil */}
      <div className="lg:hidden sticky top-0 z-10 backdrop-blur-md bg-white/90 border-b border-[#ECE9DF]">
        <div className="relative max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link href="/inicio" title="Volver al inicio" className="text-[#6b6a63] hover:text-[#2B2B28] transition-colors shrink-0">
              <ArrowLeft className="w-4.5 h-4.5" />
            </Link>
            <Image src="/brito/brito-mascota.png" alt="Brito" width={36} height={36} className="w-9 h-9 object-contain shrink-0" />
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

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] lg:h-dvh">
        {/* Nav lateral izquierda — solo desktop */}
        <aside className="hidden lg:flex flex-col gap-1.5 bg-white border-r border-[#ECE9DF] p-6">
          <div className="flex items-center gap-2.5 pb-5 mb-2 border-b border-[#ECE9DF]">
            <Image src="/brito/brito-mascota.png" alt="Brito" width={36} height={36} className="w-9 h-9 object-contain" />
            <span className="font-extrabold text-lg text-[#2B2B28]">Brito</span>
          </div>

          <Link
            href="/brito/mapa"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#EAF1FA] text-[#1E5FA8] text-sm font-semibold"
          >
            <img src="/brito/icons/aprender.png" alt="" className="w-8 h-8 object-contain" /> Aprender
          </Link>
          <RankingModal estado={estadoLiga} miId={estudianteId} variante="navitem" />
          <span
            title="Próximamente"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl opacity-55 cursor-default"
          >
            <img src="/brito/icons/regalo.png" alt="" className="w-8 h-8 object-contain" />
            <span className="text-[#57564f] text-sm font-semibold">Recompensas</span>
            <span className="ml-auto text-[10.5px] font-semibold text-[#8b8a80] bg-[#F1EFE5] px-2 py-0.5 rounded-full">Pronto</span>
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
          <div className="mt-auto border-t border-[#ECE9DF] pt-3">
            <Link
              href="/inicio"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#57564f] text-sm font-semibold hover:bg-[#F6F4EC] transition-colors"
            >
              <span className="w-8 h-8 flex items-center justify-center shrink-0">
                <ArrowLeft className="w-[18px] h-[18px]" />
              </span>
              Otros módulos
            </Link>
          </div>
        </aside>

        {/* Sendero central: la hoja de cuaderno */}
        <div
          className="lg:overflow-y-auto"
          style={{
            background: '#FAF8F0',
            backgroundImage:
              'linear-gradient(rgba(30,95,168,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(30,95,168,0.06) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        >
          <div className="relative min-h-full">
            {/* Línea de margen del cuaderno */}
            <div className="absolute top-0 bottom-0 hidden lg:block" style={{ left: 54, width: 2, background: 'rgba(214,74,74,0.35)' }} />

            {sinCorazones && (
              <div className="hidden lg:block max-w-md mx-auto pt-6 px-4">
                <div className="bg-[#FCE9F0] border border-[#F3C6D8] rounded-xl p-4 text-center">
                  <p className="text-sm font-bold text-[#B33D6E]">Te quedaste sin corazones</p>
                  <p className="text-xs text-[#B33D6E]/70 mt-0.5">Se regeneran 1 cada 4 horas. Vuelve pronto o hazte Premium.</p>
                </div>
              </div>
            )}

            {seccionActiva && secciones.length > 1 && (
              <div className="sticky top-0 z-10 backdrop-blur-md border-b border-[#ECE9DF]" style={{ background: 'rgba(250,248,240,0.88)' }}>
                <div className="mx-auto flex items-center justify-between gap-2 px-3 py-2.5" style={{ maxWidth: CONTENT_W + 60 }}>
                  {hayAnterior ? (
                    <Link
                      href={`/brito/mapa?seccion=${secciones[indiceActivo - 1].sesion}`}
                      className="flex items-center gap-1 rounded-full bg-white border border-[#E5E2D6] px-3.5 py-1.5 text-[12px] font-semibold text-[#57564f] transition-all hover:bg-[#F6F4EC] active:translate-y-[3px] active:shadow-none"
                      style={{ boxShadow: '0 3px 0 #E5E2D6' }}
                    >
                      <ChevronLeft className="h-4 w-4" /> Anterior
                    </Link>
                  ) : (
                    <span className="w-[92px]" />
                  )}

                  <span className="text-[13px] font-bold text-[#2f2e29]">
                    Sección {seccionActiva.sesion} de {secciones.length}
                  </span>

                  {siguienteDesbloqueada ? (
                    <Link
                      href={`/brito/mapa?seccion=${secciones[indiceActivo + 1].sesion}`}
                      className="flex items-center gap-1 rounded-full bg-white border border-[#E5E2D6] px-3.5 py-1.5 text-[12px] font-semibold text-[#57564f] transition-all hover:bg-[#F6F4EC] active:translate-y-[3px] active:shadow-none"
                      style={{ boxShadow: '0 3px 0 #E5E2D6' }}
                    >
                      Siguiente <ChevronRight className="h-4 w-4" />
                    </Link>
                  ) : haySiguiente ? (
                    <span
                      title="Completa esta sección para desbloquear la siguiente"
                      className="flex cursor-default items-center gap-1 rounded-full bg-[#F1EFE5] border border-[#E5E2D6] px-3.5 py-1.5 text-[12px] font-semibold text-[#a3a196]"
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
                <Image src="/brito/brito-mascota.png" alt="Brito" width={96} height={96} className="w-24 h-24 object-contain" />
                <div>
                  <p className="text-[#2B2B28] font-bold text-sm">Brito está preparando tus lecciones</p>
                  <p className="text-[#6b6a63] text-xs mt-1 max-w-[240px]">Todavía no hay lecciones publicadas. Vuelve pronto para empezar a practicar.</p>
                </div>
              </div>
            ) : (
              <div className="relative mx-auto py-4" style={{ width: CONTENT_W, height: totalHeight }}>
                {/* Garabatos del cuaderno */}
                {doodles.map((d, i) => (
                  <div
                    key={i}
                    aria-hidden
                    className="absolute pointer-events-none"
                    style={{ top: d.top, [d.lado]: -8, transform: `rotate(${d.rot}deg)`, color: 'rgba(87,86,79,0.14)' }}
                  >
                    {d.tipo === 'formula' ? (
                      <span className="italic font-medium text-base" style={{ color: 'rgba(87,86,79,0.18)' }}>a² + b² = c²</span>
                    ) : d.tipo === 'cohete' ? (
                      <Rocket className="w-10 h-10" />
                    ) : d.tipo === 'libro' ? (
                      <BookOpen className="w-10 h-10" />
                    ) : (
                      <Orbit className="w-10 h-10" />
                    )}
                  </div>
                ))}

                {/* Sendero: trazo de lápiz con eco */}
                <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none">
                  {rutas.map((d, i) => (
                    <g key={i}>
                      <path d={d} fill="none" stroke="#8f8d82" strokeWidth={3} strokeLinecap="round" opacity={0.55} />
                      <path d={d} fill="none" stroke="#8f8d82" strokeWidth={1.5} strokeLinecap="round" opacity={0.3} transform="translate(1.5,1.5)" />
                    </g>
                  ))}
                </svg>

                {bloques.map(bloque => (
                  <div key={bloque.sesion}>
                    {/* Banner adhesivo: nota pegada con cintas en la hoja */}
                    <div
                      className="absolute left-1/2 rounded-[14px] px-6 py-5"
                      style={{
                        top: bloque.headerTop + 14,
                        transform: 'translateX(-50%) rotate(-1deg)',
                        width: 'min(480px, 90vw)',
                        background: bloque.color.de,
                        boxShadow: `0 6px 16px ${bloque.color.halo}`,
                      }}
                    >
                      <div className="absolute rounded-[2px]" style={{ top: -12, left: 22, width: 64, height: 22, background: 'rgba(255,255,255,0.45)', transform: 'rotate(-5deg)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }} />
                      <div className="absolute rounded-[2px]" style={{ top: -12, right: 22, width: 64, height: 22, background: 'rgba(255,255,255,0.45)', transform: 'rotate(4deg)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }} />

                      <span className="inline-block rounded-full px-3 py-[3px] text-[12px] font-semibold text-white" style={{ background: 'rgba(255,255,255,0.2)' }}>
                        Sección {bloque.sesion}
                      </span>
                      <div className="mt-1.5 text-[21px] font-bold leading-tight text-white">
                        Practica todas las materias
                      </div>
                      <div className="mt-3.5 flex items-center gap-3">
                        <div className="h-3 flex-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.25)' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.round((bloque.hechas / bloque.totalNodos) * 100)}%`, background: '#F5A623' }}
                          />
                        </div>
                        <span className="shrink-0 text-[13px] font-bold text-white">
                          {bloque.hechas}/{bloque.totalNodos}
                        </span>
                      </div>
                    </div>

                    {bloque.nodos.map(nodo => {
                      const info = MATERIA_INFO[nodo.materia]
                      const subjectColor = nodo.esRepaso ? '#1E5FA8' : info?.color ?? '#1E5FA8'
                      const anillo =
                        nodo.status === 'completed' ? '#22C56E'
                        : nodo.status === 'current' ? '#F5A623'
                        : '#E7E4D8'
                      // El anillo de la lección activa muestra el avance de la sección:
                      // una lección está hecha o no, así que el arco parcial que
                      // anticipa "cuánto falta" es el de la sección completa.
                      const dash =
                        nodo.status === 'completed' ? CIRC
                        : nodo.status === 'current' ? Math.max(0.06, bloque.hechas / bloque.totalNodos) * CIRC
                        : 0
                      const circulo = (
                        <div
                          className={`relative transition-transform ${nodo.status !== 'locked' ? 'hover:translate-y-[3px] cursor-pointer' : ''} ${nodo.status === 'current' ? 'brito-halo' : ''}`}
                          style={{ width: NODE, height: NODE, borderRadius: '50%' }}
                        >
                          <svg width={NODE} height={NODE} style={{ transform: 'rotate(-90deg)' }}>
                            <circle cx={NODE / 2} cy={NODE / 2} r={RING_R} fill="none" stroke="#E7E4D8" strokeWidth={6} />
                            <circle
                              cx={NODE / 2} cy={NODE / 2} r={RING_R} fill="none"
                              stroke={anillo} strokeWidth={6} strokeLinecap="round"
                              strokeDasharray={`${dash} 500`}
                            />
                          </svg>
                          <div
                            className="absolute flex items-center justify-center rounded-full"
                            style={{
                              top: 12, left: 12, width: NODE - 24, height: NODE - 24,
                              background:
                                nodo.status === 'completed' ? '#22C56E'
                                : nodo.status === 'current' ? '#F5A623'
                                : '#FAF8F0',
                              boxShadow: nodo.status === 'locked' ? 'inset 0 0 0 1px #E7E4D8' : '0 3px 0 rgba(0,0,0,0.12)',
                            }}
                          >
                            {nodo.status === 'locked' ? (
                              <Lock className="w-[22px] h-[22px] text-[#b3b1a5]" />
                            ) : nodo.esRepaso ? (
                              <img src="/brito/icons/repaso.png" alt="" className="w-10 h-10 object-contain" />
                            ) : (
                              <img src={info?.icono} alt="" className="w-10 h-10 object-contain" />
                            )}
                          </div>
                        </div>
                      )
                      return (
                        <div key={nodo.id} className="absolute" style={{ top: nodo.top, left: nodo.left, width: NODE, height: NODE }}>
                          {nodo.status === 'current' && (
                            <div className="absolute" style={{ top: -42, left: '50%', transform: 'translateX(-50%)' }}>
                              <div
                                className="relative whitespace-nowrap text-white font-bold text-[13px] px-4 py-[7px] rounded-full"
                                style={{ background: '#F5A623', boxShadow: '0 4px 0 #C97E1E' }}
                              >
                                Empezar
                                <div className="absolute" style={{ bottom: -4, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 9, height: 9, background: '#F5A623' }} />
                              </div>
                            </div>
                          )}

                          {nodo.esRepaso || nodo.status === 'locked' ? (
                            circulo
                          ) : (
                            <Link href={`/brito/leccion/${nodo.id}`}>{circulo}</Link>
                          )}

                          {nodo.status === 'completed' && nodo.estrellas !== undefined && (
                            <div className="absolute flex justify-center gap-[3px]" style={{ top: NODE + 2, left: 0, width: NODE }}>
                              {[0, 1, 2].map(k => (
                                <Star
                                  key={k}
                                  className="w-[17px] h-[17px]"
                                  fill={k < nodo.estrellas! ? '#F0B429' : 'none'}
                                  color={k < nodo.estrellas! ? '#F0B429' : '#D8D5C8'}
                                />
                              ))}
                            </div>
                          )}

                          <div
                            className="absolute bg-white rounded-xl px-3 py-2 border border-[#E5E2D6]"
                            style={{
                              top: NODE / 2,
                              transform: 'translateY(-50%)',
                              width: CARD_W,
                              textAlign: nodo.cardSide === 'left' ? 'right' : 'left',
                              ...(nodo.cardSide === 'left' ? { right: NODE + 16 } : { left: NODE + 16 }),
                            }}
                          >
                            <div className="font-bold text-[13px]" style={{ color: subjectColor }}>{nodo.materia}</div>
                            <div className="text-[11px] text-[#8b8a80] mt-0.5">{nodo.titulo}</div>
                          </div>
                        </div>
                      )
                    })}

                    {/* Cofre al final de la sección */}
                    <div
                      className="absolute flex flex-col items-center gap-2"
                      style={{ top: bloque.chestTop, left: '50%', transform: 'translateX(-50%)' }}
                    >
                      <div
                        className="flex items-center justify-center rounded-full transition-transform hover:translate-y-[3px]"
                        style={{
                          width: 92, height: 92,
                          background: bloque.completa ? '#FDEBC8' : '#FDF3DF',
                          border: '3px solid #F5A623',
                          boxShadow: '0 5px 0 #E0C68E',
                          filter: bloque.completa ? 'none' : 'saturate(0.75)',
                        }}
                      >
                        <img src="/brito/icons/regalo.png" alt="" className="w-12 h-12 object-contain" />
                      </div>
                      <div className="bg-white border border-[#E5E2D6] rounded-[10px] px-3.5 py-1 text-[12px] font-semibold text-[#57564f] whitespace-nowrap">
                        {bloque.completa ? '¡Sección completada!' : 'Termina la sección'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panel lateral — solo desktop */}
        <aside className="hidden lg:flex flex-col gap-4 bg-white border-l border-[#ECE9DF] p-6">
          <div className="rounded-2xl p-4 flex flex-col gap-3.5" style={{ background: '#EAF1FA' }}>
            <div className="flex items-center gap-3">
              <img src="/brito/icons/racha.png" alt="" className="w-8 h-8 object-contain" />
              <div>
                <div className="font-bold text-base text-[#2f2e29]">{perfil.rachaActual} días</div>
                <div className="text-[11px] text-[#8b8a80] font-medium">Racha actual</div>
              </div>
            </div>
            <div className="h-px bg-[#D9E3F0]" />
            <div className="flex items-center gap-3">
              <img src="/brito/icons/vidas.png" alt="" className="w-8 h-8 object-contain" />
              <div>
                <div className="font-bold text-base text-[#2f2e29]">{perfil.plan === 'PREMIUM' ? '∞' : perfil.corazones} vidas</div>
                <div className="text-[11px] text-[#8b8a80] font-medium">Te quedan</div>
              </div>
            </div>
            <div className="h-px bg-[#D9E3F0]" />
            <div className="flex items-center gap-3">
              <img src="/brito/icons/xp.png" alt="" className="w-8 h-8 object-contain" />
              <div>
                <div className="font-bold text-base text-[#2f2e29]">{perfil.xpTotal} XP</div>
                <div className="text-[11px] text-[#8b8a80] font-medium">Experiencia total</div>
              </div>
            </div>
          </div>

          <RankingModal estado={estadoLiga} miId={estudianteId} />
        </aside>
      </div>

      <style>{`
        @keyframes britoHalo {
          0%, 100% { box-shadow: 0 0 0 6px rgba(245,166,35,0.18); }
          50% { box-shadow: 0 0 0 14px rgba(245,166,35,0.06); }
        }
        .brito-halo { animation: britoHalo 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .brito-halo { animation: none; }
        }
      `}</style>
    </main>
  )
}
