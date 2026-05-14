'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate, formatCOP, cn } from '@/lib/utils'
import {
  CreditCard, Plus, X, Loader2, ChevronLeft, ChevronRight,
  CheckCircle, Clock, AlertTriangle, XCircle, Filter,
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
  const [modalRegistrar, setModalRegistrar] = useState(false)
  const [modalMarcarPagado, setModalMarcarPagado] = useState<Pago | null>(null)

  const [form, setForm] = useState({
    estudianteId: '',
    estudianteNombre: '',
    monto: '',
    metodo: 'TRANSFERENCIA',
    fechaVencimiento: '',
  })

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getToken()
    return createClientFetcher(token)<T>(path, opts)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['pagos', page, filtroEstado],
    queryFn: () => fetcher<any>(
      `/pagos?page=${page}&limit=15${filtroEstado ? `&estado=${filtroEstado}` : ''}`
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
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos'] })
      setModalRegistrar(false)
      setForm({ estudianteId: '', estudianteNombre: '', monto: '', metodo: 'TRANSFERENCIA', fechaVencimiento: '' })
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
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Registrar pago
          </button>
        }
      />

      {/* Filtros */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-on-surface-variant" />
        {['', 'PENDIENTE', 'PAGADO', 'VENCIDO', 'CANCELADO'].map(estado => (
          <button
            key={estado}
            onClick={() => { setFiltroEstado(estado); setPage(1) }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              filtroEstado === estado
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'bg-surface-high text-on-surface-variant border border-outline-variant hover:bg-surface-highest'
            )}
          >
            {estado === '' ? 'Todos' : ESTADOS[estado as keyof typeof ESTADOS]?.label}
          </button>
        ))}
      </div>

      {/* Tabla */}
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
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-low">
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Estudiante</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Monto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden md:table-cell">Estado</th>
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
                    <p className="text-xs text-on-surface-variant">{p.asesor?.nombre ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-on-surface">{formatCOP(p.monto)}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <EstadoBadge estado={p.estado} />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-on-surface-variant">{METODOS[p.metodo]}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-on-surface-variant">{formatDate(p.fechaVencimiento)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.estado === 'PENDIENTE' && (
                      <button
                        onClick={() => setModalMarcarPagado(p)}
                        className="px-2.5 py-1 rounded text-xs font-medium text-secondary bg-secondary/10 hover:bg-secondary/20 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        Marcar pagado
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <input className={inputCls} type="date" value={form.fechaVencimiento} onChange={e => setForm(f => ({ ...f, fechaVencimiento: e.target.value }))} />
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
