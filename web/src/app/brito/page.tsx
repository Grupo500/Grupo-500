import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Flame, Heart, Trophy } from 'lucide-react'

export const metadata = {
  title: 'Brito — Con Brito te vas a convertir en cerebrito',
  description: 'Practica ICFES en modo juego: lecciones cortas, racha, corazones y ranking.',
}

export default function BritoLandingPage() {
  return (
    <main
      className="min-h-dvh relative overflow-hidden flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'linear-gradient(160deg, #003060 0%, #2094ff 55%, #21b9f7 100%)' }}
    >
      <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-[#ffb703]/25 blur-3xl pointer-events-none" aria-hidden />
      <div className="absolute -bottom-28 -right-16 w-96 h-96 rounded-full bg-[#95daff]/20 blur-3xl pointer-events-none" aria-hidden />

      <Link href="/inicio" className="absolute top-4 left-4 z-10 inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Volver
      </Link>

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <div className="w-40 h-40 rounded-full bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden shadow-2xl">
          <Image src="/brito/brito-normal.jpg" alt="Brito" width={160} height={160} className="object-cover w-full h-full" priority />
        </div>

        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">Brito</h1>
          <p className="text-sm text-white/80 mt-1 font-medium">Con Brito te vas a convertir en cerebrito</p>
        </div>

        <div className="w-full bg-white rounded-2xl p-5 shadow-[0_16px_40px_-8px_rgba(0,30,60,0.45)] border border-white/60">
          <p className="text-sm text-[#2a4172] leading-relaxed mb-4">
            Practica para el ICFES con lecciones cortas tipo juego: gana XP, mantén tu racha,
            cuida tus corazones y sube en el ranking.
          </p>

          <div className="flex items-center justify-center gap-5 text-[#001d3d] mb-4">
            <span className="flex items-center gap-1.5 text-xs font-semibold"><Flame className="w-4 h-4 text-orange-500" /> Racha</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold"><Heart className="w-4 h-4 text-red-500" /> Corazones</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold"><Trophy className="w-4 h-4 text-amber-500" /> Ranking</span>
          </div>

          <div className="w-full rounded-xl bg-surface-high text-center py-3 px-4">
            <p className="text-sm font-semibold text-[#001d3d]">Próximamente</p>
            <p className="text-xs text-[#5a74a8] mt-0.5">Estamos construyendo el juego. Vuelve pronto.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
