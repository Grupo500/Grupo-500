import { LayoutDashboard, Receipt, ShieldCheck, Gamepad2, Pen, KeyRound, type LucideIcon } from 'lucide-react'

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
  // Firma y API Keys vivían en Ajustes: son configuración de la EMPRESA
  // (la firma de los certificados, las llaves de integraciones), no del
  // perfil personal de nadie — pedido de Hotman, 19-ago.
  { href: '/admin/firma',    label: 'Firma',            icon: Pen },
  { href: '/admin/api-keys', label: 'API Keys',         icon: KeyRound },
]
