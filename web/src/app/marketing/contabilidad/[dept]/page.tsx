import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ArrowLeft, Send } from 'lucide-react'
import { cop, etiquetaQuincena, iniciales, listaQuincenas, quincenaActual } from '@/lib/contabilidadMarketing'
import SelectorQuincena from '../SelectorQuincena'
import { FormPersona, BotonEnviar } from './controles'

export const dynamic = 'force-dynamic'

export default async function DeptContabilidadPage({
  params,
  searchParams,
}: {
  params: Promise<{ dept: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { dept: deptId } = await params
  const dept = await prisma.contabDepartamento.findUnique({ where: { id: deptId } })
  if (!dept) notFound()

  const session = await auth()
  const esAdmin = ((session?.user as any)?.role ?? '') === 'ADMIN'

  const [personas, quincenasConDatos, tarifas] = await Promise.all([
    prisma.contabPersona.findMany({ where: { deptId, activa: true }, orderBy: { nombre: 'asc' } }),
    prisma.contabRegistro.findMany({ distinct: ['quincena'], select: { quincena: true } }),
    prisma.contabTarifa.findMany({ where: { deptId }, orderBy: { valor: 'asc' } }),
  ])

  const quincenas = listaQuincenas(quincenasConDatos.map(r => r.quincena))
  const { q } = await searchParams
  const quincena = q && /^\d{4}-\d{2}-Q[12]$/.test(q) ? q : quincenaActual()

  const [registros, envio] = await Promise.all([
    prisma.contabRegistro.findMany({
      where: { quincena, persona: { deptId } },
      select: { personaId: true, valor: true, pagado: true, aprobado: true },
    }),
    prisma.contabEnvio.findUnique({ where: { deptId_quincena: { deptId, quincena } } }),
  ])

  const porPersona = new Map<string, { total: number; n: number; pagados: number }>()
  for (const r of registros) {
    const acc = porPersona.get(r.personaId) ?? { total: 0, n: 0, pagados: 0 }
    acc.total += r.valor
    acc.n += 1
    if (r.pagado) acc.pagados += 1
    porPersona.set(r.personaId, acc)
  }
  const total = registros.reduce((a, r) => a + r.valor, 0)

  return (
    <div className="space-y-5 animate-fade-in">
      <Link
        href={`/marketing/contabilidad?q=${quincena}`}
        className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface"
      >
        <ArrowLeft className="w-4 h-4" /> Contabilidad
      </Link>

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: `linear-gradient(150deg, ${dept.gradiente})` }}
          >
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" strokeWidth="1.55"
              strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: dept.icono }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-on-surface">{dept.nombre}</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">{etiquetaQuincena(quincena)}</p>
          </div>
        </div>
        <SelectorQuincena quincenas={quincenas} actual={quincena} />
      </div>

      {/* Estado de la quincena del departamento */}
      <div className="bg-surface-lowest border border-outline-variant rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-sm text-on-surface-variant">Total</span>
        <b className="text-on-surface tabular-nums">{cop(total)}</b>
        <span className="text-xs text-on-surface-variant">· {registros.length} actividades</span>
        <span className="ml-auto flex items-center gap-2">
          {envio ? (
            <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold bg-[#fff3cd] text-[#8a6d00] flex items-center gap-1">
              <Send className="w-3 h-3" /> Enviada el {envio.enviadoAt.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} por {envio.por}
            </span>
          ) : (
            registros.length > 0 && <BotonEnviar deptId={deptId} quincena={quincena} total={cop(total)} />
          )}
        </span>
      </div>

      {/* Tarifario del departamento */}
      {tarifas.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {tarifas.map(t => (
            <span key={t.id} className="text-[11px] px-2.5 py-1 rounded-full bg-surface-high text-on-surface-variant border border-outline-variant">
              {t.label}: <b className="text-on-surface">{cop(t.valor)}</b>
            </span>
          ))}
        </div>
      )}

      {/* Personas */}
      <div className="space-y-2.5">
        {personas.map(per => {
          const s = porPersona.get(per.id)
          const todoPagado = !!s && s.n > 0 && s.pagados === s.n
          return (
            <Link
              key={per.id}
              href={`/marketing/contabilidad/${deptId}/${per.slug}?q=${quincena}`}
              className="bg-surface-lowest border border-outline-variant rounded-xl p-3.5 flex items-center gap-3 hover:border-primary/40 transition-all"
            >
              {per.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={per.fotoUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
              ) : (
                <span
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: `linear-gradient(150deg, ${dept.gradiente})` }}
                >
                  {iniciales(per.nombre)}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">{per.nombre}</p>
                <p className="text-xs text-on-surface-variant">{per.rolTexto || '—'}</p>
              </div>
              {s ? (
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-on-surface tabular-nums">{cop(s.total)}</p>
                  <p className={`text-[11px] ${todoPagado ? 'text-secondary' : 'text-on-surface-variant'}`}>
                    {todoPagado ? 'Pagado' : `${s.n} ${s.n === 1 ? 'actividad' : 'actividades'}`}
                  </p>
                </div>
              ) : (
                <span className="text-xs text-on-surface-variant flex-shrink-0">Sin registros</span>
              )}
            </Link>
          )
        })}
        {personas.length === 0 && (
          <div className="bg-surface-lowest border border-outline-variant rounded-xl p-8 text-center text-sm text-on-surface-variant">
            Todavía no hay personas en este departamento.
          </div>
        )}
      </div>

      <FormPersona deptId={deptId} esAdmin={esAdmin} />
    </div>
  )
}
