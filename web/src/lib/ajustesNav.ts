import { User, type LucideIcon } from 'lucide-react'

export interface AjustesTab {
  href: string
  label: string
  icon: LucideIcon
  adminOnly: boolean
}

export const AJUSTES_TABS: AjustesTab[] = [
  { href: '/ajustes',          label: 'Mi perfil', icon: User,     adminOnly: false },
]
