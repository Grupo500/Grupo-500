import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function UsuariosLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const role    = (session?.user?.role ?? 'VENDEDOR') as string
  if (role !== 'ADMIN') redirect('/dashboard')
  return <>{children}</>
}
