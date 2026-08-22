'use client'

/**
 * Plataforma: lo que solo toca el admin, reunido y enlazado desde un mismo
 * sitio (Hotman, 22-ago). Cada pieza ya vive en su pantalla; aquí está la
 * puerta y una línea de para qué sirve.
 */

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Users, Share2, FolderOpen, RefreshCw, KeyRound, Database, ArrowRight } from 'lucide-react'

const PIEZAS = [
  { href: '/admin/usuarios',  icono: Users,      de: '#15203a', a: '#2a3a5e', titulo: 'Usuarios y accesos',   texto: 'Crear cuentas, cambiar roles, suspender y reactivar.' },
  { href: '/marketing/redes', icono: Share2,     de: '#be185d', a: '#ec4899', titulo: 'Meta (Instagram y Facebook)', texto: 'Credenciales de la App de Meta y páginas vinculadas para Redes.' },
  { href: '/marketing/cobros', icono: FolderOpen, de: '#0f766e', a: '#14b8a6', titulo: 'Cuentas de cobro en Drive', texto: 'Cada sábado a las 11:59 pm sale una cuenta por freelance con lo aprobado de la semana.' },
  { href: '/cursos',          icono: RefreshCw,  de: '#2094ff', a: '#4361ee', titulo: 'Hotmart',               texto: 'Sincronización de cursos y ventas.' },
  { href: '/admin',           icono: KeyRound,   de: '#6d28d9', a: '#8b5cf6', titulo: 'Claves de API',         texto: 'Accesos para integraciones externas: crear, ver y revocar.' },
  { href: '/admin',           icono: Database,   de: '#d97706', a: '#f59e0b', titulo: 'Respaldos de la base',  texto: 'Copia completa cada noche a las 23:59 en el Drive de la cuenta dueña; se conservan 60.' },
]

export default function PlataformaPage() {
  const { data: sesion } = useSession()
  if (sesion && (sesion.user as { role?: string }).role !== 'ADMIN') {
    return <p className="rounded-2xl border border-outline-variant bg-surface-lowest p-5 text-[13px] text-on-surface-variant">Esta sección es solo para administradores.</p>
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {PIEZAS.map(p => {
        const Icono = p.icono
        return (
          <Link key={p.titulo} href={p.href} className="group flex flex-col gap-2 rounded-2xl border border-outline-variant bg-surface-lowest p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40">
            <span className="grid size-9 place-items-center rounded-xl text-white" style={{ background: `linear-gradient(135deg, ${p.de}, ${p.a})` }}><Icono className="size-4" /></span>
            <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-on-surface">{p.titulo}<ArrowRight className="size-3.5 text-on-surface-variant transition-transform group-hover:translate-x-0.5" /></span>
            <span className="text-[11.5px] leading-relaxed text-on-surface-variant">{p.texto}</span>
          </Link>
        )
      })}
    </div>
  )
}
