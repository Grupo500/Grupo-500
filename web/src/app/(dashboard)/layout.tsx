import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { QueryProvider } from '@/components/layout/QueryProvider'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Obtener rol del usuario desde el backend
  // Por ahora usamos metadata de Clerk
  const user = await currentUser()
  const role = (user?.publicMetadata?.role as 'ADMIN' | 'VENDEDOR') ?? 'VENDEDOR'

  return (
    <QueryProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar role={role} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-container mx-auto">
            {children}
          </div>
        </main>
      </div>
    </QueryProvider>
  )
}
