import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { QueryProvider } from '@/components/layout/QueryProvider'

/**
 * Marketing es un área propia, al mismo nivel que Ventas, Simulacros, Brito
 * y Finanzas: se entra desde el selector de módulos, no desde adentro de
 * Ventas.
 *
 * Reutiliza el Sidebar y el BottomNav de la app, que al detectar una ruta
 * `/marketing` cambian solos a la navegación del área.
 */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const role = ((session.user as any).role ?? 'VENDEDOR') as 'ADMIN' | 'VENDEDOR' | 'MARKETING' | 'EDITOR' | 'COMMUNITY' | 'ESTUDIANTE'

  if (role !== 'ADMIN' && role !== 'MARKETING' && role !== 'EDITOR' && role !== 'COMMUNITY') redirect('/inicio')

  return (
    <QueryProvider>
      <div className="flex h-dvh">
        <div className="hidden md:flex">
          <Sidebar role={role} />
        </div>

        <main className="flex-1 overflow-y-auto edu-bg-pattern">
          <div className="p-4 md:p-6 max-w-container mx-auto pb-20 md:pb-6">
            {children}
          </div>
        </main>

        <BottomNav role={role} />
      </div>
    </QueryProvider>
  )
}
