import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ArrowLeft, Trophy } from 'lucide-react'
import { cop, etiquetaQuincena, iniciales, listaQuincenas, quincenaActual } from '@/lib/contabilidadMarketing'
import SelectorQuincena from '../SelectorQuincena'
import Consolidado from '../Consolidado'

export const dynamic = 'force-dynamic'

const MEDALLA = ['🥇', '🥈', '🥉']

// Panel de cofundador (solo ADMIN): la misma vista de contabilidad en modo
// lectura, más el ranking de ingresos del equipo.
export default async function CofundadorPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const session = await auth()
  if (((session?.user as any)?.role ?? '') !== 'ADMIN') redirect('/marketing/contabilidad')

  const quincenasConDatos = await prisma.contabRegistro.findMany({ distinct: ['quincena'], select: { quincena: true } })
  const quincenas = listaQuincenas(quincenasConDatos.map(r => r.quincena))
  const { q } = await searchParams
  const quincena = q && /^\d{4}-\d{2}-Q[12]$/.test(q) ? q : quincenaActual()

  // Ranking de ingresos: quincena seleccionada e histórico total
  const [regsQuincena, regsHistorico] = await Promise.all([
    prisma.contabRegistro.groupBy({
      by: ['personaId'], where: { quincena, rechazado: false }, _sum: { valor: true },
    }),
    prisma.contabRegistro.groupBy({
      by: ['personaId'], where: { rechazado: false }, _sum: { valor: true },
    }),
  ])
  const personas = await prisma.contabPersona.findMany({
    where: { id: { in: regsHistorico.map(r => r.personaId) } },
    include: { dept: true },
  })
  const porId = new Map(personas.map(p => [p.id, p]))
  const quincenaPorId = new Map(regsQuincena.map(r => [r.personaId, r._sum.valor ?? 0]))
  const ranking = regsHistorico
    .map(r => ({
      persona: porId.get(r.personaId)!,
      historico: r._sum.valor ?? 0,
      enQuincena: quincenaPorId.get(r.personaId) ?? 0,
    }))
    .filter(r => r.persona)
    .sort((a, b) => b.historico - a.historico)
    .slice(0, 15)

  return (
    <div className="space-y-5 animate-fade-in">
      <Link href={`/marketing/contabilidad?q=${quincena}`}
        className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface">
        <ArrowLeft className="w-4 h-4" /> Contabilidad
      </Link>

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Panel de cofundador</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Lectura general + ranking de ingresos · {etiquetaQuincena(quincena)}
          </p>
        </div>
        <SelectorQuincena quincenas={quincenas} actual={quincena} />
      </div>

      {/* Ranking de ingresos */}
      <div>
        <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-[#c9971a]" /> Ranking de ingresos (histórico)
        </h2>
        <div className="bg-surface-lowest border border-outline-variant rounded-xl divide-y divide-outline-variant">
          {ranking.map((r, i) => (
            <div key={r.persona.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-7 text-center text-sm font-bold text-on-surface-variant tabular-nums">
                {MEDALLA[i] ?? i + 1}
              </span>
              {r.persona.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.persona.fotoUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              ) : (
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                  style={{ background: `linear-gradient(150deg, ${r.persona.dept.gradiente})` }}>
                  {iniciales(r.persona.nombre)}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-on-surface truncate">{r.persona.nombre}</p>
                <p className="text-xs text-on-surface-variant">{r.persona.dept.nombre}</p>
              </div>
              {r.enQuincena > 0 && (
                <span className="text-xs text-on-surface-variant tabular-nums">esta quincena {cop(r.enQuincena)}</span>
              )}
              <b className="text-sm text-on-surface tabular-nums">{cop(r.historico)}</b>
            </div>
          ))}
          {ranking.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-on-surface-variant">Sin datos todavía.</p>
          )}
        </div>
      </div>

      {/* La misma vista de contabilidad, sin acciones */}
      <div>
        <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Consolidado de la quincena</h2>
        <Consolidado quincena={quincena} accionable={false} />
      </div>
    </div>
  )
}
