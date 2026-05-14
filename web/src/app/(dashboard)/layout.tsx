import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { QueryProvider } from '@/components/layout/QueryProvider'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Verificar que el usuario esté registrado en el sistema
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
  const { getToken } = await auth()
  const token = await getToken()

  let meOk = false
  try {
    const meRes = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
      cache: 'no-store',
    })
    meOk = meRes.ok // solo 2xx pasa
  } catch {
    meOk = false
  }

  // Cualquier respuesta no-200 o error de red → acceso denegado
  if (!meOk) {
    redirect('/no-autorizado')
  }

  // Obtener rol del usuario
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
