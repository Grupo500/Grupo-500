import { UserX } from 'lucide-react'
import { SignOutButton } from '@clerk/nextjs'

export default function NoAutorizadoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm text-center space-y-5">

        {/* Icono */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center"
               style={{ background: 'var(--error-container)' }}>
            <UserX className="w-7 h-7" style={{ color: 'var(--error)' }} />
          </div>
        </div>

        {/* Texto */}
        <div className="space-y-1.5">
          <h1 className="text-[18px] font-bold text-on-surface">Acceso no autorizado</h1>
          <p className="text-[13px] text-on-surface-variant leading-relaxed">
            Tu cuenta no está registrada en el sistema de{' '}
            <strong className="text-on-surface font-semibold">Grupo 500</strong>.
            Contacta al administrador para solicitar acceso.
          </p>
        </div>

        {/* Acción */}
        <SignOutButton redirectUrl="/sign-in">
          <button className="btn-ghost mx-auto text-[13px]">
            Cerrar sesión
          </button>
        </SignOutButton>

      </div>
    </div>
  )
}
