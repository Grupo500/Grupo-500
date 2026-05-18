'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate, formatCOP, cn } from '@/lib/utils'
import { Wallet, Plus, X, Loader2, ChevronDown, ChevronRight, ChevronLeft, CheckCircle, Clock, AlertTriangle, Search, BookOpen } from 'lucide-react'

function FinanciamientoCard({ f }: { f: Financiamiento }) {
  const [expanded, setExpanded] = useState(false)
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getToken()
    return createClientFetcher(token)<T>(path, opts)
  }

  const pagarCuotaMutation = useMutation({
    mutationFn: (cuotaId: string) => fetcher(`/cuotas/${cuotaId}`, {
      method: 'PATCH',
      body: JSON.stringify({ pagado: true }),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financiamientos'] }),
  })

  const cuotasPagadas = f.cuotas.filter(c => c.pagado).length
  const progreso = f.cuotas.length > 0 ? (cuotasPagadas / f.cuotas.length) * 100 : 0
  const cfg = ESTADOS[f.estado]
  const cursoActivo = f.estudiante.cursos?.[0]
  const descuento = cursoActivo?.descuentoPorcentaje ?? 0

  return (
    <div className="bg-surface-lowest border border-outline-variant rounded-xl p-3 flex flex-col gap-2.5 hover:border-primary/30 transition-colors">
      {/* Nombre + estado */}
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-xs font-semibold text-on-surface leading-tight line-clamp-2 flex-1">{f.estudiante.nombre}</p>
        <span className={cn('inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold flex-shrink-0', cfg.color)}>{cfg.label}</span>
      </div>

      {/* Curso adquirido */}
      {cursoActivo && (
        <div className="flex items-center gap-1.5">
          <BookOpen className="w-3 h-3 text-on-surface-variant flex-shrink-0" />
          <p className="text-[10px] text-on-surface-variant truncate flex-1">{cursoActivo.curso.nombre}</p>
          {descuento > 0 && (
            <span className="text-[9px] font-bold bg-secondary/15 text-secondary px-1.5 py-0.5 rounded flex-shrink-0">
              -{descuento}%
            </span>
          )}
        </div>
      )}

      {/* Monto */}
      <p className="text-base font-bold text-on-surface tabular">{formatCOP(f.montoTotal)}</p>

      {/* Progreso */}
      <div className="space-y-1">
        <div className="w-full bg-surface-high rounded-full h-1.5">
          <div className="bg-secondary h-1.5 rounded-full transition-all" style={{ width: `${progreso}%` }} />
        </div>
        <p className="text-[10px] text-on-surface-variant text-right">{cuotasPagadas}/{f.cuotas.length} cuotas</p>
      </div>

      {/* Botón expandir */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-center gap-1 text-[11px] font-medium text-primary hover:bg-primary/10 py-1.5 rounded-lg transition-colors"
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        Ver cuotas
      </button>

      {/* Cuotas expandidas */}
      {expanded && (
        <div className="-mx-3 -mb-3 border-t border-outline-variant/40 pt-2 px-3 pb-3">
          <CuotasList f={f} pagarCuotaMutation={pagarCuotaMutation} />
        </div>
      )}
    </div>
  )
}

interface Cuota {
  id: string
  numero: number
  monto: number
  fechaVencimiento: string
  pagado: boolean
  fechaPago?: string
}

interface Financiamiento {
  id: string
  montoTotal: number
  estado: 'ACTIVO' | 'COMPLETADO' | 'CANCELADO'
  estudiante: {
    nombre: string
    email: string
    cursos?: { curso: { nombre: string; precio: number }; descuentoPorcentaje: number }[]
  }
  cuotas: Cuota[]
  createdAt: string
}

const ESTADOS = {
  ACTIVO: { label: 'Activo', color: 'text-primary bg-primary/10' },
  COMPLETADO: { label: 'Completado', color: 'text-secondary bg-secondary/10' },
  CANCELADO: { label: 'Cancelado', color: 'text-on-surface-variant bg-surface-high' },
}

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-surface-lowest border border-outline-variant rounded-xl shadow-float w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  )
}

