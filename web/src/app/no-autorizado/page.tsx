'use client'

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { UserX, Clock } from 'lucide-react'
import { SignOutButton } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'

function NoAutorizadoContent() {
  const searchParams = useSearchParams()
  const pendiente = searchParams.get('pendiente') === '1'

  return (
    <div className="w-full max-w-sm text-center space-y-5">
      <div className="flex justify-center">
        {pendiente ? (
          <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/20">
            <Clock className="w-7 h-7 text-primary" />
          </div>
        ) : (
          <div className="w-14 h-14 rounded-xl flex items-center justify-center"
               style={{ background: 'var(--error-container)' }}>
            <UserX className="w-7 h-7" style={{ color: 'var(--error)' }} />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {pendiente ? (
          <>
            <h1 className="text-[18px] font-bold text-on-surface">Registro recibido</h1>
            <p className="text-[13px] text-on-surface-variant leading-relaxed">
              Tu cuenta fue creada exitosamente. Un administrador de{' '}
              <strong className="text-on-surface font-semibold">Grupo 500</strong>{' '}
              debe activar tu acceso antes de que puedas ingresar a la plataforma.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-[18px] font-bold text-on-surface">Acceso restringido</h1>
            <p className="text-[13px] text-on-surface-variant leading-relaxed">
              Tu cuenta no está registrada en el sistema de{' '}
              <strong className="text-on-surface font-semibold">Grupo 500</strong>.
              Contacta al administrador para solicitar acceso.
            </p>
          </>
        )}
      </div>

      <SignOutButton redirectUrl="/sign-in">
        <button className="btn-ghost mx-auto text-[13px]">Cerrar sesión</button>
      </SignOutButton>
    </div>
  )
}

export default function NoAutorizadoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <Suspense fallback={<div className="w-14 h-14 rounded-xl bg-surface-low animate-pulse" />}>
        <NoAutorizadoContent />
      </Suspense>
    </div>
  )
}
