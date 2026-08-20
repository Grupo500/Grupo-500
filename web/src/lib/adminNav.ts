import { LayoutDashboard, Receipt, ShieldCheck, Gamepad2, KeyRound, type LucideIcon } from 'lucide-react'

export interface AdminTab {
  href: string
  label: string
  icon: LucideIcon
}

/**
 * Secciones del área de Administración.
 *
 * Aquí vive lo que antes estaba dentro de Ventas marcado "ADMIN": Ventas
 * generales, Usuarios y Brito. Estaban ahí por herencia, no porque fueran de
 * Ventas — un vendedor nunca los vio.
 */
export const ADMIN_TABS: AdminTab[] = [
  { href: '/admin',          label: 'Resumen',          icon: LayoutDashboard },
  { href: '/admin/ventas',   label: 'Ventas generales', icon: Receipt },
  { href: '/admin/usuarios', label: 'Usuarios',         icon: ShieldCheck },
  { href: '/admin/brito',    label: 'Brito',            icon: Gamepad2 },
  // API Keys vivía en Ajustes: es configuración de la EMPRESA, no del perfil
  // personal de nadie.
  { href: '/admin/api-keys', label: 'API Keys',         icon: KeyRound },
]
