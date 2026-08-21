import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { Wallet, ClipboardList, Lock, ArrowRight, Gamepad2, Landmark, Megaphone, ShieldCheck } from 'lucide-react'
import { LogoutButton } from './LogoutButton'
import { esMarketing, type Rol } from '@/lib/roles'
import { primerNombre } from '@/lib/utils'

/** Fecha de hoy en Colombia, con el día y el mes capitalizados. */
function fechaDeHoy(): string {
  const texto = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota',
  }).format(new Date())
  // "miércoles, 29 de julio" → "Miércoles, 29 de julio"
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

const numero = (n: number) => n.toLocaleString('es-CO')

/** Cifras del encabezado de Ventas, acotadas al asesor cuando aplica. */
async function cifrasDeVentas(userId: string, esAdmin: boolean) {
  const asesor = esAdmin ? null : await prisma.asesor.findUnique({ where: { userId }, select: { id: true } })
  // Un vendedor sin ficha de asesor no tiene ventas que mostrar.
  if (!esAdmin && !asesor) return null

  const alcance = asesor ? { asesorId: asesor.id } : {}
  const hoy = new Date()
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)

  const [estudiantes, ventas, cobrado] = await Promise.all([
    prisma.estudiante.count({ where: asesor ? { asesorId: asesor.id } : {} }),
    prisma.pago.count({
      where: {
        ...alcance, estado: 'PAGADO', fechaPago: { gte: inicioMes },
        // Una cuota posterior no es una venta nueva: la venta ya se contó el
        // mes en que se originó.
        OR: [{ cuotaNumero: null }, { cuotaNumero: { lte: 1 } }],
      },
    }),
    prisma.pago.aggregate({
      where: { ...alcance, estado: 'PAGADO', fechaPago: { gte: inicioMes } },
      _sum: { monto: true },
    }),
  ])

  const millones = Math.round((cobrado._sum.monto ?? 0) / 1_000_000)

  return [
    { etiqueta: 'Estudiantes', valor: numero(estudiantes) },
    { etiqueta: 'Ventas del mes', valor: numero(ventas) },
    { etiqueta: 'Cobrado este mes', valor: `$${numero(millones)} millones` },
  ]
}

