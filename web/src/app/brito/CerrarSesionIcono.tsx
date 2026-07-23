'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

export function CerrarSesionIcono() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/sign-in' })}
      title="Cerrar sesión"
      className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
    >
      <LogOut className="w-4 h-4" />
    </button>
  )
}
