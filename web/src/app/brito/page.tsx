import Image from 'next/image'
import Link from 'next/link'
import { auth } from '@/auth'
import { ArrowLeft, Flame, Heart, Trophy } from 'lucide-react'

export const metadata = {
  title: 'Brito — Con Brito te vas a convertir en cerebrito',
  description: 'Practica ICFES en modo juego: lecciones cortas, racha, corazones y ranking.',
}

export default async function BritoLandingPage() {
  const session = await auth()
  const role = (session?.user as any)?.role as 'ADMIN' | 'VENDEDOR' | 'ESTUDIANTE' | undefined

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
          <Image src="/brito/brito-hero.jpg" alt="Brito" width={160} height={160} className="object-cover w-full h-full" priority />
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

          <div className="flex items-center justify-center gap-5 text-[#001d3d] mb-5">
            <span className="flex items-center gap-1.5 text-xs font-semibold"><Flame className="w-4 h-4 text-orange-500" /> Racha</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold"><Heart className="w-4 h-4 text-red-500" /> Corazones</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold"><Trophy className="w-4 h-4 text-amber-500" /> Ranking</span>
          </div>

          {role === 'ESTUDIANTE' ? (
            <Link
              href="/brito/mapa"
              className="w-full block text-center bg-gradient-to-r from-[#ffb703] to-[#fb8500] hover:brightness-105 text-white font-semibold rounded-xl py-2.5 text-sm transition-all active:scale-[0.97] shadow-[0_8px_20px_-6px_rgba(251,133,0,0.5)]"
            >
              Ir a mis lecciones
            </Link>
          ) : role === 'ADMIN' ? (
            <Link
              href="/brito-admin"
              className="w-full block text-center bg-gradient-to-r from-[#ffb703] to-[#fb8500] hover:brightness-105 text-white font-semibold rounded-xl py-2.5 text-sm transition-all active:scale-[0.97] shadow-[0_8px_20px_-6px_rgba(251,133,0,0.5)]"
            >
              Ir al panel de administración
            </Link>
          ) : (
            <div className="flex flex-col gap-2">
              <Link
                href="/brito/registro"
                className="w-full block text-center bg-gradient-to-r from-[#ffb703] to-[#fb8500] hover:brightness-105 text-white font-semibold rounded-xl py-2.5 text-sm transition-all active:scale-[0.97] shadow-[0_8px_20px_-6px_rgba(251,133,0,0.5)]"
              >
                Crear cuenta gratis
              </Link>
              <Link
                href="/sign-in"
                className="w-full block text-center border border-black/[0.10] hover:bg-black/[0.03] text-[#001d3d] font-medium rounded-xl py-2.5 text-sm transition-all active:scale-[0.97]"
              >
                Ya tengo cuenta
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