export default async function InicioPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const role = ((session.user as any).role ?? 'VENDEDOR') as Rol

  const nombre = primerNombre(session.user.name ?? session.user.email?.split('@')[0])

  const verVentas     = role === 'ADMIN' || role === 'VENDEDOR'
  const verSimulacros = role === 'ADMIN' || role === 'ESTUDIANTE'
  const verBrito      = true
  // Finanzas es una vista de dirección: no se segmenta por asesor.
  const verFinanzas   = role === 'ADMIN'
  const verAdmin      = role === 'ADMIN'
  const verMarketing  = role === 'ADMIN' || esMarketing(role)

  const cifras = verVentas ? await cifrasDeVentas((session.user as any).id ?? '', role === 'ADMIN') : null

  // El módulo destacado es el que la persona usa a diario. Para el estudiante
  // no es Ventas —no lo ve— sino sus simulacros.
  const destacado = verVentas
    ? {
        href: '/dashboard', titulo: 'Ventas', icono: Wallet,
        de: '#2094ff', a: '#4361ee',
        texto: 'Estudiantes, pagos, cuotas, asesores, colegios y certificados.',
        accion: 'Entrar a Ventas',
      }
    : verSimulacros
    ? {
        href: '/examenes', titulo: 'Simulacros', icono: ClipboardList,
        de: '#6d28d9', a: '#8b5cf6',
        texto: 'Exámenes tipo Saber 11 en dos sesiones, con calificación automática y resultados por área.',
        accion: 'Entrar a Simulacros',
      }
    : verMarketing
    ? {
        href: '/marketing', titulo: 'Marketing', icono: Megaphone,
        de: '#be185d', a: '#ec4899',
        texto: 'Calendario de contenido, cobros y entregables publicados por el equipo.',
        accion: 'Entrar a Marketing',
      }
    : null

  const secundarios = [
    verSimulacros && {
      href: '/examenes', titulo: 'Simulacros', icono: ClipboardList,
      // Violeta y no azul: el azul es de Ventas, y dos módulos del mismo color
      // en la misma rejilla se leen como el mismo sitio.
      de: '#6d28d9', a: '#8b5cf6', borde: '#8b5cf6',
      texto: 'Exámenes tipo Saber 11 con calificación automática.',
    },
    verBrito && {
      href: '/brito', titulo: 'Brito', icono: Gamepad2,
      de: '#ffb703', a: '#fb8500', borde: '#fb8500',
      texto: 'Practica en modo juego: racha, XP y ligas.',
    },
    verAdmin && {
      href: '/admin', titulo: 'Administración', icono: ShieldCheck,
      // El azul marino del header y el sidebar: es el color del chrome de la
      // app, y administración es justo eso — la app por dentro, no un área de
      // trabajo con identidad propia como Ventas o Marketing.
      de: '#15203a', a: '#2a3a5e', borde: '#2a3a5e',
      texto: 'Resumen de todas las áreas, usuarios y accesos.',
    },
    verFinanzas && {
      href: '/finanzas', titulo: 'Finanzas', icono: Landmark,
      de: '#0f766e', a: '#14b8a6', borde: '#14b8a6',
      texto: 'Ritmo de ventas, mix comercial y cierre mensual.',
    },
    verMarketing && {
      href: '/marketing', titulo: 'Marketing', icono: Megaphone,
      // Magenta y no ámbar: el ámbar es de Brito, y además en el resto de la
      // app significa "pendiente" (cuotas, cobros, alertas).
      de: '#be185d', a: '#ec4899', borde: '#ec4899',
      texto: 'Calendario de contenido, cobros y entregables del equipo.',
    },
  ].filter(Boolean).filter(m => (m as { href: string }).href !== destacado?.href) as {
    href: string; titulo: string; icono: typeof Wallet
    de: string; a: string; borde: string; texto: string
  }[]

  const totalModulos = (destacado ? 1 : 0) + secundarios.length

  return (
    <main className="min-h-dvh bg-[#f7f9fb] relative overflow-hidden">
      {/* Franja diagonal apenas perceptible: da textura sin competir con el contenido */}
      <div
        className="absolute top-0 right-0 w-[60vw] h-[60vw] pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, transparent 40%, rgba(100,116,139,0.05) 40%, rgba(100,116,139,0.05) 55%, transparent 55%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 max-w-[1080px] mx-auto px-5 sm:px-8 py-6 sm:py-8">

        {/* ── Encabezado ─────────────────────────────────────────────── */}
        <header className="flex items-center justify-between gap-4 mb-10 sm:mb-14">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo-grupo500.png" alt="Grupo 500" width={40} height={40}
              className="w-10 h-10 rounded-full object-cover" priority
            />
            <div className="leading-none">
              <p className="text-[14px] font-bold text-[#0f172a] tracking-tight">Grupo 500</p>
              <p className="text-[10.5px] text-[#94a3b8] mt-0.5 font-medium">Pre-ICFES</p>
            </div>
          </div>

          {/* Sin campana ni actualizar: esta pantalla no monta QueryProvider
              —no es del layout de ningún área— y esos botones lo necesitan.
              Tampoco hace falta la casita: ya se está en inicio. */}
          <div className="flex items-center gap-4">
            <span className="hidden sm:block text-[13px] text-[#64748b]">{fechaDeHoy()}</span>
            <LogoutButton />
          </div>
        </header>

        {/* ── Saludo ─────────────────────────────────────────────────── */}
        <div className="mb-7 animate-card-enter">
          <h1 className="text-[32px] sm:text-[44px] font-bold text-[#0f172a] tracking-tight leading-none">
            Hola, {nombre}
          </h1>
          <p className="text-[14px] sm:text-[15px] text-[#64748b] mt-2">
            {totalModulos === 1
              ? 'Un módulo disponible.'
              : `${totalModulos} módulos disponibles. Elige por dónde empezar.`}
          </p>
        </div>

        {/* ── Módulo destacado ───────────────────────────────────────── */}
        {destacado && (
          <Link
            href={destacado.href}
            className="group block bg-white rounded-[20px] border border-[#e2e8f0] p-5 sm:p-6 mb-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2094ff] hover:shadow-[0_8px_24px_-8px_rgba(32,148,255,0.25)] animate-card-enter"
            style={{ animationDelay: '0.06s' }}
          >
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center shrink-0"
                    style={{ background: `linear-gradient(135deg, ${destacado.de}, ${destacado.a})` }}
                  >
                    <destacado.icono className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[20px] sm:text-[22px] font-bold text-[#0f172a] leading-tight">{destacado.titulo}</p>
                    <p className="text-[13px] sm:text-[14px] text-[#64748b] mt-0.5">{destacado.texto}</p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 bg-[#1a7de0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors group-hover:bg-[#1668bd]">
                  {destacado.accion}
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>

              {/* Las cifras convierten la portada en algo que se consulta, no
                  solo un menú: al entrar ya se sabe cómo va el mes. */}
              {cifras && (
                <div className="flex lg:flex-col gap-4 lg:gap-0 lg:w-[210px] lg:border-l lg:border-[#e2e8f0] lg:pl-6 shrink-0">
                  {cifras.map((c, i) => (
                    <div
                      key={c.etiqueta}
                      className={`flex-1 lg:flex-none ${i > 0 ? 'lg:border-t lg:border-[#e2e8f0] lg:pt-3 lg:mt-3' : ''}`}
                    >
                      <p className="text-[11px] text-[#94a3b8] leading-tight">{c.etiqueta}</p>
                      <p className="text-[17px] font-semibold text-[#0f172a] tabular-nums mt-0.5">{c.valor}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Link>
        )}

        {/* ── Módulos secundarios ────────────────────────────────────── */}
        {secundarios.length > 0 && (
          <div className={`grid gap-4 ${
            secundarios.length >= 3 ? 'sm:grid-cols-3'
            : secundarios.length === 2 ? 'sm:grid-cols-2'
            : 'grid-cols-1'
          }`}>
            {secundarios.map((m, i) => (
              <Link
                key={m.href}
                href={m.href}
                className="group bg-white rounded-[20px] border border-[#e2e8f0] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--borde)] animate-card-enter"
                style={{
                  animationDelay: `${0.12 + i * 0.06}s`,
                  // El color del borde en hover se resuelve con una variable para
                  // no generar una clase de Tailwind por módulo.
                  ['--borde' as string]: m.borde,
                }}
              >
                <div
                  className="w-11 h-11 rounded-[13px] flex items-center justify-center mb-3.5"
                  style={{ background: `linear-gradient(135deg, ${m.de}, ${m.a})` }}
                >
                  <m.icono className="w-5 h-5 text-white" />
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-[16px] font-semibold text-[#0f172a]">{m.titulo}</p>
                  <ArrowRight className="w-3.5 h-3.5 text-[#94a3b8] transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[12.5px] text-[#64748b] leading-relaxed">{m.texto}</p>
              </Link>
            ))}
          </div>
        )}

        {/* ── Nota de acceso ─────────────────────────────────────────── */}
        <p className="flex items-center gap-1.5 text-[11.5px] text-[#94a3b8] mt-7 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <Lock className="w-3 h-3 shrink-0" />
          Cada quien ve solo los módulos a los que tiene acceso.
        </p>
      </div>
    </main>
  )
}
