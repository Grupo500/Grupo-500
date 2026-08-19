import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ArrowLeft } from 'lucide-react'
import {
  cop, estadoRegistro, etiquetaMes, etiquetaQuincena, iniciales, mesDeQuincena, slugNombre,
} from '@/lib/contabilidadMarketing'
import { esContabilidad } from '@/lib/rolesContabilidad'

export const dynamic = 'force-dynamic'

const COLOR_ESTADO: Record<string, string> = {
  Realizado: 'bg-primary-container text-secondary',
  Aprobado: 'bg-surface-high text-on-surface',
  Rechazado: 'bg-error-container text-error',
  Pendiente: 'bg-surface-high text-on-surface-variant',
}

// Reporte histórico de una persona: por departamento, por categoría, por mes y
// por quincena. Se llega desde el buscador. La persona se identifica por el
// nombre normalizado, así que si trabaja en tres áreas esta pantalla las suma
// —es la vista unificada— sin perder de cuál viene cada peso.
export default async function HistoricoPersonaPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const session = await auth()
  if (!esContabilidad((session?.user as any)?.role)) redirect('/marketing/contabilidad')

  const { slug } = await params
  const personas = await prisma.contabPersona.findMany({ include: { dept: true } })
  const suyas = personas.filter(p => slugNombre(p.nombre) === slug)
  if (suyas.length === 0) notFound()

  const registros = await prisma.contabRegistro.findMany({
    where: { personaId: { in: suyas.map(p => p.id) } },
    include: { persona: { include: { dept: true } } },
    orderBy: [{ quincena: 'desc' }, { id: 'desc' }],
  })

  const nombre = suyas[0].nombre
  const fotoUrl = suyas.find(p => p.fotoUrl)?.fotoUrl ?? null
  const cedula = suyas.find(p => p.cedula)?.cedula ?? null
  const total = registros.reduce((a, r) => a + r.valor, 0)
  const quincenas = new Set(registros.map(r => r.quincena))

  // Cuánto lleva en cada área. Se listan todas sus filas aunque una no tenga
  // registros todavía: el perfil existe y el equipo espera verlo.
  const porArea = suyas.map(p => {
    const suyos = registros.filter(r => r.personaId === p.id)
    return {
      id: p.id,
      dept: p.dept,
      slug: p.slug,
      total: suyos.reduce((a, r) => a + r.valor, 0),
      n: suyos.length,
    }
  }).sort((a, b) => b.total - a.total)

  const porCategoria = [...registros.reduce((m, r) => {
    const a = m.get(r.categoria) ?? { total: 0, n: 0 }
    a.total += r.valor
    a.n += 1
    return m.set(r.categoria, a)
  }, new Map<string, { total: number; n: number }>())]
    .sort((a, b) => b[1].total - a[1].total)

  // Por mes, y dentro de cada mes sus quincenas.
  const porMes = new Map<string, { total: number; n: number; quincenas: Map<string, { total: number; n: number }> }>()
  for (const r of registros) {
    const mes = mesDeQuincena(r.quincena)
    const m = porMes.get(mes) ?? { total: 0, n: 0, quincenas: new Map() }
    m.total += r.valor
    m.n += 1
    const q = m.quincenas.get(r.quincena) ?? { total: 0, n: 0 }
    q.total += r.valor
    q.n += 1
    m.quincenas.set(r.quincena, q)
    porMes.set(mes, m)
  }
  const meses = [...porMes.entries()].sort((a, b) => b[0].localeCompare(a[0]))

  return (
    <div className="space-y-5 animate-fade-in">
      <Link href="/marketing/contabilidad/personas"
        className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface">
        <ArrowLeft className="w-4 h-4" /> Buscar persona
      </Link>

      <div className="flex items-center gap-3.5 flex-wrap">
        {fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fotoUrl} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
        ) : (
          <span className="w-14 h-14 rounded-full flex items-center justify-center text-white text-base font-bold flex-shrink-0"
            style={{ background: `linear-gradient(150deg, ${porArea[0]?.dept.gradiente ?? '#1257C4,#8FD0FF'})` }}>
            {iniciales(nombre)}
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold text-on-surface">{nombre}</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {porArea.length === 1
              ? porArea[0].dept.nombre
              : `${porArea.length} áreas · ${porArea.map(a => a.dept.nombre).join(', ')}`}
            {cedula && ` · CC ${cedula}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { etiqueta: 'Total histórico', valor: cop(total) },
          { etiqueta: 'Actividades', valor: String(registros.length) },
          { etiqueta: 'Quincenas', valor: String(quincenas.size) },
          { etiqueta: porArea.length === 1 ? 'Área' : 'Áreas', valor: String(porArea.length) },
        ].map(k => (
          <div key={k.etiqueta} className="bg-surface-lowest border border-outline-variant rounded-xl p-4">
            <p className="text-xs text-on-surface-variant">{k.etiqueta}</p>
            <b className="text-lg text-on-surface tabular-nums">{k.valor}</b>
          </div>
        ))}
      </div>

      {/* Desglose por área: el "unificada arriba, separada abajo" del equipo. */}
      <div>
        <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Por departamento</h2>
        <div className="space-y-2">
          {porArea.map(a => (
            <Link key={a.id} href={`/marketing/contabilidad/${a.dept.id}/${a.slug}`}
              className="bg-surface-lowest border border-outline-variant rounded-xl px-4 py-3 flex items-center gap-3 hover:border-primary/40 transition-colors">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `linear-gradient(150deg, ${a.dept.gradiente})` }}>
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#fff" strokeWidth="1.55"
                  strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: a.dept.icono }} />
              </div>
              <span className="text-sm font-medium text-on-surface flex-1 min-w-0 truncate">{a.dept.nombre}</span>
              <span className="text-xs text-on-surface-variant">{a.n} {a.n === 1 ? 'actividad' : 'actividades'}</span>
              <b className="text-sm text-on-surface tabular-nums w-24 text-right">{cop(a.total)}</b>
            </Link>
          ))}
        </div>
      </div>

      {porCategoria.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Por categoría</h2>
          <div className="bg-surface-lowest border border-outline-variant rounded-xl divide-y divide-outline-variant">
            {porCategoria.map(([categoria, a]) => (
              <div key={categoria} className="px-4 py-2.5 flex items-center gap-3">
                <span className="text-sm text-on-surface flex-1 min-w-0 truncate">{categoria}</span>
                <span className="text-xs text-on-surface-variant">{a.n}</span>
                <b className="text-sm text-on-surface tabular-nums w-24 text-right">{cop(a.total)}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      {meses.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Por mes y quincena</h2>
          <div className="space-y-2">
            {meses.map(([mes, m]) => (
              <div key={mes} className="bg-surface-lowest border border-outline-variant rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-high border-b border-outline-variant">
                  <span className="text-sm font-semibold text-on-surface capitalize flex-1">{etiquetaMes(mes)}</span>
                  <span className="text-xs text-on-surface-variant">{m.n} {m.n === 1 ? 'actividad' : 'actividades'}</span>
                  <b className="text-sm text-on-surface tabular-nums w-24 text-right">{cop(m.total)}</b>
                </div>
                <div className="divide-y divide-outline-variant">
                  {[...m.quincenas.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([q, s]) => (
                    <div key={q} className="px-4 py-2 flex items-center gap-3">
                      <span className="text-sm text-on-surface-variant flex-1 min-w-0 truncate">{etiquetaQuincena(q)}</span>
                      <span className="text-xs text-on-surface-variant">{s.n}</span>
                      <b className="text-sm text-on-surface tabular-nums w-24 text-right">{cop(s.total)}</b>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Detalle completo</h2>
        {registros.length === 0 ? (
          <div className="bg-surface-lowest border border-outline-variant rounded-xl p-8 text-center text-sm text-on-surface-variant">
            Esta persona todavía no tiene actividades registradas.
          </div>
        ) : (
          <div className="bg-surface-lowest border border-outline-variant rounded-xl divide-y divide-outline-variant">
            {registros.map(r => {
              const estado = estadoRegistro(r)
              return (
                <div key={String(r.id)} className="px-4 py-2.5 flex items-center gap-3 flex-wrap">
                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: `linear-gradient(150deg, ${r.persona.dept.gradiente})` }} />
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm text-on-surface truncate">{r.actividad}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                      {r.categoria} · {r.persona.dept.nombre} · {r.fecha} · {etiquetaQuincena(r.quincena)}
                    </p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${COLOR_ESTADO[estado]}`}>
                    {estado}
                  </span>
                  <b className="text-sm text-on-surface tabular-nums w-24 text-right">{cop(r.valor)}</b>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
