'use client'

/**
 * El armazón de Ajustes (Hotman, 22-ago): el título con "Volver" a donde se
 * estaba, la navegación interna por secciones a la izquierda y la sección a
 * la derecha. El sidebar de la app no cambia: sigue en el área de origen.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { AJUSTES_TABS, type AjustesGrupo } from '@/lib/ajustesNav'
import { esMarketing, type Rol } from '@/lib/roles'
import { useOrigenAjustes } from '@/lib/origenAjustes'

const NOMBRE_AREA: Record<string, string> = {
  '/marketing': 'Marketing', '/finanzas': 'Finanzas', '/admin': 'Administración',
  '/dashboard': 'Ventas', '/estudiantes': 'Ventas', '/cuotas': 'Ventas', '/mis-ventas': 'Ventas',
  '/reportes': 'Ventas', '/cursos': 'Ventas', '/colegios': 'Ventas', '/simulacros': 'Ventas',
  '/formularios': 'Ventas', '/inicio': 'inicio',
}

function nombreDe(ruta: string): string {
  const base = Object.keys(NOMBRE_AREA).find(b => ruta === b || ruta.startsWith(b + '/'))
  return base ? NOMBRE_AREA[base] : 'inicio'
}

export function AjustesShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: sesion } = useSession()
  const role = (sesion?.user as { role?: Rol } | undefined)?.role
  const origen = useOrigenAjustes(role)

  const tabs = AJUSTES_TABS.filter(t =>
    (!t.adminOnly || role === 'ADMIN') &&
    (!t.soloMarketing || esMarketing(role)),
  )
  const grupos = [...new Set(tabs.map(t => t.grupo))] as AjustesGrupo[]
  const activo = (href: string) => (href === '/ajustes' ? pathname === '/ajustes' : pathname.startsWith(href))

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Ajustes"
        actions={
          <Link
            href={origen}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-lowest px-3 text-[12.5px] text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <ChevronLeft className="size-3.5" />
            Volver a {nombreDe(origen)}
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-[236px_1fr]">
        <nav className="flex h-max flex-col gap-0.5 rounded-2xl border border-outline-variant bg-surface-lowest p-2.5 max-md:flex-row max-md:overflow-x-auto" aria-label="Secciones de ajustes">
          {grupos.map(g => (
            <div key={g} className="contents">
              <p className="px-2.5 pb-1 pt-2.5 text-[10.5px] font-semibold text-on-surface-variant first:pt-1 max-md:hidden">{g}</p>
              {tabs.filter(t => t.grupo === g).map(t => {
                const Icono = t.icon
                const on = activo(t.href)
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={cn(
                      'flex items-center gap-2.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-[13px] transition-colors',
                      on ? 'bg-[#e8f3ff] font-semibold text-[#0b4f9c]' : 'text-on-surface hover:bg-surface-low',
                    )}
                  >
                    <Icono className={cn('size-4 shrink-0', on ? 'text-[#1a7de0]' : 'text-on-surface-variant')} />
                    {t.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="min-w-0 space-y-4">{children}</div>
      </div>
    </div>
  )
}
