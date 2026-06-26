import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Wallet, ClipboardList, Lock, ArrowRight } from 'lucide-react'
import { LogoutButton } from './LogoutButton'

// Launcher: primera pantalla tras iniciar sesión.
// Muestra una tarjeta por módulo, filtradas según el rol del usuario.
export default async function InicioPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const role = ((session.user as any).role ?? 'VENDEDOR') as 'ADMIN' | 'VENDEDOR' | 'ESTUDIANTE'
  const nombre = session.user.name?.split(' ')[0] ?? 'Hola'

  const verVentas     = role === 'ADMIN' || role === 'VENDEDOR'
  const verSimulacros = role === 'ADMIN' || role === 'ESTUDIANTE'

  return (
    <main className="min-h-dvh edu-bg-pattern">
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">

        {/* Encabezado */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Hola, {nombre}</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">Elige un espacio de trabajo</p>
          </div>
          <LogoutButton />
        </div>

        {/* Tarjetas de módulos */}
        <div className="grid sm:grid-cols-2 gap-4">

          {verVentas && (
            <Link
              href="/dashboard"
              className="group bg-surface-lowest border border-outline-variant rounded-2xl p-5 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-primary-container text-secondary flex items-center justify-center">
                  <Wallet className="w-6 h-6" />
                </div>
                <span className="text-lg font-semibold text-on-surface">Ventas</span>
                <ArrowRight className="w-4 h-4 text-on-surface-variant ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Estudiantes, pagos y cuotas, asesores, colegios, certificados y reportes.
              </p>
            </Link>
          )}

          {verSimulacros && (
            <Link
              href="/examenes"
              className="group bg-surface-lowest border border-outline-variant rounded-2xl p-5 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-primary-container text-secondary flex items-center justify-center">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <span className="text-lg font-semibold text-on-surface">Simulacros</span>
                <ArrowRight className="w-4 h-4 text-on-surface-variant ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Exámenes tipo Saber 11 en dos sesiones, calificación automática y resultados por área.
              </p>
            </Link>
          )}

        </div>

        {/* Nota de acceso */}
        <p className="flex items-center gap-2 text-xs text-on-surface-variant mt-6">
          <Lock className="w-3.5 h-3.5" />
          Cada quien ve solo los módulos a los que tiene acceso.
        </p>
      </div>
    </main>
  )
}
