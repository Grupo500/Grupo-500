import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ArrowLeft, Download, FileSpreadsheet, Search, Send, TriangleAlert } from 'lucide-react'
import { cop, etiquetaQuincena, listaQuincenas, quincenaActual } from '@/lib/contabilidadMarketing'
import SelectorQuincena from '../SelectorQuincena'
import Consolidado from '../Consolidado'
import FormDepartamento from './FormDepartamento'
import { armarComprobante } from '@/lib/siigoDatos'

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

  const comprobante = await armarComprobante(quincena)

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
          <Link href="/marketing/contabilidad/personas"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-lowest border border-outline-variant text-xs font-medium text-on-surface-variant hover:text-primary hover:border-primary/30 transition-colors">
            <Search className="w-3.5 h-3.5" /> Buscar persona
          </Link>
          <a href={`/marketing/contabilidad/export?q=${quincena}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-lowest border border-outline-variant text-xs font-medium text-on-surface-variant hover:text-primary hover:border-primary/30 transition-colors">
            <Download className="w-3.5 h-3.5" /> CSV de la quincena
          </a>
          <a href={`/marketing/contabilidad/export/siigo?q=${quincena}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90 transition-opacity">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel para Siigo
          </a>
        </div>
      </div>

      {/* Lo que el Excel de Siigo todavía no puede llenar solo. No bloquea la
          descarga: el archivo sale igual y esas columnas van vacías. */}
      {comprobante.registros > 0 && !comprobante.completo && (
        <div className="bg-[#fff8e1] border border-[#ffe08a] rounded-xl p-4 flex gap-3">
          <TriangleAlert className="w-4 h-4 text-[#8a6d00] flex-shrink-0 mt-0.5" />
          <div className="text-xs text-[#6b5500] space-y-1.5">
            <p className="font-semibold text-sm">El Excel para Siigo sale como borrador</p>
            <p>
              Se descarga con los valores y las personas de la quincena, pero estas columnas
              van vacías porque el dato todavía no existe en la app. Complétalas en Excel
              antes de importar, o cárgalas aquí para que salgan solas.
            </p>
            {comprobante.configuracionPendiente.length > 0 && (
              <p>
                <b>Códigos contables:</b> {comprobante.configuracionPendiente.join(' · ')}.
              </p>
            )}
            {comprobante.personasSinCedula.length > 0 && (
              <p>
                <b>Sin cédula ({comprobante.personasSinCedula.length}):</b>{' '}
                {comprobante.personasSinCedula.join(', ')}.
              </p>
            )}
          </div>
        </div>
      )}

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
