'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCOP, formatDate, cn } from '@/lib/utils'
import {
  Wallet, CheckCircle, AlertTriangle, Loader2,
  X, Search, BookOpen, Paperclip, ExternalLink, Users,
} from 'lucide-react'
import { isBefore, parseISO, isToday } from 'date-fns'

/* ─── Tipos ──────────────────────────────────────────────────────────────── */
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
  createdAt: string
  estudiante: {
    nombre: string
    email: string
    acudiente?: { nombre: string; telefono: string } | null
    cursos?: { curso: { nombre: string } }[]
  }
  cuotas: Cuota[]
}

interface Pago {
  id: string
  monto: number
  estado: 'PENDIENTE' | 'PAGADO' | 'VENCIDO' | 'CANCELADO'
  metodo: string
  fechaVencimiento: string
  fechaPago?: string
  comprobante?: string
  createdAt: string
  estudiante: { nombre: string; email: string }
  asesor?: { nombre: string }
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function esVencidaCuota(c: Cuota) {
  return !c.pagado && isBefore(parseISO(c.fechaVencimiento), new Date()) && !isToday(parseISO(c.fechaVencimiento))
}

/* ─── Componente Modal ───────────────────────────────────────────────────── */
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

/* ─── Detalle de Financiamiento ──────────────────────────────────────────── */
function DetalleFinanciamiento({
  f, onClose, fetcher,
}: {
  f: Financiamiento
  onClose: () => void
  fetcher: <T>(path: string, opts?: RequestInit) => Promise<T>
}) {
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)

