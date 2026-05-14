import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { QueryProvider } from '@/components/layout/QueryProvider'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await currentUser()
  const role = (user?.publicMetadata?.role as 'ADMIN' | 'VENDEDOR') ?? 'VENDEDOR'

  return (
    <QueryProvider>
      <div className="flex h-dvh overflow-hidden bg-background">
        {/* Sidebar — solo tablet y desktop */}
        <div className="hidden md:flex">
          <Sidebar role={role} />
        </div>

        {/* Contenido principal */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-container mx-auto pb-20 md:pb-6">
            {children}
          </div>
        </main>

        {/* Bottom nav — solo móvil */}
        <BottomNav role={role} />
      </div>
    </QueryProvider>
  )
}
