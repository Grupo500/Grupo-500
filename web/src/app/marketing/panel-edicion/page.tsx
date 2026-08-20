'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'
import {
  Clapperboard, RefreshCw, Loader2, ChevronRight, Wrench, BellRing, CheckCircle2,
} from 'lucide-react'

/**
 * Panel de Edición: videos aprobados y en corrección por editor, en vivo desde
 * Trello. Los datos pasan por /api/marketing/panel-edicion (proxy interno con
 * sesión — la CSP de la app no permite llamar dominios externos desde el
 * navegador), que a su vez consulta la Netlify Function que agrega los tableros
 * "Grupo 500 videos" (editor = miembros de la tarjeta, listas "Aprobados …")
 * y "TEAM COMMUNITY" (editor = nombre de la lista, todas cuentan).
 */
const STATS_URL = '/api/marketing/panel-edicion'

interface Aprobado { name: string; url: string | null; approvedAt: string }
interface Correccion { name: string; url: string | null; since: string; list?: string }
interface Editor {
  id: string
  name: string
  initials: string
  avatarUrl: string | null
  cards: Aprobado[]
  corrections?: Correccion[]
}
interface Team { id: string; name: string; editors: Editor[] }
interface Stats { demo: boolean; teams: Team[]; generatedAt: string }

type Periodo = 'today' | 'week' | 'month' | 'all'
const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'all', label: 'Todo' },
]

const DAY = 864e5

function periodStart(p: Periodo): Date {
  const n = new Date()
  if (p === 'today') return new Date(n.getFullYear(), n.getMonth(), n.getDate())
  if (p === 'week') {
    const d = new Date(n.getFullYear(), n.getMonth(), n.getDate())
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // desde el lunes
    return d
  }
  if (p === 'month') return new Date(n.getFullYear(), n.getMonth(), 1)
  return new Date(0)
}

const inPeriod = (cards: Aprobado[], since: Date) =>
  cards.filter(c => new Date(c.approvedAt) >= since)

const daysAgo = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / DAY)

interface Alerta { sev: 0 | 1 | 2; texto: string }

function buildAlertas(teams: Team[]): Alerta[] {
  const week = periodStart('week')
  const alertas: Alerta[] = []
  for (const team of teams) {
    for (const ed of team.editors) {
      const corr = ed.corrections ?? []
      for (const c of corr) {
        const d = daysAgo(c.since)
        if (d >= 3) alertas.push({ sev: 0, texto: `«${c.name}» de ${ed.name} lleva ${d} días en corrección (${team.name})` })
      }
      if (corr.length >= 3) alertas.push({ sev: 1, texto: `${ed.name} acumula ${corr.length} videos en corrección (${team.name})` })
      if (corr.length && !inPeriod(ed.cards, week).length && ed.id !== '_unassigned') {
        alertas.push({ sev: 2, texto: `${ed.name} tiene ${corr.length} en corrección y ningún aprobado esta semana` })
      }
    }
  }
  return alertas.sort((a, b) => a.sev - b.sev)
}

const SEV_DOT: Record<number, string> = {
  0: 'bg-negative',
  1: 'bg-amber-500',
  2: 'bg-amber-300',
}

function StatTile({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="card !p-4">
      <p className="text-[11px] font-semibold text-on-surface-variant">{label}</p>
      <p className={cn('text-[22px] font-bold tracking-tight mt-0.5', warn ? 'text-amber-600' : 'text-on-surface')}>{value}</p>
    </div>
  )
}

