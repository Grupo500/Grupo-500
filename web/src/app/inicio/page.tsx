import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Wallet, ClipboardList, Lock, ArrowRight } from 'lucide-react'
import { LogoutButton } from './LogoutButton'

export default async function InicioPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const role = ((session.user as any).role ?? 'VENDEDOR') as 'ADMIN' | 'VENDEDOR' | 'ESTUDIANTE'

  function primerNombre(nombreCompleto: string): string {
    const partes = nombreCompleto.trim().split(/\s+/)
    if (role !== 'ESTUDIANTE' || partes.length <= 2) return partes[0]
    const nombres = partes.slice(2).filter(p => !p.includes('.') && p.length > 1)
    return nombres.length ? nombres.slice(0, 2).join(' ') : partes[0]
  }
  const nombre = session.user.name ? primerNombre(session.user.name) : 'Hola'

  const verVentas     = role === 'ADMIN' || role === 'VENDEDOR'
  const verSimulacros = role === 'ADMIN' || role === 'ESTUDIANTE'

  return (
    <main
      className="min-h-dvh relative overflow-hidden flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'linear-gradient(160deg, #003060 0%, #2094ff 55%, #21b9f7 100%)' }}
    >
      {/* Halos de fondo */}
      <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-[#635cef]/25 blur-3xl pointer-events-none animate-float-slow" aria-hidden />
      <div className="absolute -bottom-28 -right-16 w-96 h-96 rounded-full bg-[#95daff]/20 blur-3xl pointer-events-none animate-float-slow" style={{ animationDelay: '2s' }} aria-hidden />

      {/* Logout */}
      <div className="absolute top-4 right-4 z-10">
        <LogoutButton />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-6">

        {/* Saludo */}
        <div className="text-center animate-card-enter">
          <p className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
            Hola, {nombre} 👋
          </p>
          <p className="text-sm text-white/75 mt-1 font-medium">¿Qué quieres hacer hoy?</p>
        </div>

        {/* Tarjetas de módulos */}
        <div className={`w-full grid gap-4 ${verVentas && verSimulacros ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>

          {verVentas && (
            <Link
              href="/dashboard"
              className="group bg-white rounded-2xl p-5 shadow-[0_16px_40px_-8px_rgba(0,30,60,0.45)] border border-white/60 hover:-translate-y-1 hover:shadow-[0_24px_48px_-8px_rgba(0,30,60,0.5)] transition-all duration-200 active:scale-[0.98] animate-card-enter"
              style={{ animationDelay: '0.08s' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm" style={{ background: 'linear-gradient(135deg, #2094ff, #4361ee)' }}>
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <span className="text-base font-bold text-[#001d3d]">Ventas</span>
                <ArrowRight className="w-4 h-4 text-[#5a74a8] ml-auto opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
              </div>
              <p className="text-[13px] text-[#2a4172] leading-relaxed">
                Estudiantes, pagos, cuotas, asesores, colegios, certificados y reportes.
              </p>
            </Link>
          )}

          {verSimulacros && (
            <Link
              href="/examenes"
              className="group bg-white rounded-2xl p-5 shadow-[0_16px_40px_-8px_rgba(0,30,60,0.45)] border border-white/60 hover:-translate-y-1 hover:shadow-[0_24px_48px_-8px_rgba(0,30,60,0.5)] transition-all duration-200 active:scale-[0.98] animate-card-enter"
              style={{ animationDelay: '0.16s' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm" style={{ background: 'linear-gradient(135deg, #21b9f7, #2094ff)' }}>
                  <ClipboardList className="w-5 h-5 text-white" />
                </div>
                <span className="text-base font-bold text-[#001d3d]">Simulacros</span>
                <ArrowRight className="w-4 h-4 text-[#5a74a8] ml-auto opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
              </div>
              <p className="text-[13px] text-[#2a4172] leading-relaxed">
                Exámenes tipo Saber 11 en dos sesiones, calificación automática y resultados por área.
              </p>
            </Link>
          )}
        </div>

        {/* Nota de acceso */}
        <p className="flex items-center gap-1.5 text-xs text-white/50 text-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <Lock className="w-3 h-3 flex-shrink-0" />
          Cada quien ve solo los módulos a los que tiene acceso.
        </p>
      </div>
    </main>
  )
}
