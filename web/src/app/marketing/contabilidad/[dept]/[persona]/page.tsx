import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { cop, estadoRegistro, etiquetaQuincena, iniciales, listaQuincenas, quincenaActual } from '@/lib/contabilidadMarketing'
import SelectorQuincena from '../../SelectorQuincena'
import { AccionesRegistro, BotonPagarTodo, FormRegistro } from './controles'

export const dynamic = 'force-dynamic'

const CHIP_ESTADO: Record<string, string> = {
  Realizado: 'bg-primary-container text-secondary',
  Rechazado: 'bg-error-container text-error',
  Aprobado: 'bg-[#e3f2e6] text-[#1b7a3d]',
  Pendiente: 'bg-surface-high text-on-surface-variant',
}

export default async function PersonaContabilidadPage({
  params,
  searchParams,
}: {
  params: Promise<{ dept: string; persona: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { dept: deptId, persona: personaSlug } = await params
  const persona = await prisma.contabPersona.findUnique({
    where: { deptId_slug: { deptId, slug: personaSlug } },
    include: { dept: true },
  })
  if (!persona) notFound()

  const session = await auth()
  const esAdmin = ((session?.user as any)?.role ?? '') === 'ADMIN'

  const [quincenasConDatos, categorias, tarifas] = await Promise.all([
    prisma.contabRegistro.findMany({ distinct: ['quincena'], select: { quincena: true } }),
    prisma.contabCategoria.findMany({ orderBy: { orden: 'asc' } }),
    prisma.contabTarifa.findMany({ where: { deptId }, orderBy: { valor: 'asc' } }),
  ])
  const quincenas = listaQuincenas(quincenasConDatos.map(r => r.quincena))
  const { q } = await searchParams
  const quincena = q && /^\d{4}-\d{2}-Q[12]$/.test(q) ? q : quincenaActual()

  const [registros, envio] = await Promise.all([
    prisma.contabRegistro.findMany({
      where: { personaId: persona.id, quincena },
      orderBy: { id: 'asc' },
    }),
    prisma.contabEnvio.findUnique({ where: { deptId_quincena: { deptId, quincena } } }),
  ])

  const congelada = !!envio && !esAdmin
  const total = registros.reduce((a, r) => a + r.valor, 0)
  const pendientePagar = registros.filter(r => r.aprobado && !r.rechazado && !r.pagado).length

  return (
    <div className="space-y-5 animate-fade-in">
      <Link
        href={`/marketing/contabilidad/${deptId}?q=${quincena}`}
        className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface"
      >
        <ArrowLeft className="w-4 h-4" /> {persona.dept.nombre}
      </Link>

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {persona.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={persona.fotoUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <span
              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ background: `linear-gradient(150deg, ${persona.dept.gradiente})` }}
            >
              {iniciales(persona.nombre)}
            </span>
          )}
          <div>
            <h1 className="text-2xl font-bold text-on-surface">{persona.nombre}</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              {persona.rolTexto || 'Equipo'} · {etiquetaQuincena(quincena)}
            </p>
          </div>
        </div>
        <SelectorQuincena quincenas={quincenas} actual={quincena} />
      </div>

      <div className="bg-surface-lowest border border-outline-variant rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-sm text-on-surface-variant">Total de la quincena</span>
        <b className="text-on-surface tabular-nums text-base">{cop(total)}</b>
        {congelada && (
          <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold bg-[#fff3cd] text-[#8a6d00]">
            Quincena enviada: solo contabilidad puede modificarla
          </span>
        )}
        {esAdmin && pendientePagar > 0 && (
          <span className="ml-auto">
            <BotonPagarTodo personaId={persona.id} quincena={quincena} pendientes={pendientePagar} />
          </span>
        )}
      </div>

      {/* Registros */}
      <div className="space-y-2.5">
        {registros.map(r => {
          const estado = estadoRegistro(r)
          return (
            <div key={String(r.id)} className="bg-surface-lowest border border-outline-variant rounded-xl p-3.5 flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-on-surface">{r.actividad}</p>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${CHIP_ESTADO[estado]}`}>{estado}</span>
                  {r.revisado && !r.pagado && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-[#e8eefc] text-[#2c5cc5]">Revisado</span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {r.categoria} · {r.fecha}
                  {r.link && (
                    <>
                      {' · '}
                      <a href={r.link} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-0.5 hover:underline">
                        evidencia <ExternalLink className="w-3 h-3" />
                      </a>
                    </>
                  )}
                </p>
              </div>
              <p className="text-sm font-bold text-on-surface tabular-nums">{cop(r.valor)}</p>
              <AccionesRegistro
                id={String(r.id)}
                esAdmin={esAdmin}
                congelada={congelada}
                revisado={r.revisado}
                aprobado={r.aprobado}
                rechazado={r.rechazado}
                pagado={r.pagado}
              />
            </div>
          )
        })}
        {registros.length === 0 && (
          <div className="bg-surface-lowest border border-outline-variant rounded-xl p-8 text-center text-sm text-on-surface-variant">
            Sin actividades registradas en esta quincena.
          </div>
        )}
      </div>

      {!congelada && (
        <FormRegistro
          personaId={persona.id}
          quincena={quincena}
          categorias={categorias.map(c => c.nombre)}
          tarifas={tarifas.map(t => ({ label: t.label, valor: t.valor }))}
        />
      )}
    </div>
  )
}