function EditorRow({ ed, rank, max, today, week }: {
  ed: Editor & { per: Aprobado[] }
  rank: number
  max: number
  today: Date
  week: Date
}) {
  const [open, setOpen] = useState(false)
  const corr = ed.corrections ?? []
  const recientes = useMemo(
    () => [...ed.per].sort((a, b) => +new Date(b.approvedAt) - +new Date(a.approvedAt)).slice(0, 40),
    [ed.per],
  )
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-surface-high/60 transition-colors text-left"
      >
        <span className={cn(
          'w-6 text-center text-[13px] font-bold shrink-0',
          rank === 1 ? 'text-amber-500' : rank === 2 ? 'text-outline' : rank === 3 ? 'text-amber-700' : 'text-on-surface-variant',
        )}>{rank}</span>

        <span className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center shrink-0 overflow-hidden">
          {ed.avatarUrl
            ? <img src={ed.avatarUrl} alt="" className="w-full h-full object-cover" />
            : <span className="text-[11px] font-bold text-primary">{ed.initials}</span>}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-on-surface truncate">{ed.name}</span>
            {corr.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                <Wrench className="w-2.5 h-2.5" />{corr.length}
              </span>
            )}
          </span>
          <span className="block h-1 rounded-full bg-surface-high mt-1.5 overflow-hidden">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${(ed.per.length / max) * 100}%` }} />
          </span>
        </span>

        <span className="hidden sm:block text-[11px] text-on-surface-variant shrink-0">
          hoy {inPeriod(ed.cards, today).length} · semana {inPeriod(ed.cards, week).length}
        </span>
        <span className="text-[18px] font-bold text-primary w-10 text-right shrink-0">{ed.per.length}</span>
        <ChevronRight className={cn('w-4 h-4 text-on-surface-variant shrink-0 transition-transform', open && 'rotate-90')} />
      </button>

      {open && (
        <div className="px-5 pb-3 pl-[72px] space-y-0.5">
          {[...corr].sort((a, b) => +new Date(a.since) - +new Date(b.since)).map((c, i) => (
            <a
              key={`c${i}`}
              href={c.url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={cn('flex items-center justify-between gap-3 px-2 py-1.5 rounded-md text-[12px] text-amber-700', c.url && 'hover:bg-amber-50')}
            >
              <span className="truncate flex items-center gap-1.5"><Wrench className="w-3 h-3 shrink-0" />{c.name}</span>
              <span className="shrink-0 text-[11px]">{daysAgo(c.since) < 1 ? 'hoy' : `hace ${daysAgo(c.since)} d`}</span>
            </a>
          ))}
          {recientes.map((c, i) => (
            <a
              key={`a${i}`}
              href={c.url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={cn('flex items-center justify-between gap-3 px-2 py-1.5 rounded-md text-[12px] text-on-surface-variant', c.url && 'hover:bg-surface-high/60')}
            >
              <span className="truncate flex items-center gap-1.5"><Clapperboard className="w-3 h-3 shrink-0 text-primary" />{c.name}</span>
              <span className="shrink-0 text-[11px]">{format(new Date(c.approvedAt), "d MMM", { locale: es })}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PanelEdicionPage() {
  const [periodo, setPeriodo] = useState<Periodo>('week')

  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['marketing-panel-edicion'],
    queryFn: async (): Promise<Stats> => {
      const res = await fetch(STATS_URL)
      if (!res.ok) throw new Error(`Error ${res.status} consultando Trello`)
      const json = await res.json()
      if (json.error) throw new Error(json.detail ?? json.error)
      return json
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const since = periodStart(periodo)
  const today = periodStart('today')
  const week = periodStart('week')

  const teams = useMemo(() => (data?.teams ?? []).map(team => {
    const editors = team.editors
      .map(ed => ({ ...ed, per: inPeriod(ed.cards, since) }))
      .sort((a, b) => b.per.length - a.per.length)
    return { ...team, editors }
  }), [data, periodo]) // eslint-disable-line react-hooks/exhaustive-deps

  const totales = useMemo(() => {
    let periodo = 0, hoy = 0, semana = 0, correccion = 0
    const activos = new Set<string>()
    for (const t of teams) for (const ed of t.editors) {
      periodo += ed.per.length
      hoy += inPeriod(ed.cards, today).length
      semana += inPeriod(ed.cards, week).length
      correccion += (ed.corrections ?? []).length
      if (ed.per.length && ed.id !== '_unassigned') activos.add(ed.id)
    }
    return { periodo, hoy, semana, correccion, activos: activos.size }
  }, [teams]) // eslint-disable-line react-hooks/exhaustive-deps

  const alertas = useMemo(() => buildAlertas(data?.teams ?? []), [data])

  // Matriz mensual: últimos 6 meses, editores de ambos tableros
  const meses = useMemo(() => {
    const out: { y: number; m: number; label: string }[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      out.push({ y: d.getFullYear(), m: d.getMonth(), label: format(d, 'MMM yy', { locale: es }) })
    }
    return out
  }, [])

  const matriz = useMemo(() => {
    const rows: Record<string, { name: string; teams: Set<string>; byMonth: Record<string, number>; total: number }> = {}
    for (const t of data?.teams ?? []) for (const ed of t.editors) {
      if (ed.id === '_unassigned' && !ed.cards.length) continue
      rows[ed.id] ??= { name: ed.name, teams: new Set(), byMonth: {}, total: 0 }
      rows[ed.id].teams.add(t.name)
      for (const c of ed.cards) {
        const d = new Date(c.approvedAt)
        const k = `${d.getFullYear()}-${d.getMonth()}`
        rows[ed.id].byMonth[k] = (rows[ed.id].byMonth[k] ?? 0) + 1
        rows[ed.id].total++
      }
    }
    return Object.values(rows).sort((a, b) => b.total - a.total)
  }, [data])

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Panel de Edición"
        subtitle="Videos aprobados por editor · en vivo desde Trello"
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center gap-2 text-[12px] font-semibold text-on-surface-variant bg-surface-lowest border border-outline-variant rounded-lg px-3 py-2 hover:bg-surface-high/60 transition-colors"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            Actualizar
          </button>
        }
      />

      {isLoading ? (
        <div className="card flex items-center justify-center py-20 text-on-surface-variant">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatTile label="Aprobados (periodo)" value={totales.periodo} />
            <StatTile label="Hoy" value={totales.hoy} />
            <StatTile label="Esta semana" value={totales.semana} />
            <StatTile label="Editores activos" value={totales.activos} />
            <StatTile label="En corrección" value={totales.correccion} warn />
          </div>

          <div className="card !p-0 overflow-hidden">
            <div className="flex items-center gap-2 px-5 pt-4 pb-2">
              <BellRing className="w-4 h-4 text-primary" />
              <h2 className="text-[15px] font-semibold text-on-surface">Alertas</h2>
            </div>
            {alertas.length === 0 ? (
              <p className="flex items-center gap-2 px-5 pb-4 text-[13px] text-positive">
                <CheckCircle2 className="w-4 h-4" /> Sin alertas — todo en orden
              </p>
            ) : (
              <div className="pb-3">
                {alertas.slice(0, 10).map((a, i) => (
                  <div key={i} className="flex items-start gap-2.5 px-5 py-1.5">
                    <span className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', SEV_DOT[a.sev])} />
                    <p className="text-[12.5px] text-on-surface-variant">{a.texto}</p>
                  </div>
                ))}
                {alertas.length > 10 && (
                  <p className="px-5 pt-1 text-[11px] text-on-surface-variant">
                    … y {alertas.length - 10} alertas más (mira los chips de cada editor)
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="inline-flex rounded-lg border border-outline-variant bg-surface-lowest p-1 gap-1">
            {PERIODOS.map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriodo(p.key)}
                className={cn(
                  'px-4 py-1.5 rounded-md text-[12px] font-semibold transition-colors',
                  periodo === p.key ? 'bg-primary text-surface-lowest' : 'text-on-surface-variant hover:bg-surface-high/60',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {teams.map(team => {
            const visibles = team.editors.filter(ed => ed.per.length || (ed.corrections ?? []).length || periodo === 'all')
            const totalTeam = team.editors.reduce((s, e) => s + e.per.length, 0)
            const corrTeam = team.editors.reduce((s, e) => s + (e.corrections ?? []).length, 0)
            const max = Math.max(1, ...team.editors.map(e => e.per.length))
            return (
              <div key={team.id} className="card !p-0 overflow-hidden">
                <div className="flex items-center gap-2.5 px-5 pt-4 pb-2 flex-wrap">
                  <h2 className="text-[15px] font-semibold text-on-surface">{team.name}</h2>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary-container text-secondary">
                    {totalTeam} aprobado{totalTeam === 1 ? '' : 's'}
                  </span>
                  {corrTeam > 0 && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                      {corrTeam} en corrección
                    </span>
                  )}
                </div>
                {visibles.length === 0 ? (
                  <p className="text-[13px] text-on-surface-variant text-center py-10">Sin videos aprobados en este período.</p>
                ) : (
                  <div className="divide-y divide-outline-variant">
                    {visibles.map((ed, i) => (
                      <EditorRow key={ed.id} ed={ed} rank={i + 1} max={max} today={today} week={week} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          <div className="card !p-0 overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 pt-4 pb-2">
              <h2 className="text-[15px] font-semibold text-on-surface">Evolución mensual por editor</h2>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary-container text-secondary">últimos 6 meses</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[12.5px]">
                <thead>
                  <tr className="text-[11px] font-semibold text-on-surface-variant">
                    <th className="text-left px-5 py-2">Editor</th>
                    {meses.map(m => <th key={m.label} className="px-3 py-2 text-center">{m.label}</th>)}
                    <th className="px-5 py-2 text-center">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {matriz.map(r => (
                    <tr key={r.name + [...r.teams].join()}>
                      <td className="px-5 py-2">
                        <p className="font-semibold text-on-surface whitespace-nowrap">{r.name}</p>
                        <p className="text-[10px] text-on-surface-variant">{[...r.teams].join(' · ')}</p>
                      </td>
                      {meses.map(m => {
                        const v = r.byMonth[`${m.y}-${m.m}`] ?? 0
                        return (
                          <td key={m.label} className={cn('px-3 py-2 text-center', v ? 'font-semibold text-primary' : 'text-outline-variant')}>
                            {v || '·'}
                          </td>
                        )
                      })}
                      <td className="px-5 py-2 text-center font-bold text-primary">{r.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] text-on-surface-variant text-center pb-2">
            Actualizado {format(new Date(dataUpdatedAt || Date.now()), 'h:mm a', { locale: es })} · se refresca solo cada minuto
          </p>
        </>
      )}
    </div>
  )
}
