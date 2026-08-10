'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion'
import { apiFetch } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { formatCOP } from '@/lib/utils'
import {
  Search, Phone, ChevronLeft, ChevronRight, ChevronDown, Download,
  SlidersHorizontal, ArrowUpDown, X, User, UserRound, BookOpen, Calendar, MoreHorizontal, Filter,
} from 'lucide-react'

const POR_PAGINA = 10

interface FilaCuota {
  estudianteId: string
  nombre: string
  telefono: string
  email: string
  asesor: string | null
  curso: string
  cuotaNumero: number
  cuotasTotal: number
  montoCuota: number
  totalCurso: number
  totalPagado: number
  saldo: number
  metodo: string
  fechaUltimaCuota: string | null
  diasSinPagar: number | null
  proximaCuotaEstimada: string | null
  /** Valor del cobro que Hotmart no pudo hacer. Null si el atraso es estimado. */
  montoVencido: number | null
  /** El atraso lo confirmó Hotmart; si es false, viene de la estimación por fecha. */
  atrasoConfirmado: boolean
  estado: 'al-dia' | 'atrasado' | 'completado'
}

interface CuotasData {
  resumen: { total: number; atrasados: number; alDia: number; completados: number; saldoTotal: number }
  filas: FilaCuota[]
}

const ESTADO_LABEL: Record<FilaCuota['estado'], string> = { 'al-dia': 'Al día', atrasado: 'Atrasado', completado: 'Completado' }
const ESTADO_COLOR: Record<FilaCuota['estado'], string> = { 'al-dia': '#1a7de0', atrasado: '#dc2626', completado: '#16a34a' }

type OrdenCampo = 'diasSinPagar' | 'saldo' | 'nombre' | 'cuota'
const ORDEN_LABEL: Record<OrdenCampo, string> = {
  diasSinPagar: 'Días sin pagar', saldo: 'Saldo', nombre: 'Nombre', cuota: 'Progreso de cuota',
}

function numero(v: number) { return Math.round(v).toLocaleString('es-CO') }

