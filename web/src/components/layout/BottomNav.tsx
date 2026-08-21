'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserMenu } from '@/components/layout/UserMenu'
import { useEffect, useState } from 'react'
import {
  Home, Users,
  Menu, X, BookOpen, School,
  FileBarChart2, BarChart3,
  ClipboardList, Settings, Receipt, Link2, CalendarCheck,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FINANZAS_TABS } from '@/lib/finanzasNav'
import { MARKETING_TABS } from '@/lib/marketingNav'
import { ADMIN_TABS } from '@/lib/adminNav'
import { esMarketing, type Rol } from '@/lib/roles'
import { BarraJoroba, type PestanaBarra } from './BarraJoroba'



// `soloAsesor` es lo contrario de `adminOnly`: módulos personales del vendedor.
// Este nav es exclusivo de Ventas — MARKETING vive en su propia área (ver
// `enMarketing` más abajo), nunca ve estos ítems.
type NavItem = { href: string; label: string; icon: LucideIcon; adminOnly: boolean; soloAsesor?: boolean }

// Las ventas son el uso diario del asesor en el celular, así que ocupan un
// puesto fijo en la barra; Cursos se consulta poco y pasa al menú "Más".
const primaryItems: NavItem[] = [
  { href: '/dashboard',   label: 'Inicio',     icon: Home,            adminOnly: false },
  { href: '/estudiantes', label: 'Estudiantes', icon: Users,           adminOnly: false },
  { href: '/mis-ventas',  label: 'Mis ventas',  icon: Receipt,         adminOnly: false, soloAsesor: true },
  { href: '/reportes',     label: 'Analíticas',  icon: BarChart3,       adminOnly: false },
]

// Salida al selector de módulos. Va en "Más" en TODAS las áreas: en celular
// no hay sidebar ni header, así que sin esta entrada se entra a un área y no
// se sale — pasaba en Ventas, donde la barra se convierte en las pestañas del
// área y "Más" quedaba vacío.

const moreItems: NavItem[] = [
  { href: '/cursos',          label: 'Cursos',           icon: BookOpen,      adminOnly: false },
  { href: '/enlaces',         label: 'Enlaces',          icon: Link2,         adminOnly: false, soloAsesor: true },
  { href: '/colegios',        label: 'Colegios',         icon: School,        adminOnly: false },
  { href: '/simulacros',      label: 'Simulacros',       icon: FileBarChart2, adminOnly: false },
  { href: '/formularios',     label: 'Formularios',      icon: ClipboardList, adminOnly: false },
]

// Cuando el href de un ítem (ej. la pestaña "raíz" de un área, '/marketing')
// es prefijo del href de otro ('/marketing/entregables'), comparar por
// prefijo a secas marca a los dos como activos. Se resuelve quedándose con
// la coincidencia exacta si existe, o si no, con el href más específico
// (el más largo) entre los que matchean por prefijo.
function hrefActivo(pathname: string, hrefs: string[]): string | undefined {
  let mejor: string | undefined
  for (const href of hrefs) {
    if (pathname === href) return href
    if (pathname.startsWith(href + '/') && (!mejor || href.length > mejor.length)) mejor = href
  }
  return mejor
}

interface BottomNavProps { role?: Rol }

