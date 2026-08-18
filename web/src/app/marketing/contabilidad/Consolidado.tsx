import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { cop, iniciales } from '@/lib/contabilidadMarketing'
import { BotonPagarTodo } from './[dept]/[persona]/controles'

// Consolidado de la quincena por departamento → persona. Lo usan el panel de
// contabilidad (accionable: pagar en lote) y el de cofundador (solo lectura).
export default async function Consolidado({ quincena, accionable }: { quincena: string; accionable: boolean }) {
  const registros = await prisma.contabRegistro.findMany({
    where: { quincena },
    include: { persona: { include: { dept: true } } },
  })

  type Fila = {
    persona: (typeof registros)[number]['persona']
    total: number; n: number; aprobados: number; pagados: number; rechazados: number
  }
  const porDept = new Map<string, { dept: Fila['persona']['dept']; filas: Map<string, Fila> }>()
  for (const r of registros) {
    const d = porDept.get(r.persona.deptId) ?? { dept: r.persona.dept, filas: new Map() }
    const f = d.filas.get(r.persona.id) ?? { persona: r.persona, total: 0, n: 0, aprobados: 0, pagados: 0, rechazados: 0 }
    f.total += r.valor; f.n += 1
    if (r.pagado) f.pagados += 1
    else if (r.rechazado) f.rechazados += 1
    else if (r.aprobado) f.aprobados += 1
    d.filas.set(r.persona.id, f)
    porDept.set(r.persona.deptId, d)
  }

  if (porDept.size === 0) {
    return (
      <div className="bg-surface-lowest border border-outline-variant rounded-xl p-8 text-center text-sm text-on-surface-variant">
        Sin registros en esta quincena.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {[...porDept.values()].sort((a, b) => a.dept.orden - b.dept.orden).map(({ dept, filas }) => {
        const totalDept = [...filas.values()].reduce((a, f) => a + f.total, 0)
        return (
          <div key={dept.id} className="bg-surface-lowest border border-outline-variant rounded-xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-surface-high border-b border-outline-variant">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `linear-gradient(150deg, ${dept.gradiente})` }}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" strokeWidth="1.55"
                  strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: dept.icono }} />
              </div>
              <span className="text-sm font-semibold text-on-surface">{dept.nombre}</span>
              <b className="ml-auto text-sm text-on-surface tabular-nums">{cop(totalDept)}</b>
            </div>
            <div className="divide-y divide-outline-variant">
              {[...filas.values()].sort((a, b) => b.total - a.total).map(f => {
                const todoPagado = f.pagados === f.n
                return (
                  <div key={f.persona.id} className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
                    {f.persona.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.persona.fotoUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ background: `linear-gradient(150deg, ${dept.gradiente})` }}>
                        {iniciales(f.persona.nombre)}
                      </span>
                    )}
                    <Link href={`/marketing/contabilidad/${dept.id}/${f.persona.slug}?q=${quincena}`}
                      className="text-sm font-medium text-on-surface hover:text-primary min-w-[140px]">
                      {f.persona.nombre}
                    </Link>
                    <span className="text-xs text-on-surface-variant">
                      {f.n} act. · {f.pagados} pagadas{f.rechazados > 0 ? ` · ${f.rechazados} rechazadas` : ''}
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                      todoPagado ? 'bg-primary-container text-secondary' : 'bg-surface-high text-on-surface-variant'
                    }`}>
                      {todoPagado ? 'Pagado' : `${f.aprobados} por pagar`}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      <b className="text-sm text-on-surface tabular-nums">{cop(f.total)}</b>
                      {accionable && f.aprobados > 0 && (
                        <BotonPagarTodo personaId={f.persona.id} quincena={quincena} pendientes={f.aprobados} />
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
