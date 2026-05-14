'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, CreditCard, CalendarDays,
  MoreHorizontal, X, Wallet, BookOpen, School,
  Award, FileBarChart2, BarChart3, UserCheck,
  ShieldCheck, Sun, Moon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = { href: string; label: string; icon: React.ElementType; adminOnly: boolean }

const primaryItems: NavItem[] = [
  { href: '/dashboard',   label: 'Dashboard',  icon: LayoutDashboard, adminOnly: false },
  { href: '/estudiantes', label: 'Estudiantes', icon: Users,           adminOnly: false },
  { href: '/pagos',       label: 'Pagos',       icon: CreditCard,      adminOnly: false },
  { href: '/cobros',      label: 'Cobros',      icon: CalendarDays,    adminOnly: false },
]

const moreItems: NavItem[] = [
  { href: '/financiamientos', label: 'Financiamientos', icon: Wallet,        adminOnly: false },
  { href: '/cursos',          label: 'Cursos',           icon: BookOpen,      adminOnly: false },
  { href: '/colegios',        label: 'Colegios',         icon: School,        adminOnly: false },
  { href: '/certificados',    label: 'Certificados',     icon: Award,         adminOnly: false },
  { href: '/simulacros',      label: 'Simulacros',       icon: FileBarChart2, adminOnly: false },
  { href: '/usuarios',        label: 'Usuarios',         icon: ShieldCheck,   adminOnly: true  },
  { href: '/asesores',        label: 'Asesores',         icon: UserCheck,     adminOnly: true  },
  { href: '/reportes',        label: 'Reportes',         icon: BarChart3,     adminOnly: true  },
]

interface BottomNavProps { role?: 'ADMIN' | 'VENDEDOR' }

export function BottomNav({ role = 'VENDEDOR' }: BottomNavProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = theme === 'dark'
  const visibleMore = moreItems.filter(i => !i.adminOnly || role === 'ADMIN')

  return (
    <>
      {/* Backdrop del menú más */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* Sheet "Más" */}
      {moreOpen && (
        <div className="fixed bottom-16 left-0 right-0 z-50 md:hidden mx-3 mb-1 rounded-2xl border border-outline-variant shadow-float overflow-hidden"
          style={{ background: 'var(--surface-lowest)' }}>

          {/* Header del sheet */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
            <p className="text-sm font-semibold text-on-surface">Más secciones</p>
            <button onClick={() => setMoreOpen(false)} className="p-1 rounded-md text-on-surface-variant hover:text-on-surface">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Grid de ítems */}
          <div className="grid grid-cols-4 gap-px p-3">
            {visibleMore.map(item => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-on-surface-variant hover:bg-surface-high hover:text-on-surface',
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium text-center leading-tight">{item.label}</span>
                </Link>
              )
            })}
          </div>

          {/* Footer con usuario y tema */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant">
            <div className="flex items-center gap-2.5">
              <UserButton afterSignOutUrl="/sign-in" />
              <div>
                <p className="text-[12px] font-semibold text-on-surface">Mi cuenta</p>
                <p className="text-[10px] text-on-surface-variant capitalize">{role.toLowerCase()}</p>
              </div>
            </div>
            {mounted && (
              <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-high hover:text-on-surface transition-colors"
              >
                {isDark ? <Sun className="w-4 h-4 text-tertiary" /> : <Moon className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Barra inferior fija */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-outline-variant"
        style={{ background: 'var(--surface-lowest)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around h-14 px-2">
          {primaryItems.map(item => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[56px]',
                  isActive ? 'text-primary' : 'text-on-surface-variant',
                )}
              >
                <Icon className={cn('w-5 h-5', isActive && 'text-primary')} />
                <span className={cn('text-[9px] font-medium', isActive ? 'text-primary' : 'text-on-surface-variant')}>
                  {item.label}
                </span>
                {isActive && <span className="absolute top-0 w-8 h-0.5 rounded-full bg-primary -mt-px" />}
              </Link>
            )
          })}

          {/* Botón Más */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[56px]',
              moreOpen ? 'text-primary' : 'text-on-surface-variant',
            )}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[9px] font-medium">Más</span>
          </button>
        </div>
      </nav>
    </>
  )
}
