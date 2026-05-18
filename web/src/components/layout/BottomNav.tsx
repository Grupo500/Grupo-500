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
  const [sheetVisible, setSheetVisible] = useState(false)

  useEffect(() => setMounted(true), [])

  // Animación entrada/salida del sheet
  useEffect(() => {
    if (moreOpen) {
      // pequeño delay para que el DOM monte antes de la transición
      requestAnimationFrame(() => setSheetVisible(true))
    } else {
      setSheetVisible(false)
    }
  }, [moreOpen])

  const isDark = theme === 'dark'
  const visibleMore = moreItems.filter(i => !i.adminOnly || role === 'ADMIN')
  const isMoreActive = visibleMore.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))

  const handleCloseSheet = () => setMoreOpen(false)

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleCloseSheet}
        className={cn(
          'fixed inset-0 z-40 md:hidden bg-black/50 backdrop-blur-sm transition-opacity duration-300',
          moreOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
      />

      {/* Sheet "Más" — desliza desde abajo */}
      <div
        className={cn(
          'fixed left-0 right-0 z-50 md:hidden mx-3 rounded-2xl border border-outline-variant shadow-float overflow-hidden transition-all duration-300 ease-out',
          sheetVisible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-6 pointer-events-none',
        )}
        style={{
          bottom: 'calc(env(safe-area-inset-bottom) + 68px)',
          background: 'var(--surface-lowest)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/60">
          <p className="text-sm font-semibold text-on-surface">Más secciones</p>
          <button
            onClick={handleCloseSheet}
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-high hover:text-on-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Grid ítems */}
        <div className="grid grid-cols-4 gap-1 p-3">
          {visibleMore.map((item, i) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleCloseSheet}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200 active:scale-95',
                  isActive
                    ? 'bg-primary/12 text-primary'
                    : 'text-on-surface-variant hover:bg-surface-high hover:text-on-surface',
                )}
                style={{
                  transitionDelay: sheetVisible ? `${i * 30}ms` : '0ms',
                  opacity: sheetVisible ? 1 : 0,
                  transform: sheetVisible ? 'translateY(0)' : 'translateY(8px)',
                }}
              >
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                  isActive ? 'bg-primary/15' : 'bg-surface-high',
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-medium text-center leading-tight">{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant/60">
          <div className="flex items-center gap-3">
            <UserButton afterSignOutUrl="/sign-in" />
            <div>
              <p className="text-[12px] font-semibold text-on-surface">Mi cuenta</p>
              <p className="text-[10px] text-on-surface-variant capitalize">{role === 'ADMIN' ? 'Administrador' : 'Asesor'}</p>
            </div>
          </div>
          {mounted && (
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="p-2 rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-high hover:text-on-surface transition-all active:scale-95"
            >
              {isDark
                ? <Sun className="w-4 h-4 text-tertiary" />
                : <Moon className="w-4 h-4" />
              }
            </button>
          )}
        </div>
      </div>

      {/* Barra inferior */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-outline-variant/60 backdrop-blur-md"
        style={{
          background: 'color-mix(in srgb, var(--surface-lowest) 85%, transparent)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex items-center justify-around h-[60px] px-1">
          {primaryItems.map(item => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 relative group"
              >
                {/* Pill indicador activo */}
                <span
                  className={cn(
                    'absolute top-1 w-8 h-1 rounded-full bg-primary transition-all duration-300',
                    isActive ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0',
                  )}
                />

                {/* Ícono con fondo al activar */}
                <div className={cn(
                  'w-10 h-7 rounded-xl flex items-center justify-center transition-all duration-200',
                  isActive ? 'bg-primary/12' : 'group-active:bg-surface-high',
                )}>
                  <Icon className={cn(
                    'transition-all duration-200',
                    isActive ? 'w-5 h-5 text-primary scale-110' : 'w-5 h-5 text-on-surface-variant',
                  )} />
                </div>

                {/* Label — solo activo en color primario */}
                <span className={cn(
                  'text-[9px] font-semibold transition-all duration-200 leading-none',
                  isActive ? 'text-primary' : 'text-on-surface-variant',
                )}>
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* Botón Más */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 relative group"
          >
            <span
              className={cn(
                'absolute top-1 w-8 h-1 rounded-full bg-primary transition-all duration-300',
                (moreOpen || isMoreActive) ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0',
              )}
            />
            <div className={cn(
              'w-10 h-7 rounded-xl flex items-center justify-center transition-all duration-200',
              (moreOpen || isMoreActive) ? 'bg-primary/12' : 'group-active:bg-surface-high',
            )}>
              <MoreHorizontal className={cn(
                'w-5 h-5 transition-all duration-200',
                (moreOpen || isMoreActive) ? 'text-primary' : 'text-on-surface-variant',
              )} />
            </div>
            <span className={cn(
              'text-[9px] font-semibold transition-all duration-200 leading-none',
              (moreOpen || isMoreActive) ? 'text-primary' : 'text-on-surface-variant',
            )}>
              Más
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}
