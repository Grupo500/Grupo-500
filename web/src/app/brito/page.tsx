import Image from 'next/image'
import Link from 'next/link'
import { auth } from '@/auth'
import { ArrowLeft } from 'lucide-react'
import { BotonJugar } from './BotonJugar'

/** Destino del juego. Es lo que decide si el botón lleva la transición. */
const MAPA = '/brito/mapa'

export const metadata = {
  title: 'Brito — Con Brito te vas a convertir en cerebrito',
  description: 'Practica ICFES en modo juego: lecciones cortas, racha, corazones y ranking.',
}

/** Lo que hace distinto a Brito, con los mismos íconos que se ven jugando. */
const GANCHOS = [
  { icono: '/brito/icons/racha.png',  titulo: 'Racha diaria',  texto: 'Un poco cada día suma más que un maratón el domingo.' },
  { icono: '/brito/icons/vidas.png',  titulo: 'Corazones',     texto: 'Fallar cuesta, así que se piensa antes de responder.' },
  { icono: '/brito/icons/trofeo.png', titulo: 'Ligas',         texto: 'Compites con estudiantes de tu mismo nivel, no contra todos.' },
]

/**
 * Botón grueso con relieve, igual al del juego: el borde inferior más oscuro
 * hace de sombra y desaparece al presionar, así el clic se siente físico.
 */
function BotonPrincipal({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block w-full text-center rounded-2xl py-3.5 text-[15px] font-extrabold text-white transition-all active:translate-y-[3px] active:shadow-none"
      style={{
        background: 'linear-gradient(180deg, #F5A623 0%, #E8940D 100%)',
        boxShadow: '0 4px 0 #C97E1E',
      }}
    >
      {children}
    </Link>
  )
}

function BotonSecundario({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block w-full text-center rounded-2xl py-3.5 text-[15px] font-bold text-[#2B2B28] bg-white border-2 border-[#E3E0D6] transition-all hover:bg-[#FAF9F5] active:translate-y-[2px] active:shadow-none"
      style={{ boxShadow: '0 3px 0 #E3E0D6' }}
    >
      {children}
    </Link>
  )
}

export default async function BritoLandingPage() {
  const session = await auth()
  const role = (session?.user as any)?.role as 'ADMIN' | 'VENDEDOR' | 'ESTUDIANTE' | undefined

  // Cada quien llega con una intención distinta: el estudiante a seguir donde
  // quedó, el admin a administrar, y quien no tiene cuenta a crearla.
  const acciones =
    role === 'ESTUDIANTE'
      ? { principal: { href: MAPA, texto: 'Continuar mis lecciones' }, secundaria: null }
      : role === 'ADMIN'
      ? { principal: { href: '/brito-admin', texto: 'Administrar el juego' }, secundaria: { href: MAPA, texto: 'Entrar a jugar' } }
      : { principal: { href: '/brito/registro', texto: 'Crear cuenta gratis' }, secundaria: { href: '/sign-in', texto: 'Ya tengo cuenta' } }

  return (
    <main className="min-h-dvh relative overflow-hidden bg-[#F7F5EF]">
      {/* Manchas suaves en los colores del juego. Dan calidez sin robarle
          protagonismo a la mascota, que es lo único que debe destacar. */}
      <div className="absolute -top-32 -left-24 w-[420px] h-[420px] rounded-full bg-[#F5A623]/12 blur-3xl pointer-events-none" aria-hidden />
      <div className="absolute -bottom-40 -right-28 w-[480px] h-[480px] rounded-full bg-[#1E5FA8]/10 blur-3xl pointer-events-none" aria-hidden />

      <Link
        href="/inicio"
        className="absolute top-4 left-4 z-20 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/85 backdrop-blur border border-[#E3E0D6] text-[13px] font-bold text-[#57564f] hover:text-[#2B2B28] hover:bg-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </Link>

      <div className="relative z-10 min-h-dvh flex flex-col items-center justify-center px-5 py-14">
        <div className="w-full max-w-[440px] flex flex-col items-center text-center">

          {/* ── Mascota ──────────────────────────────────────────────────── */}
          {/* Ilustración con fondo transparente y sin recorte circular: la
              versión anterior traía un disco blanco pintado dentro del archivo,
              que era el "marco" que la hacía ver como foto de perfil. */}
          <div className="relative animate-card-enter">
            <div className="absolute inset-x-10 bottom-3 h-4 rounded-full bg-[#2B2B28]/12 blur-xl" aria-hidden />
            <Image
              src="/brito/brito-mascota.png"
              alt="Brito, la mascota"
              width={220} height={220}
              className="relative w-[185px] h-[185px] sm:w-[220px] sm:h-[220px] object-contain"
              priority
            />
          </div>

          <h1 className="text-[42px] sm:text-[52px] font-extrabold text-[#1E5FA8] leading-none tracking-tight mt-5 animate-card-enter" style={{ animationDelay: '0.05s' }}>
            Brito
          </h1>
          <p className="text-[15px] font-bold text-[#57564f] mt-2 animate-card-enter" style={{ animationDelay: '0.1s' }}>
            Con Brito te vas a convertir en cerebrito
          </p>
          <p className="text-[14px] text-[#7a7970] mt-3 leading-relaxed max-w-[380px] animate-card-enter" style={{ animationDelay: '0.15s' }}>
            Practica para el ICFES con lecciones cortas. Cinco minutos al día rinden más que
            una tarde entera la semana del examen.
          </p>

          {/* ── Qué lo hace distinto ─────────────────────────────────────── */}
          <div className="w-full flex flex-col gap-2 mt-7">
            {GANCHOS.map((g, i) => (
              <div
                key={g.titulo}
                className="flex items-center gap-3.5 bg-white rounded-2xl border border-[#ECEAE2] px-4 py-3 text-left animate-card-enter"
                style={{ animationDelay: `${0.2 + i * 0.06}s` }}
              >
                <img src={g.icono} alt="" className="w-9 h-9 object-contain shrink-0" />
                <div className="min-w-0">
                  <p className="text-[14px] font-extrabold text-[#2B2B28] leading-tight">{g.titulo}</p>
                  <p className="text-[12.5px] text-[#7a7970] leading-snug mt-0.5">{g.texto}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Acciones ─────────────────────────────────────────────────── */}
          {/* La transición del sendero solo tiene sentido cuando el destino es
              el mapa: entrar al panel de administración no es "empezar a
              jugar". Por eso se decide por el destino y no por la jerarquía
              del botón. */}
          <div className="w-full flex flex-col gap-2.5 mt-7 animate-card-enter" style={{ animationDelay: '0.4s' }}>
            {acciones.principal.href === MAPA ? (
              <BotonJugar href={MAPA}>{acciones.principal.texto}</BotonJugar>
            ) : (
              <BotonPrincipal href={acciones.principal.href}>{acciones.principal.texto}</BotonPrincipal>
            )}

            {acciones.secundaria && (
              acciones.secundaria.href === MAPA ? (
                <BotonJugar href={MAPA} variante="secundario">{acciones.secundaria.texto}</BotonJugar>
              ) : (
                <BotonSecundario href={acciones.secundaria.href}>{acciones.secundaria.texto}</BotonSecundario>
              )
            )}
          </div>

          {!role && (
            <p className="text-[12px] text-[#9a998f] mt-4 animate-fade-in" style={{ animationDelay: '0.5s' }}>
              Gratis, sin tarjeta. Solo tu nombre y tu correo.
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
