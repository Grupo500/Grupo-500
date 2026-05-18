'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate, formatCOP, cn } from '@/lib/utils'
import {
  CreditCard, Plus, X, Loader2, ChevronLeft, ChevronRight,
  CheckCircle, Clock, AlertTriangle, XCircle, Filter, Pencil,
  Paperclip, ExternalLink, Trash2, Search,
} from 'lucide-react'

interface Pago {
  id: string
  monto: number
  estado: 'PENDIENTE' | 'PAGADO' | 'VENCIDO' | 'CANCELADO'
  metodo: 'TRANSFERENCIA' | 'TARJETA' | 'EFECTIVO' | 'OTRO'
  fechaVencimiento: string
  fechaPago?: string
  comprobante?: string
  estudiante: { nombre: string; email: string }
  asesor?: { nombre: string }
  createdAt: string
}

const ESTADOS = {
  PENDIENTE: { label: 'Pendiente', icon: Clock, color: 'text-yellow-400 bg-yellow-400/10' },
  PAGADO: { label: 'Pagado', icon: CheckCircle, color: 'text-secondary bg-secondary/10' },
  VENCIDO: { label: 'Vencido', icon: AlertTriangle, color: 'text-red-400 bg-red-400/10' },
  CANCELADO: { label: 'Cancelado', icon: XCircle, color: 'text-on-surface-variant bg-surface-high' },
}

const METODOS = {
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
  EFECTIVO: 'Efectivo',
  OTRO: 'Otro',
}

function EstadoBadge({ estado }: { estado: keyof typeof ESTADOS }) {
  const { label, icon: Icon, color } = ESTADOS[estado]
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium', color)}>
      <Icon className="w-3 h-3" />{label}
    </span>
  )
}

