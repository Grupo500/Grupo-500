'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserMenu } from '@/components/layout/UserMenu'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, CalendarDays,
  MoreHorizontal, X, BookOpen, School,
  Award, FileBarChart2, BarChart3,
  ShieldCheck, Sun, Moon, Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = { href: string; label: string; icon: React.ElementType; adminOnly: boolean }

const primaryItems: NavItem[] = [
  { href: '/dashboard',   label: 'Dashboard',  icon: LayoutDashboard, adminOnly: false },
  { href: '/estudiantes', label: 'Estudiantes', icon: Users,           adminOnly: false },
  { href: '/calendario',   label: 'Calendario',  icon: CalendarDays,    adminOnly: false },
  { href: '/certificados', label: 'Certificados', icon: Award,         adminOnly: false },
]

const moreItems: NavItem[] = [
  { href: '/cursos',          label: 'Cursos',           icon: BookOpen,      adminOnly: false },
  { href: '/colegios',        label: 'Colegios',         icon: School,        adminOnly: false },
  { href: '/simulacros',      label: 'Simulacros',       icon: FileBarChart2, adminOnly: false },
  { href: '/usuarios',        label: 'Usuarios',         icon: ShieldCheck,   adminOnly: true  },
  { href: '/calendarios',     label: 'Calendarios',      icon: Globe,         adminOnly: true  },
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

  useEffect(() => {
    if (moreOpen) {
      requestAnimationFrame(() => setSheetVisible(true))
    } else {
      setSheetVisible(false)
    }
  }, [moreOpen])

  const isDark = theme === 'dark'
  const visibleMore = moreItems.filter(i => !i.adminOnly || role === 'ADMIN')
  const isMoreActive = visibleMore.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))
  const handleClose = () => setMoreOpen(false)

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className={cn(
          'fixed inset-0 z-40 md:hidden bg-black/60 backdrop-blur-sm transition-opacity duration-300',
          moreOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
      />

      {/* Sheet "Más" */}
      <div
        className={cn(
          'fixed left-4 right-4 z-50 md:hidden rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 ease-out',
          sheetVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none',
        )}
        style={{
          bottom: 'calc(env(safe-area-inset-bottom) + 88px)',
          background: 'var(--surface-lowest)',
          border: '1px solid color-mix(in srgb, var(--outline-variant) 60%, transparent)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-outline-variant/40">
          <p className="text-sm font-bold text-on-surface tracking-tight">Más secciones</p>
          <button onClick={handleClose} className="w-7 h-7 rounded-full bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-4 gap-2 p-4">
          {visibleMore.map((item, i) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleClose}
                className={cn(
                  'flex flex-col items-center gap-2 py-3 px-1 rounded-2xl transition-all duration-200 active:scale-95',
                  isActive ? 'bg-primary/10 text-primary' : 'text-on-surface-variant active:bg-surface-high',
                )}
                style={{
                  opacity: sheetVisible ? 1 : 0,
                  transform: sheetVisible ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.95)',
                  transition: `opacity 250ms ${i * 25}ms ease-out, transform 250ms ${i * 25}ms ease-out`,
                }}
              >
                <div
                  className={cn(
                    'w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200',
                    !isActive && 'bg-surface-high',
                  )}
                  style={isActive ? {
                    background: 'linear-gradient(135deg, #2094ff, #4361ee)',
                    boxShadow: '0 3px 10px rgba(32,148,255,0.45)',
                  } : undefined}
                >
                  <Icon className={cn('w-5 h-5', isActive ? 'text-white' : 'text-on-surface-variant')} />
                </div>
                <span className={cn(
                  'text-[10px] font-semibold text-center leading-tight',
                  isActive ? 'text-primary' : 'text-on-surface-variant',
                )}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>

        {/* Footer cuenta */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-t border-outline-variant/40"
          style={{
            opacity: sheetVisible ? 1 : 0,
            transform: sheetVisible ? 'translateY(0)' : 'translateY(6px)',
            transition: 'opacity 280ms 200ms ease-out, transform 280ms 200ms ease-out',
          }}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <UserMenu />
          </div>
          {mounted && (
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="w-9 h-9 rounded-2xl bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-all active:scale-90"
            >
              {isDark ? <Sun className="w-4 h-4 text-tertiary" /> : <Moon className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* ── Floating Tab Bar ── */}
      <div
        className="fixed left-4 right-4 z-40 md:hidden"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        <nav
          className="flex items-center justify-around h-[62px] px-2 rounded-[28px] shadow-2xl"
          style={{
            background: 'linear-gradient(135deg, #003060 0%, #0a4a8a 60%, #1264b8 100%)',
            boxShadow: '0 8px 32px rgba(0,48,96,0.45), 0 2px 8px rgba(32,148,255,0.2)',
          }}
        >
          {/* Ítems primarios */}
          {primaryItems.map((item, idx) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

            // Ítem central (índice 1 = Estudiantes) con acento especial
            const isCentral = idx === 1

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-1 flex-1 h-full relative group"
              >
                <div className={cn(
                  'flex items-center justify-center rounded-2xl transition-all duration-250',
                  isActive
                    ? 'w-12 h-9'
                    : 'w-10 h-8 group-active:bg-white/10',
                )}
                  style={isActive ? {
                    background: '#21b9f7',
                    boxShadow: '0 2px 12px rgba(33,185,247,0.5)',
                  } : undefined}
                >
                  <Icon className={cn(
                    'w-5 h-5 transition-all duration-250',
                    isActive ? 'text-white' : 'text-white/45',
                  )} />
                </div>
                <span className={cn(
                  'text-[9px] font-semibold leading-none transition-all duration-250',
                  isActive ? 'text-[#95daff]' : 'text-white/40',
                )}>
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* Botón Más */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full relative group"
          >
            <div
              className={cn(
                'flex items-center justify-center rounded-2xl transition-all duration-250',
                (moreOpen || isMoreActive) ? 'w-12 h-9' : 'w-10 h-8 group-active:bg-white/10',
              )}
              style={(moreOpen || isMoreActive) ? { background: 'rgba(32,148,255,0.22)' } : undefined}
            >
              <MoreHorizontal className={cn(
                'w-5 h-5 transition-all duration-250',
                (moreOpen || isMoreActive) ? 'text-white' : 'text-white/45',
              )} />
            </div>
            <span className={cn(
              'text-[9px] font-semibold leading-none transition-all duration-250',
              (moreOpen || isMoreActive) ? 'text-[#95daff]' : 'text-white/40',
            )}>
              Más
            </span>
          </button>
        </nav>
      </div>
    </>
  )
}
