import { CalendarDays, Link2, Clapperboard, Share2, Wallet, type LucideIcon } from 'lucide-react'

export interface MarketingTab {
  href: string
  label: string
  icon: LucideIcon
}

/** Secciones del área de Marketing, en el orden en que se consultan. */
export const MARKETING_TABS: MarketingTab[] = [
  { href: '/marketing',               label: 'Calendario',       icon: CalendarDays },
  { href: '/marketing/entregables',   label: 'Entregables',      icon: Link2 },
  // Va después de lo que se produce y antes de las herramientas: el cobro es
  // la consecuencia del trabajo, no una herramienta aparte.
  { href: '/marketing/cobros',        label: 'Cobros',           icon: Wallet },
  { href: '/marketing/panel-edicion', label: 'Panel de Edición', icon: Clapperboard },
  { href: '/marketing/redes',         label: 'Redes',            icon: Share2 },
]
