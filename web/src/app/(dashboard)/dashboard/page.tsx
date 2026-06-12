import { auth } from '@/auth'
import { AsesorDashboard } from '@/components/charts/AsesorDashboard'
import { DashboardWrapper } from '@/components/charts/DashboardWrapper'

export default async function DashboardPage() {
  const session = await auth().catch(() => null)
  const role    = (session?.user?.role as 'ADMIN' | 'VENDEDOR') ?? 'VENDEDOR'
  const isAdmin = role === 'ADMIN'

  if (!isAdmin) {
    return <AsesorDashboard />
  }

  const fullName  = session?.user?.name ?? session?.user?.email?.split('@')[0] ?? ''
  const firstName = fullName.split(' ')[0]
  const horaColombia = Number(
    new Intl.DateTimeFormat('es-CO', { hour: 'numeric', hour12: false, timeZone: 'America/Bogota' }).format(new Date())
  )
  const saludo = horaColombia < 12 ? 'Buenos días' : horaColombia < 18 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <DashboardWrapper
      firstName={firstName}
      saludo={saludo}
    />
  )
}