  const pagarMutation = useMutation({
    mutationFn: (cuotaId: string) => fetcher(`/cuotas/${cuotaId}`, {
      method: 'PATCH',
      body: JSON.stringify({ pagado: true }),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financiamientos'] }),
  })

  const cuotasPagadas = f.cuotas.filter(c => c.pagado).length
  const progreso = f.cuotas.length > 0 ? (cuotasPagadas / f.cuotas.length) * 100 : 0
  const montoPagado = f.cuotas.filter(c => c.pagado).reduce((s, c) => s + c.monto, 0)
  const montoPendiente = f.montoTotal - montoPagado
  const curso = f.estudiante.cursos?.[0]?.curso.nombre

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[11px] text-on-surface-variant font-medium mb-0.5">Financiamiento quincenal</p>
          <h2 className="text-base font-bold text-on-surface">{f.estudiante.nombre}</h2>
          {curso && (
            <div className="flex items-center gap-1 mt-1">
              <BookOpen className="w-3 h-3 text-on-surface-variant" />
              <p className="text-[11px] text-on-surface-variant">{curso}</p>
            </div>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 text-on-surface-variant hover:text-on-surface">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Resumen de montos */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Total', value: formatCOP(f.montoTotal), color: 'text-on-surface' },
          { label: 'Pagado', value: formatCOP(montoPagado), color: 'text-secondary' },
          { label: 'Pendiente', value: formatCOP(montoPendiente), color: montoPendiente > 0 ? 'text-yellow-500' : 'text-secondary' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface-high rounded-lg p-2.5 text-center">
            <p className={cn('text-[13px] font-bold tabular', color)}>{value}</p>
            <p className="text-[10px] text-on-surface-variant mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Progreso */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] text-on-surface-variant mb-1">
          <span>Progreso de pago</span>
          <span>{cuotasPagadas}/{f.cuotas.length} cuotas</span>
        </div>
        <div className="w-full bg-surface-high rounded-full h-1.5">
          <div className="bg-secondary h-1.5 rounded-full transition-all" style={{ width: `${progreso}%` }} />
        </div>
      </div>

      {/* Lista de cuotas */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">Cuotas</p>
        {f.cuotas.map(c => {
          const vencida = esVencidaCuota(c)
          const fechaStr = new Date(c.fechaVencimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })
          return (
            <div key={c.id} className={cn(
              'flex items-center justify-between rounded-lg px-3 py-2.5 border',
              c.pagado ? 'bg-secondary/8 border-secondary/20'
                : vencida ? 'bg-red-500/8 border-red-500/20'
                : 'bg-surface-high border-outline-variant/40'
            )}>
              <div className="flex items-center gap-2.5">
                <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                  c.pagado ? 'bg-secondary text-white'
                    : vencida ? 'bg-red-500/20 text-red-400'
                    : 'bg-surface-highest text-on-surface-variant'
                )}>
                  {c.numero}
                </div>
                <div>
                  <p className="text-[12px] font-bold text-on-surface tabular">{formatCOP(c.monto)}</p>
                  <p className="text-[10px] text-on-surface-variant">{fechaStr}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {c.pagado ? (
                  <span className="flex items-center gap-0.5 text-[10px] text-secondary font-semibold">
                    <CheckCircle className="w-3 h-3" />Pagado
                  </span>
                ) : vencida ? (
                  <span className="flex items-center gap-0.5 text-[10px] text-red-400 font-semibold">
                    <AlertTriangle className="w-3 h-3" />Vencida
                  </span>
                ) : (
                  <button
                    onClick={() => pagarMutation.mutate(c.id)}
                    disabled={pagarMutation.isPending}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {pagarMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                    Pagar
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Detalle de Pago único ──────────────────────────────────────────────── */
function DetallePago({
  p, onClose, fetcher,
}: {
  p: Pago
  onClose: () => void
  fetcher: <T>(path: string, opts?: RequestInit) => Promise<T>
}) {
  const queryClient = useQueryClient()

  const pagarMutation = useMutation({
    mutationFn: () => fetcher(`/pagos/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ estado: 'PAGADO', fechaPago: new Date().toISOString() }),
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pagos'] }); onClose() },
  })

  const isPendiente = p.estado === 'PENDIENTE'
  const isVencido = p.estado === 'VENCIDO'

  return (
    <div className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[11px] text-on-surface-variant font-medium mb-0.5">Pago único</p>
          <h2 className="text-base font-bold text-on-surface">{p.estudiante.nombre}</h2>
          <p className="text-[11px] text-on-surface-variant mt-0.5">{p.estudiante.email}</p>
        </div>
        <button onClick={onClose} className="p-1.5 text-on-surface-variant hover:text-on-surface">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Monto */}
      <div className="bg-surface-high rounded-xl p-4 text-center mb-4">
        <p className="text-2xl font-bold text-on-surface tabular">{formatCOP(p.monto)}</p>
        <p className="text-[11px] text-on-surface-variant mt-1">Vence: {formatDate(p.fechaVencimiento)}</p>
        {p.fechaPago && <p className="text-[11px] text-secondary mt-0.5">Pagado: {formatDate(p.fechaPago)}</p>}
      </div>

      {/* Estado */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-on-surface-variant">Estado</span>
          <span className={cn('font-semibold',
            p.estado === 'PAGADO' ? 'text-secondary'
              : p.estado === 'VENCIDO' ? 'text-red-400'
              : 'text-yellow-500'
          )}>
            {p.estado === 'PAGADO' ? 'Pagado' : p.estado === 'VENCIDO' ? 'Vencido' : 'Pendiente'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-on-surface-variant">Método</span>
          <span className="text-on-surface font-medium">{p.metodo}</span>
        </div>
        {p.asesor && (
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Asesor</span>
            <span className="text-on-surface font-medium">{p.asesor.nombre}</span>
          </div>
        )}
      </div>

      {/* Comprobante */}
      {p.comprobante && (
        <a href={p.comprobante} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-high border border-outline-variant/40 hover:border-primary/30 transition-colors mb-4">
          <Paperclip className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-sm text-on-surface flex-1">Ver comprobante</span>
          <ExternalLink className="w-3.5 h-3.5 text-on-surface-variant" />
        </a>
      )}

      {(isPendiente || isVencido) && (
        <button
          onClick={() => pagarMutation.mutate()}
          disabled={pagarMutation.isPending}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {pagarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Marcar como pagado
        </button>
      )}
    </div>
  )
}

/* ─── Vista Matrículas ───────────────────────────────────────────────────── */
function MatriculasView({
  financiamientos, pagos, isLoading, fetcher,
}: {
  financiamientos: Financiamiento[]
  pagos: Pago[]
  isLoading: boolean
  fetcher: <T>(path: string, opts?: RequestInit) => Promise<T>
}) {
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'pendiente' | 'vencido' | 'completado'>('todos')
  const [seleccionado, setSeleccionado] = useState<
    | { tipo: 'financiamiento'; data: Financiamiento }
    | { tipo: 'pago'; data: Pago }
    | null
  >(null)

  // Filtrado
  const q = busqueda.toLowerCase()
  const finsFiltrados = financiamientos.filter(f => {
    if (q && !f.estudiante.nombre.toLowerCase().includes(q)) return false
    if (filtro === 'completado') return f.estado === 'COMPLETADO'
    if (filtro === 'pendiente') return f.estado === 'ACTIVO' && f.cuotas.some(c => !c.pagado && !esVencidaCuota(c))
    if (filtro === 'vencido') return f.cuotas.some(c => esVencidaCuota(c))
    return true
  })
  const pagosFiltrados = pagos.filter(p => {
    if (q && !p.estudiante.nombre.toLowerCase().includes(q)) return false
    if (filtro === 'completado') return p.estado === 'PAGADO'
    if (filtro === 'pendiente') return p.estado === 'PENDIENTE'
    if (filtro === 'vencido') return p.estado === 'VENCIDO'
    return true
  })

  const totalItems = finsFiltrados.length + pagosFiltrados.length

  return (
    <>
      {/* Búsqueda + filtros */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Buscar estudiante..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full bg-surface-high border border-outline-variant rounded-lg pl-9 pr-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['todos', 'pendiente', 'vencido', 'completado'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={cn('px-3 py-1 rounded-full text-[11px] font-semibold transition-colors',
                filtro === f ? 'bg-primary text-white' : 'bg-surface-high text-on-surface-variant hover:text-on-surface'
              )}>
              {f === 'todos' ? 'Todos' : f === 'pendiente' ? 'Pendientes' : f === 'vencido' ? 'Vencidos' : 'Completados'}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : totalItems === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant card">
          <Users className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No hay cobros que mostrar</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {/* Financiamientos */}
          {finsFiltrados.map(f => {
            const cuotasPagadas = f.cuotas.filter(c => c.pagado).length
            const progreso = f.cuotas.length > 0 ? (cuotasPagadas / f.cuotas.length) * 100 : 0
            const tieneVencidas = f.cuotas.some(c => esVencidaCuota(c))
            const proximaCuota = f.cuotas.find(c => !c.pagado)
            const montoPagado = f.cuotas.filter(c => c.pagado).reduce((s, c) => s + c.monto, 0)

            return (
              <div key={f.id} className="bg-surface-lowest border border-outline-variant rounded-xl p-3 flex flex-col gap-2 hover:border-primary/30 transition-colors">
                {/* Tipo + estado */}
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">Quincenal</span>
                  {f.estado === 'COMPLETADO'
                    ? <span className="text-[9px] font-bold text-secondary">✓ Completado</span>
                    : tieneVencidas
                      ? <span className="text-[9px] font-bold text-red-400">Vencido</span>
                      : <span className="text-[9px] font-bold text-yellow-500">Activo</span>
                  }
                </div>

                {/* Nombre */}
                <p className="text-[11px] font-semibold text-on-surface leading-tight line-clamp-2">{f.estudiante.nombre}</p>

                {/* Monto + progreso */}
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-sm font-bold text-on-surface tabular">{formatCOP(f.montoTotal)}</span>
                    <span className="text-[10px] text-on-surface-variant">{cuotasPagadas}/{f.cuotas.length}</span>
                  </div>
                  <div className="w-full bg-surface-high rounded-full h-1">
                    <div className={cn('h-1 rounded-full transition-all', tieneVencidas ? 'bg-red-400' : 'bg-secondary')}
                      style={{ width: `${progreso}%` }} />
                  </div>
                </div>

                {/* Próximo vencimiento */}
                {proximaCuota && (
                  <p className="text-[10px] text-on-surface-variant">
                    <span className="font-medium">Próx:</span> {new Date(proximaCuota.fechaVencimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} · {formatCOP(proximaCuota.monto)}
                  </p>
                )}

                <button
                  onClick={() => setSeleccionado({ tipo: 'financiamiento', data: f })}
                  className="mt-auto w-full py-1.5 rounded-lg text-[11px] font-semibold text-primary bg-primary/8 hover:bg-primary/15 border border-primary/20 transition-colors"
                >
                  Ver cuotas
                </button>
              </div>
            )
          })}

          {/* Pagos únicos */}
          {pagosFiltrados.map(p => {
            const isVencido = p.estado === 'VENCIDO'
            const isPagado = p.estado === 'PAGADO'

            return (
              <div key={p.id} className="bg-surface-lowest border border-outline-variant rounded-xl p-3 flex flex-col gap-2 hover:border-primary/30 transition-colors">
                {/* Tipo + estado */}
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-secondary/10 text-secondary">Pago único</span>
                  {isPagado
                    ? <span className="text-[9px] font-bold text-secondary">✓ Pagado</span>
                    : isVencido
                      ? <span className="text-[9px] font-bold text-red-400">Vencido</span>
                      : <span className="text-[9px] font-bold text-yellow-500">Pendiente</span>
                  }
                </div>

                {/* Nombre */}
                <p className="text-[11px] font-semibold text-on-surface leading-tight line-clamp-2">{p.estudiante.nombre}</p>

                {/* Monto */}
                <p className="text-sm font-bold text-on-surface tabular">{formatCOP(p.monto)}</p>

                {/* Fecha */}
                <p className="text-[10px] text-on-surface-variant">
                  {isPagado
                    ? <><span className="font-medium">Pagado:</span> {formatDate(p.fechaPago ?? p.createdAt)}</>
                    : <><span className="font-medium">Vence:</span> {formatDate(p.fechaVencimiento)}</>
                  }
                </p>

                {/* Comprobante */}
                {p.comprobante && (
                  <a href={p.comprobante} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-primary hover:underline">
                    <Paperclip className="w-3 h-3" />Ver comprobante
                  </a>
                )}

                <button
                  onClick={() => setSeleccionado({ tipo: 'pago', data: p })}
                  className="mt-auto w-full py-1.5 rounded-lg text-[11px] font-semibold text-primary bg-primary/8 hover:bg-primary/15 border border-primary/20 transition-colors"
                >
                  Ver detalle
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal detalle */}
      <Modal open={!!seleccionado} onClose={() => setSeleccionado(null)}>
        {seleccionado?.tipo === 'financiamiento' && (
          <DetalleFinanciamiento
            key={seleccionado.data.id}
            f={seleccionado.data}
            onClose={() => setSeleccionado(null)}
            fetcher={fetcher}
          />
        )}
        {seleccionado?.tipo === 'pago' && (
          <DetallePago
            key={seleccionado.data.id}
            p={seleccionado.data}
            onClose={() => setSeleccionado(null)}
            fetcher={fetcher}
          />
        )}
      </Modal>
    </>
  )
}

/* ─── Página principal ───────────────────────────────────────────────────── */
export default function CobrosPage() {
  const { getToken } = useAuth()

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getToken()
    return createClientFetcher(token)<T>(path, opts)
  }

  const { data: dataF, isLoading: loadingF } = useQuery({
    queryKey: ['financiamientos'],
    queryFn: () => fetcher<any>('/financiamientos'),
  })
  const { data: dataP, isLoading: loadingP } = useQuery({
    queryKey: ['pagos'],
    queryFn: () => fetcher<any>('/pagos'),
  })

  const financiamientos: Financiamiento[] = dataF?.data ?? []
  const pagos: Pago[] = dataP?.data ?? []
  const isLoading = loadingF || loadingP

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Cobros" subtitle="Gestiona matrículas y pagos" />
      <MatriculasView financiamientos={financiamientos} pagos={pagos} isLoading={isLoading} fetcher={fetcher} />
    </div>
  )
}
