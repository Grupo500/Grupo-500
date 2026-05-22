'use client'

import { useRef, useEffect, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserMenuProps {
  collapsed?: boolean
}

export function UserMenu({ collapsed = false }: UserMenuProps) {
  const { data: session } = useSession()
  const [open, setOpen]   = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const name     = session?.user?.name  ?? session?.user?.email?.split('@')[0] ?? 'Usuario'
  const email    = session?.user?.email ?? ''
  const image    = session?.user?.image
  const initials = name.slice(0, 2).toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        title={collapsed ? name : undefined}
        className="flex items-center gap-2.5 w-full cursor-pointer focus:outline-none"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/15 border border-primary/25 flex-shrink-0 flex items-center justify-center">
          {image
            ? <img src={image} alt={name} className="w-full h-full object-cover" />
            : <span className="text-[11px] font-bold text-primary">{initials}</span>
          }
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[12px] font-semibold text-on-surface truncate">{name}</p>
            <p className="text-[10px] text-on-surface-variant truncate max-w-full overflow-hidden">{email}</p>
          </div>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className={cn(
          'absolute z-50 rounded-xl shadow-float border border-[var(--outline-variant)] bg-[var(--surface-lowest)]',
          'py-1 min-w-[180px]',
          collapsed ? 'left-full bottom-0 ml-2.5' : 'bottom-full mb-2 left-0 right-0',
        )}>
          <div className="px-3 py-2 border-b border-[var(--outline-variant)]">
            <p className="text-[12px] font-semibold text-on-surface truncate">{name}</p>
            <p className="text-[10px] text-on-surface-variant truncate">{email}</p>
          </div>
          <button
            onClick={() => { setOpen(false); signOut({ callbackUrl: '/sign-in' }) }}
            className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-on-surface-variant hover:text-on-surface hover:bg-[var(--surface-high)] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
