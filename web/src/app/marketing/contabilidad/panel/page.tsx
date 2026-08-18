import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ArrowLeft, Download, Send } from 'lucide-react'
import { cop, etiquetaQuincena, listaQuincenas, quincenaActual } from '@/lib/contabilidadMarketing'
import SelectorQuincena from '../SelectorQuincena'
import Consolidado from '../Consolidado'
import FormDepartamento from './FormDepartamento'

export const dynamic = 'force-dynamic'

// Panel de contabilidad (solo ADMIN): envíos recibidos, consolidado con pagos
// en lote, exportación y gestión de departamentos.
export default async function PanelContabilidadPage({
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

  const envios = await prisma.contabEnvio.findMany({
    where: { quincena },
    include: { dept: true },
    orderBy: { enviadoAt: 'asc' },
  })

  return (
    <div className="space-y-5 animate-fade-in">
      <Link href={`/marketing/contabilidad?q=${quincena}`}
        className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface">
        <ArrowLeft className="w-4 h-4" /> Contabilidad
      </Link>

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Panel contable</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Envíos, pagos y gestión · {etiquetaQuincena(quincena)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SelectorQuincena quincenas={quincenas} actual={quincena} />
          <a href={`/marketing/contabilidad/export?q=${quincena}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-lowest border border-outline-variant text-xs font-medium text-on-surface-variant hover:text-primary hover:border-primary/30 transition-colors">
            <Download className="w-3.5 h-3.5" /> CSV para Siigo
          </a>
        </div>
      </div>

      {/* Quincenas enviadas por los líderes */}
      <div>
        <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Envíos recibidos</h2>
        {envios.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Ningún líder ha enviado esta quincena todavía.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {envios.map(e => (
              <div key={e.id} className="bg-surface-lowest border border-outline-variant rounded-xl px-3.5 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `linear-gradient(150deg, ${e.dept.gradiente})` }}>
                  <Send className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">{e.dept.nombre}</p>
                  <p className="text-xs text-on-surface-variant truncate">
                    <b className="text-on-surface tabular-nums">{cop(e.total)}</b> · {e.personas} pers. ·{' '}
                    {e.enviadoAt.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} · {e.por}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Consolidado con pagos en lote */}
      <div>
        <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Consolidado de la quincena</h2>
        <Consolidado quincena={quincena} accionable />
      </div>

      {/* Gestión de departamentos */}
      <div>
        <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Departamentos</h2>
        <FormDepartamento />
      </div>
    </div>
  )
}
