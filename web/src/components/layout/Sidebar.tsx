'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  LayoutDashboard, Users, Wallet, CalendarDays,
  UserCheck, BookOpen, School, Award, FileBarChart2,
  BarChart3, ChevronLeft, ChevronRight,
  Sun, Moon, ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem =
  | { type: 'link';    href: string; label: string; icon: React.ElementType; adminOnly: boolean }
  | { type: 'section'; label: string; adminOnly: boolean }

const navItems: NavItem[] = [
  { type: 'link',    href: '/dashboard',       label: 'Dashboard',       icon: LayoutDashboard, adminOnly: false },
  { type: 'section', label: 'Gestión',                                                          adminOnly: false },
  { type: 'link',    href: '/estudiantes',     label: 'Estudiantes',     icon: Users,           adminOnly: false },
  { type: 'link',    href: '/usuarios',        label: 'Usuarios',        icon: ShieldCheck,     adminOnly: true  },
  { type: 'link',    href: '/asesores',        label: 'Asesores',        icon: UserCheck,       adminOnly: true  },
  { type: 'section', label: 'Financiero',                                                       adminOnly: false },
  { type: 'link',    href: '/cobros',          label: 'Cobros',          icon: Wallet,          adminOnly: false },
  { type: 'link',    href: '/calendario',      label: 'Calendario',      icon: CalendarDays,    adminOnly: false },
  { type: 'section', label: 'Académico',                                                        adminOnly: false },
  { type: 'link',    href: '/cursos',          label: 'Cursos',          icon: BookOpen,        adminOnly: false },
  { type: 'link',    href: '/colegios',        label: 'Colegios',        icon: School,          adminOnly: false },
  { type: 'link',    href: '/certificados',    label: 'Certificados',    icon: Award,           adminOnly: false },
  { type: 'link',    href: '/simulacros',      label: 'Simulacros',      icon: FileBarChart2,   adminOnly: false },
  { type: 'section', label: 'Análisis',                                                         adminOnly: true  },
  { type: 'link',    href: '/reportes',        label: 'Reportes',        icon: BarChart3,       adminOnly: true  },
]

interface SidebarProps { role?: 'ADMIN' | 'VENDEDOR' }

export function Sidebar({ role = 'VENDEDOR' }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const visibleItems = navItems.filter(item => !item.adminOnly || role === 'ADMIN')
  const isDark = theme === 'dark'

  return (
    <aside className={cn(
      'relative flex flex-col h-screen transition-all duration-300 z-20',
      'border-r border-[var(--outline-variant)]',
      'bg-[var(--surface-lowest)]',
      collapsed ? 'w-[60px]' : 'w-[220px]',
    )}>

      {/* ── Logo ─────────────────────────────────── */}
      <div className={cn(
        'flex items-center gap-2.5 h-14 border-b border-[var(--outline-variant)] px-4 flex-shrink-0',
        collapsed && 'justify-center px-0',
      )}>
        <div className="flex-shrink-0 w-7 h-7">
          <Image src="/logo-grupo500.png" alt="Grupo 500" width={28} height={28} className="w-7 h-7 object-cover rounded-full" priority />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-on-surface leading-none tracking-tight">Grupo 500</p>
            <p className="text-[10px] text-on-surface-variant mt-0.5 font-medium">Pre-ICFES</p>
          </div>
        )}
      </div>

      {/* ── Nav ──────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-px">
        {visibleItems.map((item, i) => {
          if (item.type === 'section') {
            return collapsed
              ? <div key={i} className="my-1.5 mx-2 h-px bg-[var(--outline-variant)]" />
              : <p key={i} className="pt-3 pb-0.5 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant/50 select-none">
                  {item.label}
                </p>
          }

          const { href, label, icon: Icon, adminOnly } = item
          const isActive = pathname === href || pathname.startsWith(href + '/')

          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              style={isActive ? { background: '#21b9f7', boxShadow: '0 2px 8px rgba(33,185,247,0.35)' } : undefined}
              className={cn(
                'relative flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium',
                'transition-all duration-150 group',
                collapsed && 'justify-center px-0',
                isActive
                  ? 'text-white'
                  : 'text-on-surface-variant hover:bg-[var(--surface-high)] hover:text-on-surface',
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-white' : 'text-on-surface-variant group-hover:text-on-surface')} />

              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{label}</span>
                  {adminOnly && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-tertiary/[0.12] text-tertiary font-bold tracking-wide">
                      ADMIN
                    </span>
                  )}
                </>
              )}

              {/* Tooltip cuando colapsado */}
              {collapsed && (
                <div className="absolute left-full ml-2.5 px-2.5 py-1.5 rounded-md shadow-float
                                bg-[var(--surface-highest)] text-on-surface text-xs font-medium
                                opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50
                                transition-opacity duration-150">
                  {label}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── Footer ───────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-[var(--outline-variant)] p-2 space-y-px">
        {/* Toggle tema */}
        {mounted && (
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            title={isDark ? 'Modo claro' : 'Modo oscuro'}
            className={cn(
              'flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-[13px] font-medium',
              'text-on-surface-variant hover:bg-[var(--surface-high)] hover:text-on-surface transition-colors',
              collapsed && 'justify-center px-0',
            )}
          >
            {isDark
              ? <Sun  className="w-4 h-4 flex-shrink-0 text-tertiary" />
              : <Moon className="w-4 h-4 flex-shrink-0" />
            }
            {!collapsed && <span>{isDark ? 'Modo claro' : 'Modo oscuro'}</span>}
          </button>
        )}

        {/* Usuario */}
        <div className={cn(
          'flex items-center gap-2.5 px-2 py-1.5',
          collapsed && 'justify-center px-0',
        )}>
          <UserButton afterSignOutUrl="/sign-in" />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-on-surface truncate">Mi cuenta</p>
              <p className="text-[10px] text-on-surface-variant font-medium capitalize">{role.toLowerCase()}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Collapse toggle ───────────────────────── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          'absolute -right-3 top-[52px] w-6 h-6 rounded-full z-10',
          'bg-[var(--surface-lowest)] border border-[var(--outline-variant)] shadow-card',
          'flex items-center justify-center',
          'text-on-surface-variant hover:text-on-surface hover:bg-[var(--surface-high)]',
          'transition-colors duration-150',
        )}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  )
}
