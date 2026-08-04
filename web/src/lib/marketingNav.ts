import { CalendarDays, Link2, FileText, Clapperboard, type LucideIcon } from 'lucide-react'

export interface MarketingTab {
  href: string
  label: string
  icon: LucideIcon
}

/** Secciones del área de Marketing, en el orden en que se consultan. */
export const MARKETING_TABS: MarketingTab[] = [
  { href: '/marketing',               label: 'Calendario',       icon: CalendarDays },
  { href: '/marketing/entregables',   label: 'Entregables',      icon: Link2 },
  { href: '/marketing/guiones',       label: 'Guiones',          icon: FileText },
  { href: '/marketing/panel-edicion', label: 'Panel de Edición', icon: Clapperboard },
]
