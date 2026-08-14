import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { QueryProvider } from '@/components/layout/QueryProvider'
import { SSEProvider } from '@/components/layout/SSEProvider'
import { esMarketing, type Rol } from '@/lib/roles'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const role = ((session.user as any).role ?? 'VENDEDOR') as Rol

  // Muro de acceso: Ventas es SOLO para admin/asesor. Un estudiante se va a
  // su módulo de exámenes; los roles de marketing (tienen su propia área, ver
  // /marketing) se van al selector de módulos.
  if (role === 'ESTUDIANTE') redirect('/examenes')
  if (esMarketing(role)) redirect('/inicio')

  return (
    <QueryProvider>
      <SSEProvider>
        {/* La marca cruza arriba de todo y el sidebar arranca debajo, no al
            revés: así el header existe también en celular, donde no hay
            sidebar, y las acciones acompañan a todas las pantallas del área
            en vez de solo al dashboard. */}
        <div className="flex h-dvh flex-col">
          <Header />

          <div className="flex min-h-0 flex-1">
            {/* Sidebar — solo tablet y desktop */}
            <div className="hidden md:flex">
              <Sidebar role={role} />
            </div>

            {/* Contenido principal */}
            <main className="flex-1 overflow-y-auto edu-bg-pattern">
              <div className="p-4 md:p-6 max-w-container mx-auto pb-20 md:pb-6">
                {children}
              </div>
            </main>

            {/* Bottom nav — solo móvil */}
            <BottomNav role={role} />
          </div>
        </div>
      </SSEProvider>
    </QueryProvider>
  )
}
