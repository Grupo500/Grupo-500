import {
  LayoutDashboard, TrendingUp, PieChart, Tag, Megaphone,
  UsersRound, CalendarDays, CalendarCheck, ShieldCheck, SlidersHorizontal, Receipt,
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
  { href: '/finanzas/cuotas',     label: 'Cuotas',             icon: Receipt },
  { href: '/finanzas/diario',     label: 'Reporte diario',     icon: CalendarDays },
  { href: '/finanzas/cierre',     label: 'Cierre mensual',     icon: CalendarCheck },
  { href: '/finanzas/calidad',    label: 'Control de calidad', icon: ShieldCheck },
  { href: '/finanzas/parametros', label: 'Parámetros',         icon: SlidersHorizontal },
]
