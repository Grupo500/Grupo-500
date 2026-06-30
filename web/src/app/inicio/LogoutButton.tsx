'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/sign-in' })}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200 border border-white/20 hover:border-white/35"
    >
      <LogOut className="w-4 h-4" />
      Cerrar sesión
    </button>
  )
}