function ComprobanteUpload({
  value, onChange, getToken,
}: {
  value: string
  onChange: (url: string) => void
  getToken: () => Promise<string | null>
}) {
  const [uploading, setUploading] = useState(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const token = await getToken()
      const formData = new FormData()
      formData.append('file', file)
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      const res = await fetch(`${API_URL}/upload/imagen`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      if (data?.data?.url) onChange(data.data.url)
      else throw new Error('No se recibió URL del comprobante')
    } catch (err: any) {
      alert(`Error al subir el comprobante: ${err?.message ?? 'Error desconocido'}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 w-full cursor-pointer px-3 py-2 bg-surface-high border border-outline-variant rounded-lg hover:bg-surface-highest transition-colors">
        <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} disabled={uploading} />
        {uploading
          ? <Loader2 className="w-4 h-4 text-primary animate-spin" />
          : <Paperclip className="w-4 h-4 text-on-surface-variant" />}
        <span className="text-sm text-on-surface-variant">
          {uploading ? 'Subiendo...' : value ? 'Cambiar comprobante' : 'Adjuntar comprobante'}
        </span>
      </label>
      {value && (
        <a href={value} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
          <ExternalLink className="w-3 h-3" />
          Ver comprobante adjunto
        </a>
      )}
    </div>
  )
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

export default function PagosPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [busquedaInput, setBusquedaInput] = useState('')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    const t = setTimeout(() => { setBusqueda(busquedaInput); setPage(1) }, 200)
    return () => clearTimeout(t)
  }, [busquedaInput])
  const [modalRegistrar, setModalRegistrar] = useState(false)
  const [modalMarcarPagado, setModalMarcarPagado] = useState<Pago | null>(null)
  const [modalEditar, setModalEditar] = useState<Pago | null>(null)
  const [modalEliminar, setModalEliminar] = useState<Pago | null>(null)

  const [form, setForm] = useState({
    estudianteId: '',
    estudianteNombre: '',
    monto: '',
    metodo: 'TRANSFERENCIA',
    fechaVencimiento: '',
    comprobante: '',
  })

  const [formEditar, setFormEditar] = useState({
    monto: '',
    metodo: 'TRANSFERENCIA',
    estado: 'PENDIENTE',
    fechaVencimiento: '',
    comprobante: '',
  })

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const t = await getToken()
    return createClientFetcher(t)<T>(path, opts)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['pagos', page, filtroEstado, busqueda],
    queryFn: () => fetcher<any>(
      `/pagos?page=${page}&limit=15${filtroEstado ? `&estado=${filtroEstado}` : ''}${busqueda ? `&nombre=${encodeURIComponent(busqueda)}` : ''}`
    ),
  })

  const { data: estudiantesData } = useQuery({
    queryKey: ['estudiantes-select'],
    queryFn: () => fetcher<any>('/estudiantes?limit=100'),
  })

  const registrarMutation = useMutation({
    mutationFn: () => fetcher('/pagos', {
      method: 'POST',
      body: JSON.stringify({
        estudianteId: form.estudianteId,
        monto: Number(form.monto),
        metodo: form.metodo,
        fechaVencimiento: form.fechaVencimiento,
        ...(form.comprobante ? { comprobante: form.comprobante } : {}),
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos'] })
      setModalRegistrar(false)
      setForm({ estudianteId: '', estudianteNombre: '', monto: '', metodo: 'TRANSFERENCIA', fechaVencimiento: '', comprobante: '' })
    },
    onError: (err: any) => {
      alert(err?.message ?? 'Error al registrar pago')
    },
  })

  const marcarPagadoMutation = useMutation({
    mutationFn: (id: string) => fetcher(`/pagos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ estado: 'PAGADO' }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos'] })
      setModalMarcarPagado(null)
    },
  })

  const editarMutation = useMutation({
    mutationFn: (id: string) => fetcher(`/pagos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        monto: Number(formEditar.monto),
        metodo: formEditar.metodo,
        estado: formEditar.estado,
        fechaVencimiento: formEditar.fechaVencimiento,
        ...(formEditar.comprobante ? { comprobante: formEditar.comprobante } : {}),
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos'] })
      setModalEditar(null)
    },
    onError: (err: any) => {
      alert(err?.message ?? 'Error al actualizar pago')
    },
  })

  const eliminarMutation = useMutation({
    mutationFn: (id: string) => fetcher(`/pagos/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos'] })
      setModalEliminar(null)
    },
    onError: (err: any) => {
      alert(err?.message ?? 'Error al eliminar pago')
    },
  })

  const abrirEditar = (p: Pago) => {
    setFormEditar({
      monto: String(p.monto),
      metodo: p.metodo,
      estado: p.estado,
      fechaVencimiento: p.fechaVencimiento.split('T')[0],
      comprobante: p.comprobante ?? '',
    })
    setModalEditar(p)
  }

  const pagos: Pago[] = data?.data ?? []
  const total = data?.pagination?.total ?? 0
  const totalPages = data?.pagination?.totalPages ?? 1
  const estudiantes = estudiantesData?.data ?? []

  const inputCls = 'w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20'
  const labelCls = 'block text-xs font-medium text-on-surface-variant mb-1'

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Pagos"
        subtitle={`${total} pagos registrados`}
        actions={
          <button
            onClick={() => setModalRegistrar(true)}
            className="flex items-center gap-2 px-2.5 py-2.5 sm:px-4 sm:py-2 bg-primary text-on-primary rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Registrar pago</span>
          </button>
        }
      />

      {/* Búsqueda + Filtro estado */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
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
        {/* Mobile: select */}
        <div className="flex items-center gap-2 md:hidden">
          <Filter className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
          <select
            value={filtroEstado}
            onChange={e => { setFiltroEstado(e.target.value); setPage(1) }}
            className="bg-surface-high border border-outline-variant rounded-lg px-3 py-1.5 text-xs font-medium text-on-surface focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 cursor-pointer"
          >
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="PAGADO">Pagado</option>
            <option value="VENCIDO">Vencido</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </div>
        {/* Desktop: pills */}
        <div className="hidden md:flex items-center gap-1.5">
          {[
            { value: '', label: 'Todos' },
            { value: 'PENDIENTE', label: 'Pendiente' },
            { value: 'PAGADO', label: 'Pagado' },
            { value: 'VENCIDO', label: 'Vencido' },
            { value: 'CANCELADO', label: 'Cancelado' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => { setFiltroEstado(opt.value); setPage(1) }}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                filtroEstado === opt.value
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-high text-on-surface-variant hover:bg-surface-highest border border-outline-variant'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista / Tabla */}
      <div className="bg-surface-lowest border border-outline-variant rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : pagos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
            <CreditCard className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No hay pagos registrados</p>
          </div>
        ) : (
          <>
            {/* ── Tarjetas móvil ── */}
            <div className="md:hidden divide-y divide-outline-variant/40">
              {pagos.map((p) => (
                <div key={p.id} className="p-4 space-y-3">
                  {/* Fila 1: nombre + acciones rápidas */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-on-surface truncate">{p.estudiante.nombre}</p>
                      {p.asesor?.nombre && <p className="text-xs text-on-surface-variant truncate">{p.asesor.nombre}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => abrirEditar(p)}
                        className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setModalEliminar(p)}
                        className="p-2 rounded-lg text-on-surface-variant hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {/* Fila 2: monto + estado */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-lg font-bold text-on-surface">{formatCOP(p.monto)}</p>
                    <EstadoBadge estado={p.estado} />
                  </div>
                  {/* Fila 3: método + vencimiento + marcar pagado */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-on-surface-variant">{METODOS[p.metodo]} · Vence {formatDate(p.fechaVencimiento)}</p>
                    {p.estado === 'PENDIENTE' && (
                      <button
                        onClick={() => setModalMarcarPagado(p)}
                        className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium text-secondary bg-secondary/10 hover:bg-secondary/20 transition-colors"
                      >
                        Marcar pagado
                      </button>
                    )}
                  </div>
                  {/* Comprobante */}
                  {p.comprobante && (
                    <a href={p.comprobante} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                      <ExternalLink className="w-3 h-3" />
                      Ver comprobante
                    </a>
                  )}
                </div>
              ))}
            </div>

            {/* ── Tabla desktop ── */}
            <table className="w-full hidden md:table">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-low">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Estudiante</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Monto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">Método</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">Vencimiento</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40">
                {pagos.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-low/40 transition-colors group">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-on-surface">{p.estudiante.nombre}</p>
                      {p.asesor?.nombre && <p className="text-xs text-on-surface-variant">{p.asesor.nombre}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-on-surface">{formatCOP(p.monto)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={p.estado} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-on-surface-variant">{METODOS[p.metodo]}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-on-surface-variant">{formatDate(p.fechaVencimiento)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {p.estado === 'PENDIENTE' && (
                          <button
                            onClick={() => setModalMarcarPagado(p)}
                            className="px-2.5 py-1 rounded text-xs font-medium text-secondary bg-secondary/10 hover:bg-secondary/20 transition-colors"
                          >
                            Marcar pagado
                          </button>
                        )}
                        <button
                          onClick={() => abrirEditar(p)}
                          className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setModalEliminar(p)}
                          className="p-1.5 rounded text-on-surface-variant hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant/40">
            <p className="text-xs text-on-surface-variant">Página {page} de {totalPages} · {total} resultados</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-high disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-high disabled:opacity-30 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal registrar pago */}
      <Modal open={modalRegistrar} onClose={() => setModalRegistrar(false)}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-on-surface">Registrar pago</h2>
            <button onClick={() => setModalRegistrar(false)} className="p-1.5 text-on-surface-variant hover:text-on-surface">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Estudiante *</label>
              <select
                className={inputCls}
                value={form.estudianteId}
                onChange={e => setForm(f => ({ ...f, estudianteId: e.target.value }))}
              >
                <option value="">Seleccionar estudiante...</option>
                {estudiantes.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Monto *</label>
              <input className={inputCls} type="number" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} placeholder="500000" />
            </div>
            <div>
              <label className={labelCls}>Método de pago *</label>
              <select className={inputCls} value={form.metodo} onChange={e => setForm(f => ({ ...f, metodo: e.target.value }))}>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="TARJETA">Tarjeta</option>
                <option value="EFECTIVO">Efectivo</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Fecha de vencimiento *</label>
              <input
                className={cn(inputCls, 'w-auto min-w-0 max-w-[180px]')}
                type="date"
                value={form.fechaVencimiento}
                onChange={e => setForm(f => ({ ...f, fechaVencimiento: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Comprobante</label>
              <ComprobanteUpload
                value={form.comprobante}
                onChange={url => setForm(f => ({ ...f, comprobante: url }))}
                getToken={getToken}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setModalRegistrar(false)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface">Cancelar</button>
            <button
              onClick={() => registrarMutation.mutate()}
              disabled={registrarMutation.isPending || !form.estudianteId || !form.monto || !form.fechaVencimiento}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {registrarMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Registrar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal editar pago */}
      <Modal open={!!modalEditar} onClose={() => setModalEditar(null)}>
        {modalEditar && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-semibold text-on-surface">Editar pago</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">{modalEditar.estudiante.nombre}</p>
              </div>
              <button onClick={() => setModalEditar(null)} className="p-1.5 text-on-surface-variant hover:text-on-surface">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Monto *</label>
                <input className={inputCls} type="number" value={formEditar.monto} onChange={e => setFormEditar(f => ({ ...f, monto: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Estado</label>
                <select className={inputCls} value={formEditar.estado} onChange={e => setFormEditar(f => ({ ...f, estado: e.target.value }))}>
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="PAGADO">Pagado</option>
                  <option value="VENCIDO">Vencido</option>
                  <option value="CANCELADO">Cancelado</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Método de pago</label>
                <select className={inputCls} value={formEditar.metodo} onChange={e => setFormEditar(f => ({ ...f, metodo: e.target.value }))}>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="TARJETA">Tarjeta</option>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Fecha de vencimiento</label>
                <input
                  className={cn(inputCls, 'w-auto min-w-0 max-w-[180px]')}
                  type="date"
                  value={formEditar.fechaVencimiento}
                  onChange={e => setFormEditar(f => ({ ...f, fechaVencimiento: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>Comprobante</label>
                <ComprobanteUpload
                  value={formEditar.comprobante}
                  onChange={url => setFormEditar(f => ({ ...f, comprobante: url }))}
                  getToken={getToken}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModalEditar(null)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface">Cancelar</button>
              <button
                onClick={() => editarMutation.mutate(modalEditar.id)}
                disabled={editarMutation.isPending || !formEditar.monto || !formEditar.fechaVencimiento}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {editarMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Guardar cambios
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal eliminar pago */}
      <Modal open={!!modalEliminar} onClose={() => setModalEliminar(null)}>
        {modalEliminar && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-on-surface">Eliminar pago</h2>
              <button onClick={() => setModalEliminar(null)} className="p-1.5 text-on-surface-variant hover:text-on-surface"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-on-surface-variant mb-2">¿Eliminar el pago de <span className="text-on-surface font-semibold">{formatCOP(modalEliminar.monto)}</span> de:</p>
            <p className="text-sm font-semibold text-on-surface mb-1">{modalEliminar.estudiante.nombre}</p>
            <p className="text-xs text-red-400 mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setModalEliminar(null)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface">Cancelar</button>
              <button
                onClick={() => eliminarMutation.mutate(modalEliminar.id)}
                disabled={eliminarMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {eliminarMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Eliminar pago
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal confirmar pagado */}
      <Modal open={!!modalMarcarPagado} onClose={() => setModalMarcarPagado(null)}>
        {modalMarcarPagado && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-on-surface">Confirmar pago</h2>
              <button onClick={() => setModalMarcarPagado(null)} className="p-1.5 text-on-surface-variant hover:text-on-surface"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-on-surface-variant mb-2">¿Confirmar pago de <span className="text-on-surface font-semibold">{formatCOP(modalMarcarPagado.monto)}</span> de:</p>
            <p className="text-sm font-semibold text-on-surface mb-6">{modalMarcarPagado.estudiante.nombre}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setModalMarcarPagado(null)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface">Cancelar</button>
              <button
                onClick={() => marcarPagadoMutation.mutate(modalMarcarPagado.id)}
                disabled={marcarPagadoMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-black rounded-lg text-sm font-medium hover:bg-secondary/90 disabled:opacity-50 transition-colors"
              >
                {marcarPagadoMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirmar pago
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
