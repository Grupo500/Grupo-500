'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import {
  LayoutDashboard, Users, CreditCard, Wallet, CalendarDays,
  UserCheck, BookOpen, School, Award, FileBarChart2,
  BarChart3, GraduationCap, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const navItems = [
  { href: '/dashboard',        label: 'Dashboard',        icon: LayoutDashboard, adminOnly: false },
  { href: '/estudiantes',      label: 'Estudiantes',      icon: Users,            adminOnly: false },
  { href: '/pagos',            label: 'Pagos',            icon: CreditCard,       adminOnly: false },
  { href: '/financiamientos',  label: 'Financiamientos',  icon: Wallet,           adminOnly: false },
  { href: '/cobros',           label: 'Calendario Cobros', icon: CalendarDays,    adminOnly: false },
  { href: '/asesores',         label: 'Asesores',         icon: UserCheck,        adminOnly: true  },
  { href: '/cursos',           label: 'Cursos',           icon: BookOpen,         adminOnly: false },
  { href: '/colegios',         label: 'Colegios',         icon: School,           adminOnly: false },
  { href: '/certificados',     label: 'Certificados',     icon: Award,            adminOnly: false },
  { href: '/simulacros',       label: 'Simulacros',       icon: FileBarChart2,    adminOnly: false },
  { href: '/reportes',         label: 'Reportes',         icon: BarChart3,        adminOnly: true  },
]

interface SidebarProps {
  role?: 'ADMIN' | 'VENDEDOR'
}

export function Sidebar({ role = 'VENDEDOR' }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const visibleItems = navItems.filter(item => !item.adminOnly || role === 'ADMIN')

  return (
    <aside className={cn(
      'relative flex flex-col h-screen bg-surface-lowest border-r border-white/[0.06]',
      'transition-all duration-300',
      collapsed ? 'w-16' : 'w-64',
    )}>
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-5 border-b border-white/[0.06]',
        collapsed && 'justify-center px-0',
      )}>
        <div className="flex-shrink-0 w-8 h-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
          <GraduationCap className="w-4 h-4 text-primary" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-bold text-on-surface leading-none">Grupo 500</p>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Pre-ICFES</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {visibleItems.map(({ href, label, icon: Icon, adminOnly }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded text-sm font-medium',
                'transition-all duration-150 group relative',
                collapsed ? 'justify-center' : '',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-on-surface-variant hover:bg-surface-high hover:text-on-surface',
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-primary')} />
              {!collapsed && <span>{label}</span>}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-surface-highest text-on-surface text-xs rounded
                                opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-float">
                  {label}
                </div>
              )}
              {adminOnly && !collapsed && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold tracking-wide">
                  ADMIN
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className={cn(
        'border-t border-white/[0.06] px-4 py-3 flex items-center gap-3',
        collapsed && 'justify-center px-0',
      )}>
        <UserButton afterSignOutUrl="/sign-in" />
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-on-surface truncate">Mi cuenta</p>
            <p className="text-[11px] text-on-surface-variant capitalize">{role.toLowerCase()}</p>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-surface-highest border border-outline-variant
                   flex items-center justify-center text-on-surface-variant hover:text-on-surface
                   hover:bg-surface-high transition-colors z-10"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  )
}