function CuotasList({ f, pagarCuotaMutation }: { f: Financiamiento; pagarCuotaMutation: any }) {
  return (
    <div className="bg-surface-low rounded-lg border border-outline-variant/40 overflow-hidden">
      {/* Mobile: cuotas como filas compactas */}
      <div className="md:hidden divide-y divide-outline-variant/20">
        {f.cuotas.map(c => {
          const fecha = new Date(c.fechaVencimiento)
          const fechaCorta = fecha.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })
          const vencida = !c.pagado && fecha < new Date()
          return (
            <div key={c.id} className="px-3 py-2.5 flex items-center gap-2">
              <span className="text-[10px] text-on-surface-variant flex-shrink-0 w-5">#{c.numero}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-on-surface">{formatCOP(c.monto)}</p>
                <p className="text-[10px] text-on-surface-variant whitespace-nowrap">{fechaCorta}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {c.pagado
                  ? <span className="flex items-center gap-0.5 text-[10px] text-secondary font-medium whitespace-nowrap"><CheckCircle className="w-3 h-3" />Pagado</span>
                  : vencida
                    ? <span className="flex items-center gap-0.5 text-[10px] text-red-400 font-medium whitespace-nowrap"><AlertTriangle className="w-3 h-3" />Vencida</span>
                    : <span className="flex items-center gap-0.5 text-[10px] text-yellow-500 font-medium whitespace-nowrap"><Clock className="w-3 h-3" />Pendiente</span>
                }
                {!c.pagado && (
                  <button
                    onClick={() => pagarCuotaMutation.mutate(c.id)}
                    disabled={pagarCuotaMutation.isPending}
                    className="px-2 py-1 rounded-lg text-[10px] font-medium text-secondary bg-secondary/10 hover:bg-secondary/20 transition-colors disabled:opacity-30 whitespace-nowrap"
                  >
                    Pagar
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop: tabla */}
      <table className="hidden md:table w-full">
        <thead>
          <tr className="border-b border-outline-variant/40">
            <th className="text-left px-3 py-2 text-[11px] text-on-surface-variant uppercase tracking-wider">Cuota</th>
            <th className="text-left px-3 py-2 text-[11px] text-on-surface-variant uppercase tracking-wider">Monto</th>
            <th className="text-left px-3 py-2 text-[11px] text-on-surface-variant uppercase tracking-wider">Vencimiento</th>
            <th className="text-left px-3 py-2 text-[11px] text-on-surface-variant uppercase tracking-wider">Estado</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/20">
          {f.cuotas.map(c => (
            <tr key={c.id} className="group">
              <td className="px-3 py-2 text-xs text-on-surface-variant">#{c.numero}</td>
              <td className="px-3 py-2 text-sm font-medium text-on-surface">{formatCOP(c.monto)}</td>
              <td className="px-3 py-2 text-xs text-on-surface-variant">{formatDate(c.fechaVencimiento)}</td>
              <td className="px-3 py-2">
                {c.pagado
                  ? <span className="flex items-center gap-1 text-xs text-secondary"><CheckCircle className="w-3 h-3" />Pagado</span>
                  : new Date(c.fechaVencimiento) < new Date()
                    ? <span className="flex items-center gap-1 text-xs text-red-400"><AlertTriangle className="w-3 h-3" />Vencida</span>
                    : <span className="flex items-center gap-1 text-xs text-yellow-400"><Clock className="w-3 h-3" />Pendiente</span>
                }
              </td>
              <td className="px-3 py-2 text-right">
                {!c.pagado && (
                  <button
                    onClick={() => pagarCuotaMutation.mutate(c.id)}
                    disabled={pagarCuotaMutation.isPending}
                    className="px-2 py-0.5 rounded text-[11px] font-medium text-secondary bg-secondary/10 hover:bg-secondary/20 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-30"
                  >
                    Pagar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FinanciamientoRow({ f }: { f: Financiamiento }) {
  const [expanded, setExpanded] = useState(false)
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getToken()
    return createClientFetcher(token)<T>(path, opts)
  }

  const pagarCuotaMutation = useMutation({
    mutationFn: (cuotaId: string) => fetcher(`/cuotas/${cuotaId}`, {
      method: 'PATCH',
      body: JSON.stringify({ pagado: true }),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financiamientos'] }),
  })

  const cuotasPagadas = f.cuotas.filter(c => c.pagado).length
  const progreso = f.cuotas.length > 0 ? (cuotasPagadas / f.cuotas.length) * 100 : 0

  return (
    <>
      {/* Desktop: fila tabla */}
      <tr className="hidden md:table-row hover:bg-surface-low/40 transition-colors">
        <td className="px-4 py-3">
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2">
            {expanded ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-on-surface-variant" />}
            <div>
              <p className="text-sm font-medium text-on-surface">{f.estudiante.nombre}</p>
              <p className="text-xs text-on-surface-variant">{f.estudiante.email}</p>
            </div>
          </button>
        </td>
        <td className="px-4 py-3">
          <p className="text-sm font-semibold text-on-surface">{formatCOP(f.montoTotal)}</p>
        </td>
        <td className="px-4 py-3 hidden md:table-cell">
          <span className={cn('inline-flex px-2 py-0.5 rounded text-[11px] font-medium', ESTADOS[f.estado].color)}>
            {ESTADOS[f.estado].label}
          </span>
        </td>
        <td className="px-4 py-3 hidden lg:table-cell">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-surface-high rounded-full h-1.5 w-24">
              <div className="bg-secondary h-1.5 rounded-full transition-all" style={{ width: `${progreso}%` }} />
            </div>
            <span className="text-xs text-on-surface-variant whitespace-nowrap">{cuotasPagadas}/{f.cuotas.length}</span>
          </div>
        </td>
        <td className="px-4 py-3 hidden xl:table-cell">
          <span className="text-xs text-on-surface-variant">{formatDate(f.createdAt)}</span>
        </td>
      </tr>

      {/* Cuotas expandidas */}
      {expanded && (
        <tr>
          <td colSpan={5} className="px-4 pb-4">
            <div className="ml-6">
              <CuotasList f={f} pagarCuotaMutation={pagarCuotaMutation} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function FinanciamientosPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [busquedaInput, setBusquedaInput] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [page, setPage] = useState(1)
  const [modalCrear, setModalCrear] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { setBusqueda(busquedaInput); setPage(1) }, 200)
    return () => clearTimeout(t)
  }, [busquedaInput])

  const [form, setForm] = useState({
    estudianteId: '',
    montoTotal: '',
    numeroCuotas: '3',
    primerVencimiento: '',
  })

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getToken()
    return createClientFetcher(token)<T>(path, opts)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['financiamientos', page, busqueda],
    queryFn: () => fetcher<any>(`/financiamientos?page=${page}&limit=20${busqueda ? `&nombre=${encodeURIComponent(busqueda)}` : ''}`),
  })

  const { data: estudiantesData } = useQuery({
    queryKey: ['estudiantes-select'],
    queryFn: () => fetcher<any>('/estudiantes?limit=100'),
  })

  const [formError, setFormError] = useState('')

  const crearMutation = useMutation({
    mutationFn: () => {
      if (!form.estudianteId || !form.montoTotal || !form.primerVencimiento)
        throw new Error('Completa todos los campos obligatorios')
      return fetcher('/financiamientos', {
        method: 'POST',
        body: JSON.stringify({
          estudianteId: form.estudianteId,
          montoTotal: Number(form.montoTotal),
          numeroCuotas: Number(form.numeroCuotas),
          fechaPrimeraCuota: form.primerVencimiento,
        }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financiamientos'] })
      setModalCrear(false)
      setFormError('')
      setForm({ estudianteId: '', montoTotal: '', numeroCuotas: '3', primerVencimiento: '' })
    },
    onError: (e: any) => setFormError(e.message ?? 'Error al crear financiamiento'),
  })

  const financiamientos: Financiamiento[] = data?.data ?? []
  const total = data?.pagination?.total ?? 0
  const totalPages = data?.pagination?.totalPages ?? 1
  const estudiantes = estudiantesData?.data ?? []

  const inputCls = 'w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20'
  const labelCls = 'block text-xs font-medium text-on-surface-variant mb-1'

  const montoCuota = form.montoTotal && form.numeroCuotas
    ? formatCOP(Number(form.montoTotal) / Number(form.numeroCuotas))
    : '—'

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Financiamientos"
        subtitle={`${total} financiamientos activos`}
        actions={
          <button
            onClick={() => setModalCrear(true)}
            className="flex items-center gap-2 px-2.5 py-2.5 sm:px-4 sm:py-2 bg-primary text-on-primary rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo financiamiento</span>
          </button>
        }
      />

      {/* Búsqueda */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Buscar por estudiante..."
            value={busquedaInput}
            onChange={e => setBusquedaInput(e.target.value)}
            className="w-full bg-surface-high border border-outline-variant rounded-lg pl-9 pr-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
        </div>
        {busquedaInput && (
          <button type="button" onClick={() => setBusquedaInput('')} className="px-3 py-2 text-on-surface-variant hover:text-on-surface">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Grid mobile (< md) ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 md:hidden"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : financiamientos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant bg-surface-lowest border border-outline-variant rounded-xl md:hidden">
          <Wallet className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No hay financiamientos registrados</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:hidden">
          {financiamientos.map(f => <FinanciamientoCard key={f.id} f={f} />)}
        </div>
      )}

      {/* Paginación mobile */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between md:hidden">
          <p className="text-xs text-white/70">Pág. {page} / {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-high disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-high disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* ── Tabla desktop (≥ md) ── */}
      <div className="hidden md:block bg-surface-lowest border border-outline-variant rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
        ) : financiamientos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
            <Wallet className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No hay financiamientos registrados</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-low">
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Estudiante</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden md:table-cell">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">Progreso</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden xl:table-cell">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {financiamientos.map(f => <FinanciamientoRow key={f.id} f={f} />)}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant/40">
            <p className="text-xs text-on-surface-variant">Página {page} de {totalPages} · {total} resultados</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-high disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-high disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      <Modal open={modalCrear} onClose={() => setModalCrear(false)}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-on-surface">Nuevo financiamiento</h2>
            <button onClick={() => setModalCrear(false)} className="p-1.5 text-on-surface-variant hover:text-on-surface"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Estudiante *</label>
              <select className={inputCls} value={form.estudianteId} onChange={e => setForm(f => ({ ...f, estudianteId: e.target.value }))}>
                <option value="">Seleccionar estudiante...</option>
                {estudiantes.map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Monto total *</label>
              <input className={inputCls} type="number" value={form.montoTotal} onChange={e => setForm(f => ({ ...f, montoTotal: e.target.value }))} placeholder="1500000" />
            </div>
            <div>
              <label className={labelCls}>Número de cuotas *</label>
              <select className={inputCls} value={form.numeroCuotas} onChange={e => setForm(f => ({ ...f, numeroCuotas: e.target.value }))}>
                {[2,3,4,5,6,8,10,12].map(n => <option key={n} value={n}>{n} cuotas</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Primer vencimiento *</label>
              <input className={inputCls} type="date" value={form.primerVencimiento} onChange={e => setForm(f => ({ ...f, primerVencimiento: e.target.value }))} />
            </div>
            {form.montoTotal && (
              <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 text-xs text-on-surface-variant">
                <span className="text-primary font-semibold">Cuota mensual estimada: </span>{montoCuota}
              </div>
            )}
          </div>
          {formError && (
            <p className="mt-4 text-xs text-[var(--error)] bg-[var(--error-container)]/40 border border-[var(--error)]/20 rounded-lg px-3 py-2">{formError}</p>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => { setModalCrear(false); setFormError('') }} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface">Cancelar</button>
            <button
              onClick={() => crearMutation.mutate()}
              disabled={crearMutation.isPending || !form.estudianteId || !form.montoTotal || !form.primerVencimiento}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {crearMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Crear financiamiento
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
