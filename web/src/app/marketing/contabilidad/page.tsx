import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Calculator, Crown, Download, Users } from 'lucide-react'
import { cop, etiquetaQuincena, listaQuincenas, quincenaActual } from '@/lib/contabilidadMarketing'
import SelectorQuincena from './SelectorQuincena'

export const dynamic = 'force-dynamic'

// Contabilidad de marketing: cuentas de cobro del equipo por quincena,
// organizadas por departamento. Migrado de pagosagencia.netlify.app.
export default async function ContabilidadPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const session = await auth()
  const role = ((session?.user as any)?.role ?? '') as string
  const esAdmin = role === 'ADMIN'

  const [depts, quincenasConDatos] = await Promise.all([
    prisma.contabDepartamento.findMany({ orderBy: { orden: 'asc' } }),
    prisma.contabRegistro.findMany({ distinct: ['quincena'], select: { quincena: true } }),
  ])

  const quincenas = listaQuincenas(quincenasConDatos.map(r => r.quincena))
  const { q } = await searchParams
  const quincena = q && /^\d{4}-\d{2}-Q[12]$/.test(q) ? q : quincenaActual()

  const [registros, envios] = await Promise.all([
    prisma.contabRegistro.findMany({
      where: { quincena },
      select: { valor: true, pagado: true, persona: { select: { deptId: true, id: true } } },
    }),
    prisma.contabEnvio.findMany({ where: { quincena } }),
  ])

  const porDept = new Map<string, { total: number; personas: Set<string>; pagados: number; n: number }>()
  for (const r of registros) {
    const acc = porDept.get(r.persona.deptId) ?? { total: 0, personas: new Set<string>(), pagados: 0, n: 0 }
    acc.total += r.valor
    acc.personas.add(r.persona.id)
    acc.n += 1
    if (r.pagado) acc.pagados += 1
    porDept.set(r.persona.deptId, acc)
  }
  const envioPorDept = new Map(envios.map(e => [e.deptId, e]))
  const totalQuincena = registros.reduce((a, r) => a + r.valor, 0)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Contabilidad</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Cuentas de cobro del equipo · {etiquetaQuincena(quincena)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SelectorQuincena quincenas={quincenas} actual={quincena} />
          {esAdmin && (
            <a
              href={`/marketing/contabilidad/export?q=${quincena}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-lowest border border-outline-variant text-xs font-medium text-on-surface-variant hover:text-primary hover:border-primary/30 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Exportar CSV
            </a>
          )}
        </div>
      </div>

      {totalQuincena > 0 && (
        <div className="bg-surface-lowest border border-outline-variant rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap text-sm">
          <span className="text-on-surface-variant">Total de la quincena</span>
          <b className="text-on-surface tabular-nums text-base">{cop(totalQuincena)}</b>
          <span className="text-on-surface-variant text-xs">· {registros.length} actividades</span>
        </div>
      )}

      {/* Administración: los dos paneles de la app original, solo ADMIN */}
      {esAdmin && (
        <div>
          <h2 className="text-xs font-semibold text-on-surface-variant mb-2">Administración</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link href={`/marketing/contabilidad/panel?q=${quincena}`}
              className="bg-surface-lowest border border-outline-variant rounded-xl p-4 flex items-center gap-3.5 hover:border-primary/40 hover:shadow-sm transition-all">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(150deg, #1257C4, #8FD0FF)' }}>
                <Calculator className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface">Panel contable</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Envíos, pagos en lote, CSV para Siigo y gestión de departamentos</p>
              </div>
            </Link>
            <Link href={`/marketing/contabilidad/cofundador?q=${quincena}`}
              className="bg-surface-lowest border border-outline-variant rounded-xl p-4 flex items-center gap-3.5 hover:border-primary/40 hover:shadow-sm transition-all">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(150deg, #6A3AA6, #C79BF0)' }}>
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface">Panel de cofundador</p>
                <p className="text-xs text-on-surface-variant mt-0.5">La misma vista de contabilidad, más el ranking de ingresos</p>
              </div>
            </Link>
          </div>
        </div>
      )}

      <h2 className="text-xs font-semibold text-on-surface-variant -mb-2">Departamentos</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {depts.map(d => {
          const s = porDept.get(d.id)
          const envio = envioPorDept.get(d.id)
          const todoPagado = !!s && s.n > 0 && s.pagados === s.n
          return (
            <Link
              key={d.id}
              href={`/marketing/contabilidad/${d.id}?q=${quincena}`}
              className="bg-surface-lowest border border-outline-variant rounded-xl p-4 flex items-center gap-3.5 hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: `linear-gradient(150deg, ${d.gradiente})` }}
              >
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" strokeWidth="1.55"
                  strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d.icono }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">{d.nombre}</p>
                {s ? (
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    <b className="text-on-surface tabular-nums">{cop(s.total)}</b> · {s.personas.size}{' '}
                    {s.personas.size === 1 ? 'persona' : 'personas'}
                  </p>
                ) : (
                  <p className="text-xs text-on-surface-variant mt-0.5">Sin registros esta quincena</p>
                )}
              </div>
              {s && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                  todoPagado
                    ? 'bg-primary-container text-secondary'
                    : envio
                      ? 'bg-[#fff3cd] text-[#8a6d00]'
                      : 'bg-surface-high text-on-surface-variant'
                }`}>
                  {todoPagado ? 'Pagada' : envio ? 'Enviada' : 'Sin enviar'}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      <p className="text-xs text-on-surface-variant flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5" />
        El líder registra las actividades de su equipo y envía la quincena; contabilidad aprueba, marca los pagos y exporta.
      </p>
    </div>
  )
}
