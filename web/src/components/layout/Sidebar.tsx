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
  { type: 'link',    href: '/estudiantes',     label: 'Estudiantes',     icon: Users,           adminOnly: false },
  { type: 'link',    href: '/usuarios',        label: 'Usuarios',        icon: ShieldCheck,     adminOnly: true  },
  { type: 'link',    href: '/cursos',          label: 'Cursos',          icon: BookOpen,        adminOnly: false },
  { type: 'link',    href: '/formularios',      label: 'Formularios',     icon: ClipboardList,   adminOnly: false },
  { type: 'link',    href: '/colegios',        label: 'Colegios',        icon: School,          adminOnly: false },
  { type: 'link',    href: '/certificados',    label: 'Certificados',    icon: Award,           adminOnly: false },
  { type: 'link',    href: '/simulacros',      label: 'Simulacros',      icon: FileBarChart2,   adminOnly: false },
  { type: 'link',    href: '/reportes',        label: 'Analíticas',      icon: BarChart3,       adminOnly: false },
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

// Bloque principal (nav + footer): esquinas redondeadas + curva cóncava del activo.
// La curva tiene siempre la misma profundidad; cerca de los bordes su brazo
// superior/inferior se funde con la esquina redondeada (no se achica ni se corta).
function buildMain(w: number, h: number, cy: number | null): string {
  const top    = MAIN_TOP
  const bottom = h - PAD_Y
  const left   = PAD_L
  const depth  = 38
  const half   = 52
  const wi     = w - depth

  const p: string[] = [
    `M${left},${top + R}`,
    `Q${left},${top} ${left + R},${top}`,   // esquina sup-izq
    `H${w - R}`,
  ]

  if (cy == null) {
    p.push(`Q${w},${top} ${w},${top + R}`)  // esquina sup-der normal
  } else {
    const botMelt = cy + half > bottom - R - 2        // el brazo inferior toca la esquina

    // ── Borde derecho: entrada a la curva (arriba) — misma curva en todos los módulos ──
    p.push(
      `Q${w},${top} ${w},${top + R}`,
      `V${(cy - half).toFixed(1)}`,
      `C${w},${(cy - half * 0.35).toFixed(1)} ${wi},${(cy - half * 0.6).toFixed(1)} ${wi},${cy.toFixed(1)}`,
    )

    // ── Salida de la curva (abajo) ──
    if (botMelt) {
      // El brazo inferior se funde con la esquina inf-der
      p.push(
        `C${wi},${(cy + half * 0.55).toFixed(1)} ${w},${bottom} ${w - R},${bottom}`,
        `H${left + R}`,
        `Q${left},${bottom} ${left},${bottom - R}`,
        `Z`,
      )
      return p.join(' ')
    }
    p.push(`C${wi},${(cy + half * 0.6).toFixed(1)} ${w},${(cy + half * 0.35).toFixed(1)} ${w},${(cy + half).toFixed(1)}`)
  }

  p.push(
    `V${bottom - R}`,
    `Q${w},${bottom} ${w - R},${bottom}`,   // esquina inf-der
    `H${left + R}`,
    `Q${left},${bottom} ${left},${bottom - R}`,  // esquina inf-izq
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

  // ── Íconos fijos; el indicador (círculo + curva) se desliza al activo ──
  const asideRef  = useRef<HTMLElement>(null)
  const navRef    = useRef<HTMLElement>(null)
  const activeRef = useRef<HTMLAnchorElement>(null)
  const cyRef     = useRef<number | null>(null)
  const rafRef    = useRef<number | null>(null)
  const firstRef  = useRef(true)
  const [dims, setDims] = useState({ h: 0 })
  const [cy, setCy]     = useState<number | null>(null)

  const setCyNow = useCallback((v: number | null) => { cyRef.current = v; setCy(v) }, [])

  const animarA = useCallback((to: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const from = cyRef.current
    if (from == null) { setCyNow(to); return }
    const dur = 320, t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / dur, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setCyNow(from + (to - from) * e)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [setCyNow])

  const medir = useCallback((animar: boolean) => {
    const aside = asideRef.current
    if (aside) setDims({ h: aside.clientHeight })
    if (!aside || !collapsed || !activeRef.current) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      setCyNow(null)
      return
    }
    const ar = aside.getBoundingClientRect()
    const er = activeRef.current.getBoundingClientRect()
    const to = er.top - ar.top + er.height / 2
    if (firstRef.current || !animar) { firstRef.current = false; setCyNow(to) }
    else animarA(to)
  }, [collapsed, animarA, setCyNow])

  useEffect(() => { medir(true) }, [pathname])          // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { medir(false) }, [collapsed, role])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onResize = () => medir(false)
    const nav = navRef.current
    window.addEventListener('resize', onResize)
    nav?.addEventListener('scroll', onResize, { passive: true })
    return () => {
      window.removeEventListener('resize', onResize)
      nav?.removeEventListener('scroll', onResize)
    }
  }, [medir])
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  const notchFill = isDark ? '#0a1628' : '#eef6ff'

  return (
    <aside
      ref={asideRef}
      style={{ background: notchFill }}
      className={cn(
        'relative flex flex-col h-screen transition-all duration-300 z-20',
        // margen derecho extra en comprimido para que el círculo flotante no toque el contenido
        collapsed ? 'w-[60px] mr-5' : 'w-[220px]',
      )}
    >
      {/* ── Fondo oscuro deformable (SVG) ───────────── */}
      <svg
        className="absolute inset-0 w-full h-full z-0 pointer-events-none transition-[all] duration-300"
        viewBox={`0 0 ${width} ${dims.h || 800}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d={buildPath(width, dims.h || 800, cy)} fill={RAIL_BG} />
      </svg>

      {/* ── Círculo cian flotante que se desliza al módulo activo ── */}
      {collapsed && cy != null && ActiveIcon && (
        <span
          style={{ top: cy, background: ACTIVE, boxShadow: '0 6px 16px rgba(33,185,247,0.5)' }}
          className="absolute right-[-23px] -translate-y-1/2 w-[50px] h-[50px] rounded-full flex items-center justify-center z-30 pointer-events-none"
        >
          <ActiveIcon className="w-[19px] h-[19px] text-white" />
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
      {/* Caja de ícono fija (w-11 h-10) → mismo tamaño/posición en colapsado y expandido */}
      <nav ref={navRef} className="relative z-10 flex-1 px-2 overflow-y-auto">
        <div className="pt-2 pb-10 space-y-2">
          {/* Toggle expandir/contraer (no es módulo, solo alterna el sidebar) */}
          <button
            type="button"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expandir' : 'Contraer'}
            className="relative flex items-center w-full rounded-md text-slate-400 hover:text-slate-100 hover:bg-white/[0.05] transition-colors mb-1"
          >
            <span className="w-11 h-10 flex items-center justify-center shrink-0">
              {collapsed
                ? <ChevronRight className="w-[18px] h-[18px]" />
                : <ChevronLeft className="w-[18px] h-[18px]" />}
            </span>
            {!collapsed && <span className="text-[12px] font-medium">Contraer</span>}
          </button>

          {visibleItems.map((item, i) => {
            if (item.type === 'section') {
              return collapsed
                ? <div key={i} className="my-1 mx-3 h-px bg-white/[0.06]" />
                : <p key={i} className="pt-3 pb-0.5 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 select-none">
                    {item.label}
                  </p>
            }

            const { href, label, icon: Icon, adminOnly } = item
            const isActive = pathname === href || pathname.startsWith(href + '/')

            // ── Activo + colapsado: placeholder (el círculo se dibuja aparte) ──
            if (isActive && collapsed) {
              return (
                <Link key={href} ref={activeRef} href={href} title={label} className="relative flex items-center">
                  <span className="w-11 h-10 flex items-center justify-center shrink-0">
                    <Icon className="w-[17px] h-[17px] opacity-0" />
                  </span>
                </Link>
              )
            }

            // ── Activo (expandido): círculo cian en la caja + label ──
            if (isActive) {
              return (
                <Link key={href} href={href} className="relative flex items-center pr-3 rounded-md text-[13px] font-medium text-white">
                  <span className="w-11 h-10 flex items-center justify-center shrink-0">
                    <span
                      style={{ background: ACTIVE, boxShadow: '0 4px 12px rgba(33,185,247,0.4)' }}
                      className="w-[34px] h-[34px] rounded-full flex items-center justify-center"
                    >
                      <Icon className="w-[17px] h-[17px] text-white" />
                    </span>
                  </span>
                  <span className="flex-1 truncate">{label}</span>
                  {adminOnly && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[#21b9f7]/20 text-[#7fd4fb] font-bold tracking-wide">ADMIN</span>
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
                  'relative flex items-center rounded-md text-[13px] font-medium transition-colors duration-150 group',
                  'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100',
                  !collapsed && 'pr-3',
                )}
              >
                <span className="w-11 h-10 flex items-center justify-center shrink-0">
                  <Icon className="w-[17px] h-[17px] text-slate-400 group-hover:text-slate-100" />
                </span>
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{label}</span>
                    {adminOnly && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-white/[0.08] text-slate-300 font-bold tracking-wide">ADMIN</span>
                    )}
                  </>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ── Footer ───────────────────────────────── */}
      <div className="relative z-10 flex-shrink-0 border-t border-white/[0.06] p-2 space-y-px">
        {/* Usuario */}
        <div className={cn(
          'flex items-center gap-2.5 px-2 py-1.5',
          collapsed && 'justify-center px-0',
        )}>
          <UserMenu collapsed={collapsed} onDark />
        </div>
      </div>
    </aside>
  )
}
