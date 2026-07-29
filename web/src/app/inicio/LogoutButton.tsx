'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/sign-in' })}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium text-[#475569] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-all duration-200 border border-[#e2e8f0] hover:border-[#cbd5e1] cursor-pointer"
    >
      <LogOut className="w-4 h-4" />
      Cerrar sesión
    </button>
  )
}
