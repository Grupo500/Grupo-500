import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { VentasVista } from '@/components/ventas/VentasVista'

export default async function VentasPage() {
  const session = await auth()
  if ((session?.user as any)?.role !== 'ADMIN') redirect('/no-autorizado')

  return <VentasVista modo="admin" />
}
