'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserMenu } from '@/components/layout/UserMenu'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  LayoutDashboard, Users, CalendarDays,
  BookOpen, School, Award, FileBarChart2,
  BarChart3, ChevronLeft, ChevronRight,
  Sun, Moon, ShieldCheck, ClipboardList,
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
  { type: 'section', label: 'Académico',                                                        adminOnly: false },
  { type: 'link',    href: '/cursos',          label: 'Cursos',          icon: BookOpen,        adminOnly: false },
  { type: 'link',    href: '/formularios',      label: 'Formularios',     icon: ClipboardList,   adminOnly: true  },
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

  // Paleta fija del sidebar oscuro (independiente del tema de la app)
  const RAIL_BG    = '#15203a'
  const ACTIVE     = '#21b9f7'

  return (
    <aside
      style={{ background: RAIL_BG }}
      className={cn(
        'relative flex flex-col h-screen transition-all duration-300 z-20',
        'border-r border-white/[0.06]',
        collapsed ? 'w-[60px]' : 'w-[220px]',
      )}
    >

      {/* ── Logo ─────────────────────────────────── */}
      <div className={cn(
        'flex items-center gap-2.5 h-14 border-b border-white/[0.06] px-4 flex-shrink-0',
        collapsed && 'justify-center px-0',
      )}>
        <div className="flex-shrink-0 w-7 h-7">
          <Image src="/logo-grupo500.png" alt="Grupo 500" width={28} height={28} className="w-7 h-7 object-cover rounded-full" priority />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-white leading-none tracking-tight">Grupo 500</p>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Pre-ICFES</p>
          </div>
        )}
      </div>

      {/* ── Nav ──────────────────────────────────── */}
      {/* overflow-visible para que el círculo activo pueda salirse del borde */}
      <nav className="flex-1 overflow-visible py-2 px-2 space-y-px">
        {visibleItems.map((item, i) => {
          if (item.type === 'section') {
            return collapsed
              ? <div key={i} className="my-1.5 mx-2 h-px bg-white/[0.06]" />
              : <p key={i} className="pt-3 pb-0.5 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 select-none">
                  {item.label}
                </p>
          }

          const { href, label, icon: Icon, adminOnly } = item
          const isActive = pathname === href || pathname.startsWith(href + '/')

          // ── Activo + colapsado: círculo cian flotante + curva cóncava ──
          if (isActive && collapsed) {
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className="relative flex items-center justify-center px-0 py-2 group"
              >
                {/* Curva cóncava tallada en el fondo oscuro (color del contenido) */}
                <svg
                  viewBox="0 0 46 92" preserveAspectRatio="none" aria-hidden="true"
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-[34px] h-[92px] z-[2] [fill:#eef6ff] dark:[fill:#0a1628]"
                >
                  <path d="M46,0 C46,26 0,26 0,46 C0,66 46,66 46,92 Z" />
                </svg>
                {/* Círculo cian flotando fuera del borde */}
                <span
                  style={{ background: ACTIVE, boxShadow: '0 6px 16px rgba(33,185,247,0.45)' }}
                  className="absolute right-[-22px] top-1/2 -translate-y-1/2 w-[46px] h-[46px] rounded-full flex items-center justify-center z-[5]"
                >
                  <Icon className="w-5 h-5 text-white" />
                </span>
              </Link>
            )
          }

          // ── Activo + expandido: círculo cian inline + label ──
          if (isActive && !collapsed) {
            return (
              <Link
                key={href}
                href={href}
                className="relative flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-md text-[13px] font-medium text-white"
              >
                <span
                  style={{ background: ACTIVE, boxShadow: '0 4px 12px rgba(33,185,247,0.4)' }}
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                >
                  <Icon className="w-4 h-4 text-white" />
                </span>
                <span className="flex-1 truncate">{label}</span>
                {adminOnly && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[#21b9f7]/20 text-[#7fd4fb] font-bold tracking-wide">
                    ADMIN
                  </span>
                )}
              </Link>
            )
          }

          // ── Ítem inactivo ──
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'relative flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium',
                'transition-colors duration-150 group',
                'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100',
                collapsed && 'justify-center px-0',
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0 text-slate-400 group-hover:text-slate-100" />

              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{label}</span>
                  {adminOnly && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-white/[0.08] text-slate-300 font-bold tracking-wide">
                      ADMIN
                    </span>
                  )}
                </>
              )}

              {/* Tooltip cuando colapsado */}
              {collapsed && (
                <div className="absolute left-full ml-2.5 px-2.5 py-1.5 rounded-md shadow-float
                                bg-[#253a61] text-white text-xs font-medium
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
      <div className="flex-shrink-0 border-t border-white/[0.06] p-2 space-y-px">
        {/* Toggle tema */}
        {mounted && (
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            title={isDark ? 'Modo claro' : 'Modo oscuro'}
            className={cn(
              'flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-[13px] font-medium',
              'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100 transition-colors',
              collapsed && 'justify-center px-0',
            )}
          >
            {isDark
              ? <Sun  className="w-4 h-4 flex-shrink-0 text-[#21b9f7]" />
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
          <UserMenu collapsed={collapsed} onDark />
        </div>
      </div>

      {/* ── Collapse toggle ───────────────────────── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{ background: RAIL_BG }}
        className={cn(
          'absolute -right-3 top-[52px] w-6 h-6 rounded-full z-10',
          'border border-white/[0.12] shadow-card',
          'flex items-center justify-center',
          'text-slate-300 hover:text-white hover:bg-white/[0.08]',
          'transition-colors duration-150',
        )}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  )
}
