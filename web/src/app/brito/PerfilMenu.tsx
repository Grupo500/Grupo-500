'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { signOut } from 'next-auth/react'
import { X, LogOut, Mail, Sparkles, Flame } from 'lucide-react'

export function PerfilMenu({
  nombre, email, plan, xpTotal, rachaMejor, imagenUrl, trigger,
}: {
  nombre: string
  email: string
  plan: 'FREE' | 'PREMIUM'
  xpTotal: number
  rachaMejor: number
  imagenUrl?: string | null
  trigger?: (abrir: () => void) => React.ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])
  const inicial = (nombre || '?')[0]?.toUpperCase()

  const modal = abierto && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setAbierto(false)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
          <div className="relative w-full max-w-sm rounded-2xl shadow-2xl animate-slide-up" style={{ background: 'linear-gradient(180deg, #003060 0%, #0b1f3a 100%)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <p className="text-sm font-bold text-white">Tu perfil</p>
              <button onClick={() => setAbierto(false)} className="text-white/50 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-[#ffb703] to-[#fb8500] flex items-center justify-center text-white text-xl font-bold shrink-0">
                  {imagenUrl ? <img src={imagenUrl} alt={nombre} className="w-full h-full object-cover" /> : inicial}
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{nombre}</p>
                  <p className="text-white/50 text-xs flex items-center gap-1 truncate"><Mail className="w-3 h-3 shrink-0" /> {email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <p className="flex items-center gap-1.5 text-amber-300 text-xs font-semibold mb-1"><Sparkles className="w-3.5 h-3.5" /> XP total</p>
                  <p className="text-white font-bold text-lg">{xpTotal}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <p className="flex items-center gap-1.5 text-orange-400 text-xs font-semibold mb-1"><Flame className="w-3.5 h-3.5" /> Mejor racha</p>
                  <p className="text-white font-bold text-lg">{rachaMejor}</p>
                </div>
              </div>

              <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <span className="text-white/70 text-xs font-medium">Plan</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${plan === 'PREMIUM' ? 'bg-amber-400/20 text-amber-300' : 'bg-white/10 text-white/70'}`}>
                  {plan === 'PREMIUM' ? 'Premium' : 'Gratis'}
                </span>
              </div>

              <button
                onClick={() => signOut({ callbackUrl: '/sign-in' })}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/15 text-white/80 hover:bg-white/5 hover:text-white transition-colors text-sm font-medium"
              >
                <LogOut className="w-4 h-4" /> Cerrar sesión
              </button>
            </div>
          </div>
          </div>
        </div>
  )

  return (
    <>
      {trigger ? (
        trigger(() => setAbierto(true))
      ) : (
        <button
          onClick={() => setAbierto(true)}
          title="Tu perfil"
          className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#ffb703] to-[#fb8500] flex items-center justify-center text-white text-xs font-bold shrink-0 hover:brightness-110 transition-all"
        >
          {imagenUrl ? <img src={imagenUrl} alt={nombre} className="w-full h-full object-cover" /> : inicial}
        </button>
      )}

      {montado && modal && createPortal(modal, document.body)}
    </>
  )
}
