'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserMenu } from '@/components/layout/UserMenu'
import { useTheme } from 'next-themes'
import { useEffect, useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import {
  LayoutDashboard, Users, CalendarDays,
  BookOpen, School, Award, FileBarChart2,
  BarChart3, ChevronLeft, ChevronRight,
  ShieldCheck, ClipboardList,
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

// Paleta fija del sidebar oscuro (independiente del tema de la app)
const RAIL_BG = '#15203a'
const ACTIVE  = '#21b9f7'

// Geometría del sidebar flotante
const PAD_L       = 6     // separación izquierda
const PAD_Y       = 8     // separación arriba/abajo
const R           = 18    // radio de esquinas
const LOGO_BOTTOM = 70    // borde inferior del bloque del logo
const GAP         = 12    // separación entre el logo y el bloque principal
const MAIN_TOP    = LOGO_BOTTOM + GAP

// Rectángulo con las cuatro esquinas redondeadas
function roundedRect(x1: number, y1: number, x2: number, y2: number, r: number): string {
  return [
    `M${x1},${y1 + r}`,
    `Q${x1},${y1} ${x1 + r},${y1}`,
    `H${x2 - r}`,
    `Q${x2},${y1} ${x2},${y1 + r}`,
    `V${y2 - r}`,
    `Q${x2},${y2} ${x2 - r},${y2}`,
    `H${x1 + r}`,
    `Q${x1},${y2} ${x1},${y2 - r}`,
    `Z`,
  ].join(' ')
}

// Bloque principal (nav + footer): esquinas redondeadas + curva cóncava del activo
function buildMain(w: number, h: number, cy: number | null): string {
  const top    = MAIN_TOP
  const bottom = h - PAD_Y
  const left   = PAD_L

  const p: string[] = [
    `M${left},${top + R}`,
    `Q${left},${top} ${left + R},${top}`,
    `H${w - R}`,
    `Q${w},${top} ${w},${top + R}`,
  ]

  if (cy != null) {
    const depth = 38
    const half  = 52
    const wi    = w - depth
    const jt    = Math.max(cy - half, top + R + 2)
    const jb    = Math.min(cy + half, bottom - R - 2)
    const dTop  = cy - jt
    const dBot  = jb - cy
    p.push(
      `V${jt.toFixed(1)}`,
      `C${w},${(cy - dTop * 0.35).toFixed(1)} ${wi},${(cy - dTop * 0.6).toFixed(1)} ${wi},${cy.toFixed(1)}`,
      `C${wi},${(cy + dBot * 0.6).toFixed(1)} ${w},${(cy + dBot * 0.35).toFixed(1)} ${w},${jb.toFixed(1)}`,
    )
  }

  p.push(
    `V${bottom - R}`,
    `Q${w},${bottom} ${w - R},${bottom}`,
    `H${left + R}`,
    `Q${left},${bottom} ${left},${bottom - R}`,
    `Z`,
  )
  return p.join(' ')
}

// Fondo completo: bloque del logo (flotante) + bloque principal
function buildPath(w: number, h: number, cy: number | null): string {
  const logo = roundedRect(PAD_L, PAD_Y, w, LOGO_BOTTOM, R)
  return `${logo} ${buildMain(w, h, cy)}`
}

export function Sidebar({ role = 'VENDEDOR' }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { theme } = useTheme()

  const visibleItems = navItems.filter(item => !item.adminOnly || role === 'ADMIN')
  const isDark = theme === 'dark'

  const width = collapsed ? 60 : 220

  // Ítem activo
  const activeItem = visibleItems.find(
    it => it.type === 'link' && (pathname === it.href || pathname.startsWith(it.href + '/'))
  ) as Extract<NavItem, { type: 'link' }> | undefined
  const ActiveIcon = activeItem?.icon

  // ── Centrado del módulo activo: la lista se desliza para dejarlo al medio ──
  const asideRef     = useRef<HTMLElement>(null)
  const listRef      = useRef<HTMLDivElement>(null)
  const activeRef    = useRef<HTMLAnchorElement>(null)
  const footerRef    = useRef<HTMLDivElement>(null)
  const translateRef = useRef(0)
  const firstRef     = useRef(true)
  const [dims, setDims]           = useState({ h: 0 })
  const [centerY, setCenterY]     = useState<number | null>(null)
  const [translateY, setTranslateY] = useState(0)
  const [animate, setAnimate]     = useState(false)

  const medir = useCallback((doAnimate: boolean) => {
    const aside = asideRef.current
    if (!aside) return
    setDims({ h: aside.clientHeight })

    if (!collapsed || !activeRef.current || !listRef.current || !footerRef.current) {
      setCenterY(null)
      translateRef.current = 0
      setTranslateY(0)
      return
    }

    const ar = aside.getBoundingClientRect()
    const footerTop = footerRef.current.getBoundingClientRect().top - ar.top
    const cYy = (MAIN_TOP + footerTop) / 2                       // centro del viewport del nav

    const lr = listRef.current.getBoundingClientRect()
    const er = activeRef.current.getBoundingClientRect()
    const naturalCenter = (er.top - lr.top) + er.height / 2      // centro del activo dentro de la lista
    const listTop0 = (lr.top - ar.top) - translateRef.current    // top de la lista a translate 0
    const desired  = cYy - (listTop0 + naturalCenter)            // cuánto trasladar para centrarlo

    setAnimate(doAnimate && !firstRef.current)
    firstRef.current = false
    setCenterY(cYy)
    translateRef.current = desired
    setTranslateY(desired)
  }, [collapsed])

  useEffect(() => { medir(true) }, [pathname])          // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { medir(false) }, [collapsed, role])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onResize = () => medir(false)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [medir])

  const notchFill = isDark ? '#0a1628' : '#eef6ff'

  return (
    <aside
      ref={asideRef}
      style={{ background: notchFill }}
      className={cn(
        'relative flex flex-col h-screen transition-all duration-300 z-20',
        collapsed ? 'w-[60px]' : 'w-[220px]',
      )}
    >
      {/* ── Fondo oscuro deformable (SVG) ───────────── */}
      <svg
        className="absolute inset-0 w-full h-full z-0 pointer-events-none transition-[all] duration-300"
        viewBox={`0 0 ${width} ${dims.h || 800}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d={buildPath(width, dims.h || 800, centerY)} fill={RAIL_BG} />
      </svg>

      {/* ── Círculo cian flotante del módulo activo (fijo al centro) ── */}
      {collapsed && centerY != null && ActiveIcon && (
        <span
          style={{ top: centerY, background: ACTIVE, boxShadow: '0 6px 16px rgba(33,185,247,0.5)' }}
          className="absolute right-[-23px] -translate-y-1/2 w-[50px] h-[50px] rounded-full flex items-center justify-center z-30 pointer-events-none"
        >
          <ActiveIcon className="w-[21px] h-[21px] text-white" />
        </span>
      )}

      {/* ── Logo (bloque flotante separado) ──────── */}
      <div
        style={{ height: MAIN_TOP }}
        className={cn(
          'relative z-10 flex items-center gap-2.5 px-4 flex-shrink-0',
          collapsed && 'justify-center px-0',
        )}
      >
        <div className="flex-shrink-0 w-10 h-10">
          <Image src="/logo-grupo500.png" alt="Grupo 500" width={40} height={40} className="w-10 h-10 object-cover rounded-full" priority />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-white leading-none tracking-tight">Grupo 500</p>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Pre-ICFES</p>
          </div>
        )}
      </div>

      {/* ── Nav ──────────────────────────────────── */}
      <nav className={cn('relative z-10 flex-1 px-2', collapsed ? 'overflow-hidden' : 'overflow-y-auto')}>
        <div
          ref={listRef}
          style={collapsed ? {
            transform: `translateY(${translateY}px)`,
            transition: animate ? 'transform 380ms cubic-bezier(0.22,1,0.36,1)' : 'none',
          } : undefined}
          className={cn('py-2', collapsed ? 'space-y-2.5' : 'space-y-1')}
        >
          {visibleItems.map((item, i) => {
            if (item.type === 'section') {
              return collapsed
                ? <div key={i} className="my-1 mx-3 h-px bg-white/[0.06]" />
                : <p key={i} className="pt-3 pb-0.5 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 select-none">
                    {item.label}
                  </p>
            }

            const { href, label, icon: Icon, adminOnly } = item
            const isActive = pathname === href || pathname.startsWith(href + '/')

            // ── Activo + colapsado: solo placeholder (el círculo se dibuja aparte) ──
            if (isActive && collapsed) {
              return (
                <Link
                  key={href}
                  ref={activeRef}
                  href={href}
                  title={label}
                  className="relative flex items-center justify-center py-2.5"
                >
                  <Icon className="w-[19px] h-[19px] opacity-0" />
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
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  >
                    <Icon className="w-[18px] h-[18px] text-white" />
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
                  'relative flex items-center gap-2.5 rounded-md text-[13px] font-medium',
                  'transition-colors duration-150 group',
                  'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100',
                  collapsed ? 'justify-center py-2.5' : 'px-2.5 py-2',
                )}
              >
                <Icon className={cn('flex-shrink-0 text-slate-400 group-hover:text-slate-100', collapsed ? 'w-[19px] h-[19px]' : 'w-[18px] h-[18px]')} />

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
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ── Footer ───────────────────────────────── */}
      <div ref={footerRef} className="relative z-10 flex-shrink-0 border-t border-white/[0.06] p-2 space-y-px">
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
          'absolute -right-3 top-[52px] w-6 h-6 rounded-full z-40',
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
