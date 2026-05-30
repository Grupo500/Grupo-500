import Link from 'next/link'
import { Poppins } from 'next/font/google'
import {
  BookOpen, Clock, Users, Trophy, ChevronRight,
  MessageCircle, Star, CheckCircle, Target, Brain, Zap,
} from 'lucide-react'

const poppins = Poppins({ subsets: ['latin'], weight: ['400', '600', '700', '800'] })

// ── Server component: carga calendarios activos ───────────────────────────────
async function getCalendariosActivos() {
  const API = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:3001/api'
  try {
    const res = await fetch(`${API}/inscripcion/calendarios-activos`, {
      next: { revalidate: 60 }, // revalidar cada minuto
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.success ? data.data : []
  } catch {
    return []
  }
}

// ── Componentes ───────────────────────────────────────────────────────────────
function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center p-4 bg-white/15 rounded-2xl backdrop-blur-sm">
      <span className={`${poppins.className} text-white font-bold text-2xl`}>{value}</span>
      <span className="text-white/70 text-xs text-center mt-0.5">{label}</span>
    </div>
  )
}

function BeneficioCard({ icon: Icon, titulo, descripcion }: {
  icon: React.ElementType; titulo: string; descripcion: string
}) {
  return (
    <div className="flex items-start gap-4 p-5 bg-white rounded-2xl shadow-sm border border-slate-100">
      <div className="w-11 h-11 rounded-xl bg-[#21b9f7]/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-[#1a7de0]" />
      </div>
      <div>
        <p className={`${poppins.className} text-slate-800 font-semibold text-sm mb-1`}>{titulo}</p>
        <p className="text-slate-500 text-xs leading-relaxed">{descripcion}</p>
      </div>
    </div>
  )
}

