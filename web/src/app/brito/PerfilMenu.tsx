'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { signOut } from 'next-auth/react'
import { X, LogOut, Mail } from 'lucide-react'

export function PerfilMenu({
  nombre, email, plan, xpTotal, rachaMejor, imagenUrl, variante = 'avatar',
}: {
  nombre: string
  email: string
  plan: 'FREE' | 'PREMIUM'
  xpTotal: number
  rachaMejor: number
  imagenUrl?: string | null
  variante?: 'avatar' | 'navitem'
}) {
  const [abierto, setAbierto] = useState(false)
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])
  const iniciales = (nombre || '?')
    .split(' ')
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('')

  const modal = abierto && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-[#1e1e19]/40 animate-fade-in" onClick={() => setAbierto(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
          <div className="relative w-full max-w-xs rounded-2xl shadow-2xl animate-slide-up bg-white p-6">
            <button onClick={() => setAbierto(false)} className="absolute top-3.5 right-3.5 text-[#9a998f] hover:text-[#2B2B28] transition-colors">
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center gap-1.5 mb-4">
              <div className="w-[68px] h-[68px] rounded-full overflow-hidden bg-[#1E5FA8] text-white flex items-center justify-center font-extrabold text-2xl">
                {imagenUrl ? <img src={imagenUrl} alt={nombre} className="w-full h-full object-cover" /> : iniciales}
              </div>
              <p className="text-[#2B2B28] font-extrabold text-base mt-1">{nombre}</p>
              <p className="text-[#8a897f] text-xs font-semibold flex items-center gap-1"><Mail className="w-3 h-3 shrink-0" /> {email}</p>
            </div>

            <div className="flex gap-2.5 mb-4">
              <div className="flex-1 bg-[#F5F0E6] rounded-xl p-3 text-center">
                <img src="/brito/icons/xp.png" alt="" className="w-[22px] h-[22px] object-contain mx-auto" />
                <p className="text-[#2B2B28] font-extrabold text-[15px] mt-1">{xpTotal}</p>
                <p className="text-[#8a897f] text-[10px] font-bold">XP total</p>
              </div>
              <div className="flex-1 bg-[#F5F0E6] rounded-xl p-3 text-center">
                <img src="/brito/icons/racha.png" alt="" className="w-[22px] h-[22px] object-contain mx-auto" />
                <p className="text-[#2B2B28] font-extrabold text-[15px] mt-1">{rachaMejor}</p>
                <p className="text-[#8a897f] text-[10px] font-bold">Mejor racha</p>
              </div>
            </div>

            {plan === 'PREMIUM' && (
              <div className="flex items-center justify-center gap-1.5 bg-[#EAF1FA] text-[#1E5FA8] text-xs font-bold px-3 py-2 rounded-full mb-3">
                Plan Premium
              </div>
            )}

            <button
              onClick={() => signOut({ callbackUrl: '/sign-in' })}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-[#FCE9F0] text-[#B33D6E] hover:bg-[#f8dbe6] transition-colors text-[13.5px] font-bold"
            >
              <LogOut className="w-4 h-4" /> Cerrar sesión
            </button>
          </div>
          </div>
        </div>
  )

  return (
    <>
      {variante === 'navitem' ? (
        <button
          onClick={() => setAbierto(true)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[#57564f] hover:bg-[#F5F3EC] transition-colors text-sm font-bold"
        >
          <img src="/brito/icons/perfil.png" alt="" className="w-8 h-8 object-contain" /> Perfil
        </button>
      ) : (
        <button
          onClick={() => setAbierto(true)}
          title="Tu perfil"
          className="w-8 h-8 rounded-full overflow-hidden bg-[#1E5FA8] text-white flex items-center justify-center text-xs font-bold shrink-0 hover:brightness-110 transition-all"
        >
          {imagenUrl ? <img src={imagenUrl} alt={nombre} className="w-full h-full object-cover" /> : iniciales}
        </button>
      )}

      {montado && modal && createPortal(modal, document.body)}
    </>
  )
}