export function BottomNav({ role = 'VENDEDOR' }: BottomNavProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const [sheetVisible, setSheetVisible] = useState(false)

  useEffect(() => {
    if (moreOpen) {
      requestAnimationFrame(() => setSheetVisible(true))
    } else {
      setSheetVisible(false)
    }
  }, [moreOpen])

  const porRol = (i: NavItem) => (!i.adminOnly || role === 'ADMIN') && (!i.soloAsesor || role !== 'ADMIN')
  // Dentro de Finanzas/Marketing la barra muestra las secciones del área, no
  // las de Ventas: son áreas distintas y mezclarlas deja al usuario sin forma
  // de moverse por donde está.
  const enFinanzas = pathname === '/finanzas' || pathname.startsWith('/finanzas/')
  const finanzasDisponibles = FINANZAS_TABS.filter(t => !t.proximamente)
  const enMarketing = pathname === '/marketing' || pathname.startsWith('/marketing/')
  const enVentas = ['/mis-ventas', '/cuotas'].some(b => pathname === b || pathname.startsWith(b + '/'))
  const enAdmin = pathname === '/admin' || pathname.startsWith('/admin/')
  // Ventas generales se mudó a Administración; al admin aquí solo le queda Cuotas.
  const ventasTabs = role === 'ADMIN'
    ? [{ href: '/cuotas', label: 'Cuotas', icon: CalendarCheck, adminOnly: false }]
    : [{ href: '/mis-ventas', label: 'Mis ventas', icon: Receipt, adminOnly: false }, { href: '/cuotas', label: 'Cuotas', icon: CalendarCheck, adminOnly: false }]

  // Ventas no es un área aparte como Finanzas o Marketing: es una sección de
  // la app. Por eso, aunque la barra muestre sus pestañas, los módulos de
  // siempre siguen a mano en vez de dejar al usuario encerrado.
  const desplazadosPorVentas = primaryItems
    .filter(porRol)
    .filter(i => !ventasTabs.some(t => t.href === i.href))

  // Todo lo que el área podría enseñar en la barra, en orden de importancia.
  const primariasDelArea: NavItem[] = enAdmin
    ? ADMIN_TABS.map(t => ({ href: t.href, label: t.label, icon: t.icon, adminOnly: true }))
    : enFinanzas
    ? finanzasDisponibles.map(t => ({ href: t.href, label: t.label, icon: t.icon, adminOnly: true }))
    : enMarketing
    ? MARKETING_TABS.map(t => ({ href: t.href, label: t.label, icon: t.icon, adminOnly: false }))
    : enVentas
    ? [...ventasTabs, ...desplazadosPorVentas]
    : primaryItems.filter(porRol)

  // Cuatro módulos y "Más", siempre, en todas las áreas (Hotman, 21-ago):
  // antes cada área decidía cuántas pestañas caben y la barra cambiaba de una
  // pantalla a otra. Lo que no entra en los cuatro se va al panel.
  const visiblePrimary = primariasDelArea.slice(0, 4)
  const fueraDeLaBarra = primariasDelArea.slice(4)

  // Sin "Inicio": el header ya lleva el botón de la casita y el logo, los dos
  // a /inicio, y estaban siempre a la vista. Repetirlo aquí gastaba una casilla
  // del panel en un atajo que ya se tenía (Hotman, 21-ago).
  const visibleMore = [
    ...fueraDeLaBarra,
    ...(enAdmin || enFinanzas || enMarketing ? [] : moreItems.filter(porRol)),
  ]
  const hrefActivoActual = hrefActivo(pathname, [...visiblePrimary, ...visibleMore].map(i => i.href))
  const isMoreActive = visibleMore.some(i => i.href === hrefActivoActual)
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

      {/* Sheet "Más" — igual que en el widget aprobado: de borde a borde,
          pegada al fondo, y POR ENCIMA de la barra: una hoja que sube desde
          abajo nunca queda por debajo de la navegación (Hotman, 21-ago). */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 md:hidden rounded-t-[26px] overflow-hidden shadow-[0_-12px_40px_-12px_rgba(0,29,61,0.4)] transition-transform duration-[450ms] ease-[cubic-bezier(.32,.9,.28,1)]',
          sheetVisible ? 'translate-y-0' : 'translate-y-full pointer-events-none',
        )}
        style={{
          background: 'var(--surface-lowest)',
          paddingBottom: 'env(safe-area-inset-bottom)',
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
        {visibleMore.length > 0 && (
        <div className="grid grid-cols-4 gap-2 p-4">
          {visibleMore.map((item, i) => {
            const Icon = item.icon
            const isActive = item.href === hrefActivoActual
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
        )}

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
          <Link
            href="/ajustes"
            onClick={handleClose}
            className="w-9 h-9 rounded-2xl bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-all active:scale-90"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* ── La barra, con joroba ── */}
      <BarraJoroba
        pestanas={[
          ...visiblePrimary.map<PestanaBarra>(item => ({
            key:   item.href,
            label: item.label,
            icon:  item.icon,
            href:  item.href,
            activa: item.href === hrefActivoActual,
          })),
          // Las tres rayas van de últimas: ahí vive "Más" y ahí está el pulgar
          // cuando se sostiene el teléfono (Hotman, 21-ago).
          {
            key:   '__mas__',
            label: 'Más',
            icon:  Menu,
            onClick: () => setMoreOpen(o => !o),
            activa: moreOpen || isMoreActive,
          },
        ]}
      />
    </>
  )
}