function fmtFecha(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function descargar(nombreArchivo: string, contenido: string, tipo: string) {
  const blob = new Blob([contenido], { type: `${tipo};charset=utf-8;` })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = nombreArchivo
  link.click()
  URL.revokeObjectURL(link.href)
}

export default function CuotasPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const shouldReduceMotion = useReducedMotion()

  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('')
  const [asesor, setAsesor] = useState('')
  const [pagina, setPagina] = useState(1)

  const [ordenCampo, setOrdenCampo] = useState<OrdenCampo>('diasSinPagar')
  const [ordenAsc, setOrdenAsc] = useState(false)
  const [menuOrden, setMenuOrden] = useState(false)
  const [menuExport, setMenuExport] = useState(false)
  const [detalle, setDetalle] = useState<FilaCuota | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['reportes-cuotas'],
    queryFn: async () => apiFetch('/reportes/cuotas') as Promise<{ data: CuotasData }>,
    staleTime: 60_000,
  })

  const d = data?.data
  const asesores = useMemo(
    () => [...new Set((d?.filas ?? []).map(f => f.asesor).filter((a): a is string => !!a))].sort(),
    [d?.filas],
  )

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    const base = (d?.filas ?? []).filter(f =>
      (!estado || f.estado === estado) &&
      (!isAdmin || !asesor || f.asesor === asesor) &&
      (!texto || f.nombre.toLowerCase().includes(texto) || f.curso.toLowerCase().includes(texto))
    )
    const val = (f: FilaCuota) => {
      if (ordenCampo === 'nombre') return f.nombre.toLowerCase()
      if (ordenCampo === 'saldo') return f.saldo
      if (ordenCampo === 'cuota') return f.cuotaNumero / f.cuotasTotal
      return f.diasSinPagar ?? -1
    }
    return [...base].sort((a, b) => {
      const va = val(a), vb = val(b)
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return ordenAsc ? cmp : -cmp
    })
  }, [d?.filas, busqueda, estado, asesor, isAdmin, ordenCampo, ordenAsc])

  useEffect(() => setPagina(1), [busqueda, estado, asesor, ordenCampo, ordenAsc])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const paginadas = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  const r = d?.resumen
  const totalPlanes = r?.total ?? 0
  const segmentosEstado: { estado: FilaCuota['estado']; valor: number }[] = [
    { estado: 'atrasado', valor: r?.atrasados ?? 0 },
    { estado: 'al-dia', valor: r?.alDia ?? 0 },
    { estado: 'completado', valor: r?.completados ?? 0 },
  ]

  function ordenar(campo: OrdenCampo) {
    if (campo === ordenCampo) setOrdenAsc(a => !a)
    else { setOrdenCampo(campo); setOrdenAsc(false) }
    setMenuOrden(false)
  }

  function exportarCSV() {
    // Se exporta para llamar a cobrar: el teléfono y el valor exacto vencido
    // son las dos columnas que hacen falta para gestionar sin volver a la app.
    const encabezados = ['Estudiante', 'Teléfono', 'Curso', 'Asesor', 'Cuota', 'Cuotas totales', 'Pagado', 'Saldo', 'Monto vencido', 'Días de atraso', 'Última cuota', 'Estado']
    const filas = filtradas.map(f => [
      f.nombre, f.telefono, f.curso, f.asesor ?? '', f.cuotaNumero, f.cuotasTotal, f.totalPagado, f.saldo,
      f.montoVencido ?? '', f.estado === 'atrasado' ? (f.diasSinPagar ?? '') : '',
      f.fechaUltimaCuota ?? '', ESTADO_LABEL[f.estado],
    ])
    const csv = [encabezados, ...filas].map(fila => fila.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    descargar(`cuotas-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv')
  }

  function exportarJSON() {
    descargar(`cuotas-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(filtradas, null, 2), 'application/json')
  }

  // 40px de acción + [40px de asesor si admin] + columnas fijas + estudiante/curso flexibles
  const gridTemplate = isAdmin
    ? '1.2fr 1.2fr 130px 90px 100px 100px 105px 105px 105px 36px'
    : '1.2fr 1.2fr 90px 100px 100px 105px 105px 105px 36px'

  const animar = !shouldReduceMotion
  const containerVariants: Variants = { visible: { transition: { staggerChildren: 0.035, delayChildren: 0.05 } } }
  const rowVariants: Variants = {
    hidden: { opacity: 0, y: 14, filter: 'blur(3px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 420, damping: 28, mass: 0.7 } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Control de cuotas"
        subtitle={isAdmin
          ? 'Ventas a cuotas de Hotmart (Smart Installment) de todo el equipo: cuánto va pagado y quién se atrasó'
          : 'Tus ventas a cuotas de Hotmart (Smart Installment): cuánto va pagado y quién se atrasó'}
      />

      <motion.div
        initial={animar ? { opacity: 0, y: 10 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="card p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-6 flex-wrap mb-5">
          <div>
            <p className="text-[12px] font-medium text-on-surface-variant mb-1.5">Saldo pendiente total</p>
            <p className="text-[34px] sm:text-[40px] font-bold leading-none text-on-surface" style={{ letterSpacing: '-0.02em' }}>
              {isLoading ? '—' : formatCOP(r?.saldoTotal ?? 0)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[22px] font-semibold tabular-nums text-on-surface">{isLoading ? '—' : numero(totalPlanes)}</p>
            <p className="text-[11px] text-on-surface-variant mt-0.5">en plan de cuotas</p>
          </div>
        </div>

        <div className="h-2.5 rounded-full bg-surface-high overflow-hidden flex gap-[2px] mb-4">
          {isLoading || totalPlanes === 0 ? (
            <div className={`w-full h-full bg-surface-high ${isLoading ? 'animate-pulse' : ''}`} />
          ) : (
            segmentosEstado.filter(s => s.valor > 0).map(s => (
              <motion.div
                key={s.estado}
                initial={animar ? { flexBasis: 0 } : false}
                animate={{ flexBasis: `${(s.valor / totalPlanes) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full flex-shrink-0"
                style={{ background: ESTADO_COLOR[s.estado] }}
              />
            ))
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {segmentosEstado.map(s => {
            const activo = estado === s.estado
            return (
              <button
                key={s.estado}
                onClick={() => setEstado(e => e === s.estado ? '' : s.estado)}
                aria-pressed={activo}
                className="flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full text-[12px] border transition-colors cursor-pointer"
                style={{
                  background: activo ? `${ESTADO_COLOR[s.estado]}1f` : 'var(--surface-container-lowest)',
                  borderColor: activo ? ESTADO_COLOR[s.estado] : 'var(--outline-variant)',
                }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ESTADO_COLOR[s.estado] }} />
                <span className="font-semibold tabular-nums text-on-surface">{isLoading ? '—' : numero(s.valor)}</span>
                <span className="text-on-surface-variant">{ESTADO_LABEL[s.estado]}</span>
              </button>
            )
          })}
        </div>
      </motion.div>

      <div className="card p-5">
        <h3 className="text-[15px] font-semibold text-on-surface mb-3">Detalle por estudiante</h3>

        {/* Fila 1: búsqueda a todo el ancho */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant pointer-events-none" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o curso"
            className="h-9 pl-9 pr-3 rounded-lg border border-surface-high bg-surface-container-lowest text-[12.5px] text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:border-primary w-full"
          />
        </div>

        {/* Fila 2: filtros a la izquierda, acciones a la derecha */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={estado}
              onValueChange={setEstado}
              className="w-[130px]"
              icon={<Filter />}
              options={[
                { value: '', label: 'Estado' },
                { value: 'atrasado', label: 'Atrasado' },
                { value: 'al-dia', label: 'Al día' },
                { value: 'completado', label: 'Completado' },
              ]}
              anchoAuto
            />
            {isAdmin && (
              <Select
                value={asesor}
                onValueChange={setAsesor}
                className="w-[130px]"
                icon={<UserRound />}
                options={[{ value: '', label: 'Asesor' }, ...asesores.map(a => ({ value: a, label: a }))]}
                anchoAuto
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Ordenar */}
            <div className="relative">
              <button
                onClick={() => { setMenuOrden(v => !v); setMenuExport(false) }}
                className="h-9 px-3 rounded-lg border border-surface-high bg-surface-container-lowest text-[12.5px] text-on-surface hover:bg-surface-high transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-on-surface-variant" />
                Ordenar
                <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant" />
              </button>
              {menuOrden && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOrden(false)} />
                  <div className="absolute right-0 mt-1 w-52 bg-surface-lowest border border-outline-variant shadow-float rounded-lg z-20 py-1">
                    {(Object.keys(ORDEN_LABEL) as OrdenCampo[]).map(campo => (
                      <button
                        key={campo}
                        onClick={() => ordenar(campo)}
                        className={`w-full px-3 py-2 text-left text-[12.5px] hover:bg-surface-high transition-colors cursor-pointer ${ordenCampo === campo ? 'text-primary font-semibold' : 'text-on-surface'}`}
                      >
                        {ORDEN_LABEL[campo]} {ordenCampo === campo && (ordenAsc ? '↑' : '↓')}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="w-px h-5 bg-outline-variant" />

            {/* Exportar */}
            <div className="relative">
              <button
                onClick={() => { setMenuExport(v => !v); setMenuOrden(false) }}
                className="h-9 px-3 rounded-lg border border-surface-high bg-surface-container-lowest text-[12.5px] text-on-surface hover:bg-surface-high transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-on-surface-variant" />
                Exportar
                <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant" />
              </button>
              {menuExport && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuExport(false)} />
                  <div className="absolute right-0 mt-1 w-36 bg-surface-lowest border border-outline-variant shadow-float rounded-lg z-20 py-1">
                    <button onClick={() => { exportarCSV(); setMenuExport(false) }} className="w-full px-3 py-2 text-left text-[12.5px] text-on-surface hover:bg-surface-high transition-colors cursor-pointer">CSV</button>
                    <button onClick={() => { exportarJSON(); setMenuExport(false) }} className="w-full px-3 py-2 text-left text-[12.5px] text-on-surface hover:bg-surface-high transition-colors cursor-pointer border-t border-outline-variant/50">JSON</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-11 rounded-lg bg-surface-high animate-pulse" />)}
          </div>
        ) : filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
            <SlidersHorizontal className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-[13px]">Nadie coincide con el filtro</p>
          </div>
        ) : (
          <div className="border border-outline-variant rounded-xl overflow-hidden relative">
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                {/* Encabezado */}
                <div
                  className="px-3 py-2.5 text-[11px] font-semibold text-on-surface-variant bg-surface-high/60 border-b border-outline-variant"
                  style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
                >
                  <div className="px-2 border-r border-outline-variant/40">Estudiante</div>
                  <div className="px-2 border-r border-outline-variant/40">Curso</div>
                  {isAdmin && <div className="px-2 border-r border-outline-variant/40">Asesor</div>}
                  <div className="px-2 border-r border-outline-variant/40 text-center">Cuota</div>
                  <div className="px-2 border-r border-outline-variant/40 text-right">Pagado</div>
                  <div className="px-2 border-r border-outline-variant/40 text-right">Saldo</div>
                  <div className="px-2 border-r border-outline-variant/40 text-right">Última</div>
                  <div className="px-2 border-r border-outline-variant/40 text-right">Próxima</div>
                  <div className="px-2 border-r border-outline-variant/40 text-right">Estado</div>
                  <div className="text-center">Ver</div>
                </div>

                {/* Filas */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`p${pagina}-${estado}-${asesor}-${busqueda}-${ordenCampo}-${ordenAsc}`}
                    variants={animar ? containerVariants : undefined}
                    initial={animar ? 'hidden' : false}
                    animate="visible"
                  >
                    {paginadas.map(f => (
                      <motion.div key={f.estudianteId + f.curso} variants={animar ? rowVariants : undefined} exit="exit">
                        <div
                          className="px-3 py-2.5 group border-b border-outline-variant/40 last:border-b-0 hover:bg-surface-high/40 transition-colors"
                          style={{ display: 'grid', gridTemplateColumns: gridTemplate, alignItems: 'center' }}
                        >
                          <div className="px-2 border-r border-outline-variant/40 min-w-0">
                            <Link href={`/estudiantes/${f.estudianteId}`} className="text-[12.5px] font-medium text-on-surface hover:text-primary truncate block">
                              {f.nombre}
                            </Link>
                          </div>
                          <div className="px-2 border-r border-outline-variant/40 min-w-0 text-[12px] text-on-surface-variant truncate" title={f.curso}>
                            {f.curso}
                          </div>
                          {isAdmin && (
                            <div className="px-2 border-r border-outline-variant/40 min-w-0 text-[12px] text-on-surface-variant truncate">
                              {f.asesor ?? '—'}
                            </div>
                          )}
                          <div className="px-2 border-r border-outline-variant/40 text-center">
                            <span className="text-[11.5px] font-semibold tabular-nums text-on-surface whitespace-nowrap">
                              {f.cuotaNumero}/{f.cuotasTotal}
                            </span>
                            <div className="h-1 w-12 mx-auto mt-1 rounded-full bg-surface-high overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (f.cuotaNumero / f.cuotasTotal) * 100)}%`, background: ESTADO_COLOR[f.estado] }} />
                            </div>
                          </div>
                          <div className="px-2 border-r border-outline-variant/40 text-right text-[12px] tabular-nums text-on-surface whitespace-nowrap">
                            {formatCOP(f.totalPagado)}
                          </div>
                          <div className="px-2 border-r border-outline-variant/40 text-right text-[12px] font-semibold tabular-nums whitespace-nowrap" style={{ color: f.saldo > 0 ? '#d97706' : 'var(--on-surface-variant)' }}>
                            {formatCOP(f.saldo)}
                          </div>
                          <div className="px-2 border-r border-outline-variant/40 text-right text-[11px] tabular-nums text-on-surface-variant whitespace-nowrap">
                            {fmtFecha(f.fechaUltimaCuota)}
                          </div>
                          <div className="px-2 border-r border-outline-variant/40 text-right text-[11px] tabular-nums whitespace-nowrap"
                            style={{ color: f.estado === 'atrasado' ? '#dc2626' : 'var(--on-surface-variant)' }}>
                            {f.estado === 'completado' ? '—' : fmtFecha(f.proximaCuotaEstimada)}
                          </div>
                          <div className="px-2 border-r border-outline-variant/40 text-right">
                            <span
                              className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap"
                              style={{ background: `${ESTADO_COLOR[f.estado]}1f`, color: ESTADO_COLOR[f.estado] }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: ESTADO_COLOR[f.estado] }} />
                              {ESTADO_LABEL[f.estado]}
                            </span>
                          </div>
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => setDetalle(f)}
                              aria-label={`Ver detalle de ${f.nombre}`}
                              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity cursor-pointer text-on-surface-variant"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Modal de detalle */}
            <AnimatePresence>
              {detalle && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                  onClick={() => setDetalle(null)}
                >
                  <motion.div
                    initial={{ scale: 0.92, opacity: 0, y: 16 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.92, opacity: 0, y: 16 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.8 }}
                    className="bg-surface-lowest border border-outline-variant rounded-2xl p-5 shadow-float relative max-w-sm w-full"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setDetalle(null)}
                      className="absolute top-3 right-3 w-7 h-7 rounded-full bg-surface-high hover:bg-surface-highest flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 text-on-surface-variant" />
                    </button>

                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-11 h-11 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-on-surface truncate">{detalle.nombre}</p>
                        <span
                          className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-md mt-0.5"
                          style={{ background: `${ESTADO_COLOR[detalle.estado]}1f`, color: ESTADO_COLOR[detalle.estado] }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: ESTADO_COLOR[detalle.estado] }} />
                          {ESTADO_LABEL[detalle.estado]}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 text-[12.5px]">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1 text-on-surface-variant">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span className="text-[10.5px] uppercase tracking-wide">Curso</span>
                        </div>
                        <p className="text-on-surface font-medium">{detalle.curso}</p>
                        {detalle.asesor && <p className="text-on-surface-variant text-[11.5px] mt-0.5">Asesor: {detalle.asesor}</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-surface-high rounded-xl p-2.5">
                          <p className="text-[10.5px] text-on-surface-variant">Cuota</p>
                          <p className="text-[13px] font-bold tabular-nums text-on-surface mt-0.5">{detalle.cuotaNumero} de {detalle.cuotasTotal}</p>
                        </div>
                        <div className="bg-surface-high rounded-xl p-2.5">
                          <p className="text-[10.5px] text-on-surface-variant">Valor cuota</p>
                          <p className="text-[13px] font-bold tabular-nums text-on-surface mt-0.5">{formatCOP(detalle.montoCuota)}</p>
                        </div>
                        <div className="bg-surface-high rounded-xl p-2.5">
                          <p className="text-[10.5px] text-on-surface-variant">Pagado</p>
                          <p className="text-[13px] font-bold tabular-nums mt-0.5" style={{ color: '#16a34a' }}>{formatCOP(detalle.totalPagado)}</p>
                        </div>
                        <div className="bg-surface-high rounded-xl p-2.5">
                          <p className="text-[10.5px] text-on-surface-variant">Saldo</p>
                          <p className="text-[13px] font-bold tabular-nums mt-0.5" style={{ color: detalle.saldo > 0 ? '#d97706' : 'var(--on-surface-variant)' }}>{formatCOP(detalle.saldo)}</p>
                        </div>
                      </div>

                      {/* Con atraso confirmado por Hotmart se muestra el valor
                          exacto del cobro que rebotó: es lo que hay que pedirle
                          al cliente, y no coincide con el saldo total cuando
                          quedan varias cuotas por delante. */}
                      {detalle.estado === 'atrasado' && detalle.montoVencido != null && (
                        <div className="rounded-xl p-2.5" style={{ background: `${ESTADO_COLOR.atrasado}14` }}>
                          <p className="text-[10.5px]" style={{ color: ESTADO_COLOR.atrasado }}>
                            Cuota vencida{detalle.diasSinPagar != null && ` hace ${detalle.diasSinPagar} días`}
                          </p>
                          <p className="text-[15px] font-bold tabular-nums mt-0.5" style={{ color: ESTADO_COLOR.atrasado }}>
                            {formatCOP(detalle.montoVencido)}
                          </p>
                          <p className="text-[10.5px] text-on-surface-variant mt-0.5">
                            Hotmart intentó cobrarla el {fmtFecha(detalle.proximaCuotaEstimada)} y fue rechazada
                          </p>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-1.5 mb-1 text-on-surface-variant">
                          <Calendar className="w-3.5 h-3.5" />
                          <span className="text-[10.5px] uppercase tracking-wide">Fechas</span>
                        </div>
                        <p className="text-on-surface">Última cuota pagada: <strong>{fmtFecha(detalle.fechaUltimaCuota)}</strong></p>
                        {detalle.estado === 'al-dia' && (
                          <p className="text-on-surface-variant mt-0.5">Próxima estimada: {fmtFecha(detalle.proximaCuotaEstimada)}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4 mt-4 border-t border-outline-variant/50">
                      <Link
                        href={`/estudiantes/${detalle.estudianteId}`}
                        className="flex-1 text-center px-3 py-2 rounded-lg text-[12.5px] font-semibold border border-outline-variant text-on-surface hover:bg-surface-high transition-colors"
                      >
                        Ver estudiante
                      </Link>
                      {detalle.telefono && detalle.estado !== 'completado' && (
                        <a
                          href={`https://wa.me/57${detalle.telefono.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" /> Contactar
                        </a>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {!isLoading && filtradas.length > 0 && (
          <div className="flex items-center justify-between pt-3">
            <p className="text-[11px] text-on-surface-variant">
              Página {pagina} de {totalPaginas} · {numero(filtradas.length)} filtrados
            </p>
            {totalPaginas > 1 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
                  className="p-2 rounded-lg border border-outline-variant hover:bg-surface-high disabled:opacity-40 transition-colors cursor-pointer">
                  <ChevronLeft className="w-4 h-4 text-on-surface-variant" />
                </button>
                <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}
                  className="p-2 rounded-lg border border-outline-variant hover:bg-surface-high disabled:opacity-40 transition-colors cursor-pointer">
                  <ChevronRight className="w-4 h-4 text-on-surface-variant" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
