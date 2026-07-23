import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Flame, Sparkles } from 'lucide-react'

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

  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 text-center"
      style={{ background: buenDesempeno ? 'linear-gradient(160deg, #003060 0%, #2094ff 55%, #21b9f7 100%)' : 'linear-gradient(160deg, #1a2332 0%, #2c3e50 100%)' }}
    >
      <div className="w-36 h-36 rounded-full bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden shadow-2xl mb-5">
        <Image
          src="/brito/brito-hero.jpg"
          alt="Brito"
          width={144}
          height={144}
          className={`object-cover w-full h-full ${buenDesempeno ? '' : 'grayscale opacity-80'}`}
        />
      </div>

      <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1">
        {buenDesempeno ? '¡Muy bien!' : '¡Sigue practicando!'}
      </h1>
      <p className="text-sm text-white/75 mb-6">
        {correctas} de {total} correctas ({porcentaje}%)
      </p>

      <div className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-[0_16px_40px_-8px_rgba(0,30,60,0.45)] space-y-3 mb-6">
        <div className="flex items-center justify-between px-1">
          <span className="flex items-center gap-2 text-sm font-semibold text-[#001d3d]">
            <Sparkles className="w-4 h-4 text-amber-500" /> XP ganado
          </span>
          <span className="text-sm font-bold text-[#001d3d]">+{xp}</span>
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="flex items-center gap-2 text-sm font-semibold text-[#001d3d]">
            <Flame className="w-4 h-4 text-orange-500" /> Racha
          </span>
          <span className="text-sm font-bold text-[#001d3d]">{racha} {racha === 1 ? 'día' : 'días'}</span>
        </div>
      </div>

      <Link
        href="/brito/mapa"
        className="w-full max-w-xs block text-center bg-gradient-to-r from-[#ffb703] to-[#fb8500] hover:brightness-105 text-white font-semibold rounded-xl py-2.5 text-sm transition-all active:scale-[0.97]"
      >
        Continuar
      </Link>
    </main>
  )
}
