import { UserX } from 'lucide-react'
import { SignOutButton } from '@clerk/nextjs'

export default function NoAutorizadoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md text-center space-y-6">

        {/* Icono de error */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-[var(--error)]/10 border border-[var(--error)]/20 flex items-center justify-center">
            <UserX className="w-8 h-8 text-[var(--error)]" />
          </div>
        </div>

        {/* Mensaje */}
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-on-surface">Acceso no autorizado</h1>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Tu cuenta no está registrada en el sistema de <strong className="text-on-surface">Grupo 500</strong>.
            Contacta al administrador para solicitar acceso.
          </p>
        </div>

        {/* Cerrar sesión */}
        <SignOutButton redirectUrl="/sign-in">
          <button className="btn-primary mx-auto">
            Cerrar sesión
          </button>
        </SignOutButton>

      </div>
    </div>
  )
}
