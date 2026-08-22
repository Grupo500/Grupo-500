import { User, ShieldCheck, Bell, CreditCard, Building2, type LucideIcon } from 'lucide-react'

export type AjustesGrupo = 'Cuenta' | 'Marketing' | 'Administración'

export interface AjustesTab {
  href: string
  label: string
  icon: LucideIcon
  grupo: AjustesGrupo
  adminOnly: boolean
  /** Solo el equipo de marketing cobra freelance: a nadie más le aplica. */
  soloMarketing?: boolean
}

/**
 * Las secciones de Ajustes, agrupadas como las ve la gente (Hotman, 22-ago):
 * lo de la cuenta de cualquiera, lo que solo aplica a marketing y lo que solo
 * toca el admin. Es la navegación interna de la pantalla, no del sidebar.
 */
export const AJUSTES_TABS: AjustesTab[] = [
  { href: '/ajustes',                label: 'Perfil',         icon: User,        grupo: 'Cuenta',         adminOnly: false },
  { href: '/ajustes/seguridad',      label: 'Seguridad',      icon: ShieldCheck, grupo: 'Cuenta',         adminOnly: false },
  { href: '/ajustes/notificaciones', label: 'Notificaciones', icon: Bell,        grupo: 'Cuenta',         adminOnly: false },
  { href: '/ajustes/cobro',          label: 'Datos de cobro', icon: CreditCard,  grupo: 'Marketing',      adminOnly: false, soloMarketing: true },
  { href: '/ajustes/plataforma',     label: 'Plataforma',     icon: Building2,   grupo: 'Administración', adminOnly: true },
]
