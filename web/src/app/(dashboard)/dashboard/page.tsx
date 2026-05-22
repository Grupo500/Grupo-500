import { auth } from '@/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { Bell } from 'lucide-react'
import { RefreshButton } from '@/components/ui/RefreshButton'
import Image from 'next/image'
import { Poppins } from 'next/font/google'
import { DashboardAnalytics } from '@/components/charts/DashboardAnalytics'
import { AsesorDashboard } from '@/components/charts/AsesorDashboard'

const poppins = Poppins({ subsets: ['latin'], weight: ['700'] })

export default async function DashboardPage() {
  const session = await auth().catch(() => null)
  const role    = (session?.user?.role as 'ADMIN' | 'VENDEDOR') ?? 'VENDEDOR'
  const isAdmin = role === 'ADMIN'

  if (!isAdmin) {
    // Vista asesor — totalmente client-side con TanStack Query + SSE real-time
    return <AsesorDashboard />
  }

  // Vista admin
  const fullName  = session?.user?.name ?? session?.user?.email?.split('@')[0] ?? ''
  const firstName = fullName.split(' ')[0]
  const horaColombia = Number(
    new Intl.DateTimeFormat('es-CO', { hour: 'numeric', hour12: false, timeZone: 'America/Bogota' }).format(new Date())
  )
  const saludo = horaColombia < 12 ? 'Buenos días' : horaColombia < 18 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {session?.user?.image && (
            <Image
              src={session.user.image}
              alt={firstName}
              width={46}
              height={46}
              className="rounded-full md:hidden flex-shrink-0 ring-2 ring-[#2094ff]/25"
            />
          )}
          <h1 className={`${poppins.className} text-[22px] font-bold text-on-surface tracking-tight leading-tight`}>
            <span className="md:hidden">{saludo},<br />{firstName} 👋</span>
            <span className="hidden md:inline">{saludo}, {firstName} 👋</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="w-9 h-9 rounded-xl bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors relative">
            <Bell className="w-4 h-4" />
          </button>
          <RefreshButton />
        </div>
      </div>

      <DashboardAnalytics />
    </div>
  )
}
