import {
  LayoutDashboard, TrendingUp, PieChart, Tag, Megaphone,
  UsersRound, CalendarDays, CalendarCheck, ShieldCheck, SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'

export interface FinanzasTab {
  href: string
  label: string
  icon: LucideIcon
  /** Sección todavía sin construir: se muestra atenuada y no navega. */
  proximamente?: boolean
}

/**
 * Secciones del área de Finanzas. Las que dependen de datos que aún no
 * entran a la base (inversión publicitaria, precios oficiales con vigencia)
 * quedan visibles pero marcadas: esconderlas haría parecer que el área está
 * completa cuando no lo está.
 */
export const FINANZAS_TABS: FinanzasTab[] = [
  { href: '/finanzas',                  label: 'Resumen',           icon: LayoutDashboard },
  { href: '/finanzas/evolucion',        label: 'Evolución y ritmo', icon: TrendingUp },
  { href: '/finanzas/mix',              label: 'Mix comercial',     icon: PieChart },
  { href: '/finanzas/cierre',           label: 'Cierre mensual',    icon: CalendarCheck },
  { href: '/finanzas/precio',           label: 'Precio y cambio',   icon: Tag,             proximamente: true },
  { href: '/finanzas/marketing',        label: 'Marketing y CAC',   icon: Megaphone,       proximamente: true },
  { href: '/finanzas/clientes',         label: 'Clientes RFV',      icon: UsersRound,      proximamente: true },
  { href: '/finanzas/diario',           label: 'Reporte diario',    icon: CalendarDays,    proximamente: true },
  { href: '/finanzas/calidad',          label: 'Control de calidad', icon: ShieldCheck,    proximamente: true },
  { href: '/finanzas/parametros',       label: 'Parámetros',        icon: SlidersHorizontal, proximamente: true },
]
