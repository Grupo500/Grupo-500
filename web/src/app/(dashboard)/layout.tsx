import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { QueryProvider } from '@/components/layout/QueryProvider'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId, getToken } = await auth()
  if (!userId) redirect('/sign-in')

  // ── VERIFICACIÓN OBLIGATORIA: el usuario debe estar registrado en la DB ──
  // Esta es la puerta de seguridad principal. Sin importar cómo llegó el
  // usuario al dashboard, si no está en la DB no entra. Punto.
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
  const token = await getToken()

  let registrado = false
  let role: 'ADMIN' | 'VENDEDOR' = 'VENDEDOR'

  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
      cache: 'no-store',
    })
    if (res.ok) {
      registrado = true
      // Obtener rol desde Clerk publicMetadata (siempre sincronizado al registrar)
      const user = await currentUser()
      role = (user?.publicMetadata?.role as 'ADMIN' | 'VENDEDOR') ?? 'VENDEDOR'
    }
  } catch {
    registrado = false
  }

  if (!registrado) {
    redirect('/no-autorizado')
  }

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
