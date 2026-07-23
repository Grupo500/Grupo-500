import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trophy, Medal } from 'lucide-react'
import { obtenerRanking, obtenerEstudianteIdActual } from '../acciones'

const MEDALLA = ['text-amber-400', 'text-slate-300', 'text-amber-700']

export default async function RankingBritoPage() {
  const session = await auth()
  if (!['ESTUDIANTE', 'ADMIN'].includes((session?.user as any)?.role)) redirect('/brito')

  const [ranking, miId] = await Promise.all([obtenerRanking(), obtenerEstudianteIdActual()])

  return (
    <main className="min-h-dvh" style={{ background: 'linear-gradient(180deg, #003060 0%, #0b1f3a 100%)' }}>
      <div className="max-w-lg mx-auto px-4 py-6">
        <Link href="/brito/mapa" className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver al mapa
        </Link>

        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h1 className="text-xl font-bold text-white">Ranking semanal</h1>
        </div>
        <p className="text-xs text-white/50 mb-6">XP ganado en los últimos 7 días · Global</p>

        {ranking.length === 0 ? (
          <p className="text-sm text-white/60 text-center mt-10">Todavía no hay actividad esta semana. ¡Sé el primero!</p>
        ) : (
          <div className="space-y-2">
            {ranking.map(r => {
              const esYo = r.estudianteId === miId
              return (
                <div
                  key={r.estudianteId}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${esYo ? 'bg-[#ffb703]/15 border-[#ffb703]/40' : 'bg-white/5 border-white/10'}`}
                >
                  <span className={`w-7 text-center font-bold text-sm ${r.posicion <= 3 ? MEDALLA[r.posicion - 1] : 'text-white/50'}`}>
                    {r.posicion <= 3 ? <Medal className="w-4 h-4 inline" /> : r.posicion}
                  </span>
                  <span className={`flex-1 text-sm font-medium truncate ${esYo ? 'text-white' : 'text-white/85'}`}>
                    {r.nombre}{esYo && ' (tú)'}
                  </span>
                  <span className="text-sm font-bold text-amber-300">{r.xpSemana} XP</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
