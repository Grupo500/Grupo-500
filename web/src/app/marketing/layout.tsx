import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { QueryProvider } from '@/components/layout/QueryProvider'
import { entraAMarketing, type Rol } from '@/lib/roles'

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

  const role = ((session.user as any).role ?? 'VENDEDOR') as Rol

  if (!entraAMarketing(role)) redirect('/inicio')

  return (
    <QueryProvider>
      {/* Mismo header que el área de ventas: la marca cruza arriba de todo y
          el sidebar cuelga debajo. Al ser un área propia le corresponde la
          misma cabecera, y en celular —donde no hay sidebar— es la única
          marca de la pantalla. */}
      <div className="flex h-dvh flex-col">
        <Header />

        <div className="flex min-h-0 flex-1">
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
      </div>
    </QueryProvider>
  )
}
