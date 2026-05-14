import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function UsuariosLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  const role = (user?.publicMetadata?.role as string) ?? 'VENDEDOR'
  if (role !== 'ADMIN') redirect('/dashboard')
  return <>{children}</>
}
