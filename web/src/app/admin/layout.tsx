import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { QueryProvider } from '@/components/layout/QueryProvider'
import { SSEProvider } from '@/components/layout/SSEProvider'
import type { Rol } from '@/lib/roles'

/**
 * Administración es un área propia, al mismo nivel que Ventas, Marketing y
 * Finanzas: se entra desde el selector de módulos.
 *
 * Reúne lo que antes vivía dentro de Ventas con la etiqueta ADMIN —Ventas
 * generales, Usuarios y Brito—, que estaba ahí por herencia y no porque fuera
 * de Ventas: un vendedor nunca lo vio. Delante va un resumen que cruza las
 * áreas, que era lo único que no existía en ninguna parte.
 *
 * Monta SSEProvider porque Ventas generales escucha pagos en vivo.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const role = ((session.user as any).role ?? 'VENDEDOR') as Rol
  if (role !== 'ADMIN') redirect('/inicio')

  return (
    <QueryProvider>
      <SSEProvider>
        <div className="flex h-dvh flex-col">
          <Header />

          <div className="flex min-h-0 flex-1">
            <div className="hidden md:flex">
              <Sidebar role={role} />
            </div>

            <main className="flex-1 overflow-y-auto edu-bg-pattern">
              <div className="mx-auto max-w-container p-4 pb-20 md:p-6 md:pb-6">
                {children}
              </div>
            </main>

            <BottomNav role={role} />
          </div>
        </div>
      </SSEProvider>
    </QueryProvider>
  )
}
