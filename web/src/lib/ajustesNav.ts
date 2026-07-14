import { User, Pen, KeyRound, type LucideIcon } from 'lucide-react'

export interface AjustesTab {
  href: string
  label: string
  icon: LucideIcon
  adminOnly: boolean
}

export const AJUSTES_TABS: AjustesTab[] = [
  { href: '/ajustes',          label: 'Mi perfil', icon: User,     adminOnly: false },
  { href: '/ajustes/firma',    label: 'Firma',     icon: Pen,      adminOnly: true  },
  { href: '/ajustes/api-keys', label: 'API Keys',  icon: KeyRound, adminOnly: true  },
]