function TestimonioCard({ nombre, puntaje, texto, universidad }: {
  nombre: string; puntaje: number; texto: string; universidad: string
}) {
  return (
    <div className="shrink-0 w-72 p-5 bg-white rounded-3xl shadow-lg">
      <div className="flex items-center gap-1 mb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
        ))}
      </div>
      <p className="text-slate-600 text-sm leading-relaxed mb-4">"{texto}"</p>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#21b9f7] to-[#1a7de0] flex items-center justify-center shrink-0">
          <span className={`${poppins.className} text-white font-bold text-sm`}>
            {nombre.charAt(0)}
          </span>
        </div>
        <div>
          <p className={`${poppins.className} text-slate-800 font-semibold text-sm`}>{nombre}</p>
          <p className="text-[#1a7de0] text-xs font-medium">{puntaje} pts · {universidad}</p>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default async function LandingPage() {
  const calendarios = await getCalendariosActivos()

  return (
    <div className={`${poppins.className} bg-[#F8FAFC] min-h-dvh`}>

      {/* ── Navbar flotante ─────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 pt-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between
          bg-white/80 backdrop-blur-md rounded-2xl px-5 py-3 shadow-lg border border-white/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#21b9f7] to-[#1a7de0] flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="text-slate-800 font-bold text-sm">Grupo 500</span>
          </div>
          <Link
            href="/sign-in"
            className="text-xs font-semibold text-slate-600 hover:text-[#1a7de0] transition-colors px-4 py-2
              rounded-xl border border-slate-200 hover:border-[#21b9f7]/50 hover:bg-blue-50 transition-all"
          >
            Ingresar al panel
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-[#21b9f7] to-[#1a7de0] pt-24 pb-12 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5 mb-5">
            <Zap className="w-3.5 h-3.5 text-white" />
            <span className="text-white text-xs font-semibold">Pre-ICFES · Prueba Saber 11</span>
          </div>
          <h1 className="text-white font-extrabold text-4xl leading-tight mb-4">
            Llega a los<br />
            <span className="text-white/90">500 puntos</span>
          </h1>
          <p className="text-white/80 text-base leading-relaxed mb-8">
            El curso de preparación para el ICFES más completo de Santander.
            Simulacros reales, clases en vivo y acompañamiento personalizado.
          </p>
          <Link
            href="/inscripcion"
            className="inline-flex items-center gap-2 bg-[#F97316] text-white font-bold text-base
              px-8 py-4 rounded-2xl shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all"
          >
            ¡Quiero inscribirme!
            <ChevronRight className="w-5 h-5" />
          </Link>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-10">
            <StatCard value="14.701+" label="Estudiantes inscritos" />
            <StatCard value="500"     label="Puntaje máximo ICFES" />
            <StatCard value="5★"      label="Calificación promedio" />
          </div>
        </div>
      </section>

      {/* ── Beneficios ────────────────────────────────────────────────────────── */}
      <section className="px-5 py-10 max-w-2xl mx-auto">
        <h2 className="text-slate-800 font-bold text-xl text-center mb-6">
          ¿Qué incluye el curso?
        </h2>
        <div className="space-y-3">
          <BeneficioCard
            icon={BookOpen}
            titulo="Simulacros reales del ICFES"
            descripcion="Practica con pruebas diseñadas con el mismo formato y dificultad del examen oficial."
          />
          <BeneficioCard
            icon={Clock}
            titulo="Clases en vivo por WhatsApp"
            descripcion="Accede a clases grabadas y sesiones en vivo con nuestros tutores especializados."
          />
          <BeneficioCard
            icon={Target}
            titulo="Análisis de tu rendimiento"
            descripcion="Identifica tus áreas débiles y trabaja en ellas con material personalizado."
          />
          <BeneficioCard
            icon={Users}
            titulo="Grupo de apoyo exclusivo"
            descripcion="Únete al grupo de WhatsApp con todos tus compañeros y resuelve dudas en tiempo real."
          />
          <BeneficioCard
            icon={Trophy}
            titulo="Certificado de finalización"
            descripcion="Al completar el curso recibes tu certificado oficial de Grupo 500."
          />
        </div>
      </section>

      {/* ── Calendarios activos ───────────────────────────────────────────────── */}
      {calendarios.length > 0 && (
        <section className="bg-gradient-to-b from-slate-50 to-white px-5 py-10">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-slate-800 font-bold text-xl text-center mb-2">
              Calendarios disponibles
            </h2>
            <p className="text-slate-500 text-sm text-center mb-6">
              Elige el calendario que más se ajusta a tu prueba
            </p>
            <div className="space-y-4">
              {calendarios.map((cal: any) => (
                <div key={cal.id} className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-[#21b9f7] to-[#1a7de0] px-5 py-3 flex items-center justify-between">
                    <span className="text-white font-bold text-sm">Calendario {cal.calendario}</span>
                    {cal.cuposRestantes != null && cal.cuposRestantes > 0 && (
                      <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        {cal.cuposRestantes} cupos
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="text-slate-800 font-bold text-base mb-3">{cal.nombre}</h3>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <span className="text-xs text-slate-400">Desde</span>
                        <p className="text-[#1a7de0] font-bold text-lg">
                          ${cal.precioGeneral.toLocaleString('es-CO')}
                        </p>
                        {cal.preciosPromo.length > 0 && (
                          <p className="text-emerald-600 text-xs font-medium">
                            Promoción: ${cal.preciosPromo[0].toLocaleString('es-CO')}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-slate-400 text-xs">
                          <Users className="w-3.5 h-3.5" />
                          {cal.inscritos.toLocaleString('es-CO')} inscritos
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/inscripcion/${cal.id}`}
                      className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl
                        bg-[#F97316] text-white font-bold text-sm shadow-md
                        hover:shadow-lg hover:scale-[1.01] transition-all"
                    >
                      Inscribirme en este calendario
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Testimonios ──────────────────────────────────────────────────────── */}
      <section className="py-10 px-5 max-w-2xl mx-auto">
        <h2 className="text-slate-800 font-bold text-xl text-center mb-2">
          Lo que dicen nuestros estudiantes
        </h2>
        <p className="text-slate-500 text-sm text-center mb-6">Resultados reales de estudiantes Grupo 500</p>
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-5 px-5 scrollbar-hide">
          <TestimonioCard
            nombre="Laura Rodríguez"
            puntaje={412}
            texto="Gracias a Grupo 500 pude entrar a Medicina en la UIS. Los simulacros son idénticos al ICFES real."
            universidad="UIS"
          />
          <TestimonioCard
            nombre="Sebastián Mora"
            puntaje={385}
            texto="El acompañamiento es increíble. Pasé de 280 a 385 en 3 meses. Totalmente recomendado."
            universidad="UNAB"
          />
          <TestimonioCard
            nombre="Valentina Castro"
            puntaje={398}
            texto="Las clases grabadas y el grupo de WhatsApp me ayudaron un montón. ¡Gracias Grupo 500!"
            universidad="UNAL"
          />
        </div>
      </section>

      {/* ── CTA Final ────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-[#21b9f7] to-[#1a7de0] mx-4 mb-10 rounded-3xl p-8 text-center shadow-xl">
        <CheckCircle className="w-10 h-10 text-white mx-auto mb-3" />
        <h2 className="text-white font-extrabold text-xl mb-2">
          ¿Listo para lograrlo?
        </h2>
        <p className="text-white/80 text-sm mb-6">
          Únete a los miles de estudiantes que ya confiaron en Grupo 500
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/inscripcion"
            className="inline-flex items-center justify-center gap-2 bg-[#F97316] text-white font-bold
              px-7 py-3.5 rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
          >
            ¡Inscribirme ahora!
            <ChevronRight className="w-4 h-4" />
          </Link>
          <a
            href="https://wa.me/573164134212"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-white/20 text-white font-bold
              px-7 py-3.5 rounded-2xl hover:bg-white/30 transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            Preguntar por WhatsApp
          </a>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 px-5 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#21b9f7] to-[#1a7de0] flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-sm">Grupo 500</span>
        </div>
        <p className="text-slate-500 text-xs mb-2">Pre-ICFES · Prueba Saber 11 · Bucaramanga, Colombia</p>
        <a href="https://wa.me/573164134212" className="text-[#21b9f7] text-xs hover:underline">
          +57 316 413 4212
        </a>
        <p className="text-slate-600 text-xs mt-4">
          Desarrollado por{' '}
          <span className="text-slate-400 font-semibold">NexCode97</span>
        </p>
      </footer>
    </div>
  )
}
