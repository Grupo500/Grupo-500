import {
  LayoutDashboard, TrendingUp, PieChart, Tag, Megaphone,
  UsersRound, CalendarDays, CalendarCheck, ShieldCheck, SlidersHorizontal,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export interface FinanzasTab {
  href: string
  label: string
  icon: LucideIcon
  /** Sección anunciada pero sin construir: se muestra atenuada y no navega. */
  proximamente?: boolean
}

/** Secciones del área de Finanzas, en el orden en que se consultan. */
export const FINANZAS_TABS: FinanzasTab[] = [
  { href: '/finanzas',            label: 'Resumen',            icon: LayoutDashboard },
  { href: '/finanzas/evolucion',  label: 'Evolución y ritmo',  icon: TrendingUp },
  { href: '/finanzas/mix',        label: 'Mix comercial',      icon: PieChart },
  { href: '/finanzas/precio',     label: 'Precio y cambio',    icon: Tag },
  { href: '/finanzas/marketing',  label: 'Marketing y CAC',    icon: Megaphone },
  { href: '/finanzas/clientes',   label: 'Clientes RFV',       icon: UsersRound },
  { href: '/finanzas/diario',     label: 'Reporte diario',     icon: CalendarDays },
  // Gasto interno de la agencia: es la otra cara de las cifras de arriba, que
  // son ingresos, así que va junto a ellas y no en un módulo aparte.
  { href: '/finanzas/agencia',    label: 'Gastos de agencia',  icon: Wallet },
  { href: '/finanzas/cierre',     label: 'Cierre mensual',     icon: CalendarCheck },
  { href: '/finanzas/calidad',    label: 'Control de calidad', icon: ShieldCheck },
  { href: '/finanzas/parametros', label: 'Parámetros',         icon: SlidersHorizontal },
]
