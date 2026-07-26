import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Nunito } from 'next/font/google'

const nunito = Nunito({ subsets: ['latin'], weight: ['400', '600', '700', '800'] })

export default async function ResultadoLeccionPage({
  searchParams,
}: {
  searchParams: Promise<{ correctas?: string; total?: string; xp?: string; racha?: string }>
}) {
  const session = await auth()
  if (!['ESTUDIANTE', 'ADMIN'].includes((session?.user as any)?.role)) redirect('/brito')

  const sp = await searchParams
  const correctas = Number(sp.correctas ?? 0)
  const total = Number(sp.total ?? 0)
  const xp = Number(sp.xp ?? 0)
  const racha = Number(sp.racha ?? 0)
  const porcentaje = total > 0 ? Math.round((correctas / total) * 100) : 0
  const buenDesempeno = porcentaje >= 70

  const acento = buenDesempeno
    ? { color: '#22C56E', oscuro: '#159354' }
    : { color: '#F5A623', oscuro: '#C97E1E' }

  return (
    <main
      className={`${nunito.className} flex min-h-dvh flex-col items-center justify-center px-4 py-10 text-center animate-fade-in`}
      style={{ background: '#EEF2F7', color: '#2B2B28' }}
    >
      <div className="flex w-full max-w-sm flex-col items-center animate-card-enter">
        <div
          className="mb-5 h-32 w-32 overflow-hidden rounded-full border-4 border-white"
          style={{ boxShadow: `0 10px 26px -6px ${acento.color}55` }}
        >
          <Image
            src="/brito/brito-hero.jpg"
            alt="Brito"
            width={128}
            height={128}
            className={`h-full w-full object-cover ${buenDesempeno ? '' : 'grayscale'}`}
          />
        </div>

        <h1 className="mb-1 text-2xl font-bold tracking-tight">
          {buenDesempeno ? '¡Muy bien!' : '¡Sigue practicando!'}
        </h1>
        <p className="mb-6 text-sm font-medium text-[#6b6a63]">
          {correctas} de {total} correctas ({porcentaje}%)
        </p>

        <div className="mb-6 w-full space-y-2.5">
          <Fila icono="/brito/icons/xp.png" etiqueta="XP ganado" valor={`+${xp}`} />
          <Fila icono="/brito/icons/racha.png" etiqueta="Racha" valor={`${racha} ${racha === 1 ? 'día' : 'días'}`} />
        </div>

        <Link
          href="/brito/mapa"
          className="w-full rounded-full py-3.5 text-center text-sm font-bold text-white transition-all active:translate-y-[2px]"
          style={{ background: acento.color, boxShadow: `0 4px 0 ${acento.oscuro}` }}
        >
          Continuar
        </Link>
      </div>
    </main>
  )
}

function Fila({ icono, etiqueta, valor }: { icono: string; etiqueta: string; valor: string }) {
  return (
    <div
      className="flex items-center justify-between rounded-2xl bg-white px-4 py-3.5"
      style={{ boxShadow: '0 2px 10px rgba(40,30,10,0.06)' }}
    >
      <span className="flex items-center gap-2.5 text-sm font-semibold text-[#2B2B28]">
        <img src={icono} alt="" className="h-6 w-6 object-contain" /> {etiqueta}
      </span>
      <span className="text-[15px] font-bold text-[#1E5FA8]">{valor}</span>
    </div>
  )
}
