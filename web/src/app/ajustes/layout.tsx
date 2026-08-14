import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { QueryProvider } from '@/components/layout/QueryProvider'
import type { Rol } from '@/lib/roles'

/**
 * Ajustes vive fuera de Ventas.
 *
 * Estaba dentro de `(dashboard)`, cuyo muro manda a `/inicio` a todo el que no
 * sea admin o asesor: el equipo de marketing oprimía Ajustes y rebotaba al
 * selector de módulos sin llegar nunca a su perfil. Su perfil, su foto y su
 * contraseña no son asunto de un área — los tiene cualquiera que entre a la
 * plataforma.
 *
 * El estudiante sí queda fuera: no es staff y tiene su propio módulo.
 */
export default async function AjustesLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const role = ((session.user as any).role ?? 'VENDEDOR') as Rol
  if (role === 'ESTUDIANTE') redirect('/examenes')

  return (
    <QueryProvider>
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
    </QueryProvider>
  )
}
