import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { QueryProvider } from '@/components/layout/QueryProvider'
import { SSEProvider } from '@/components/layout/SSEProvider'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const role = ((session.user as any).role ?? 'VENDEDOR') as 'ADMIN' | 'VENDEDOR'

  return (
    <QueryProvider>
      <SSEProvider>
        <div className="flex h-dvh">
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
      </SSEProvider>
    </QueryProvider>
  )
}
