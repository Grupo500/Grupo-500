'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCOP, formatDate, cn } from '@/lib/utils'
import {
  Wallet, CalendarDays, MessageCircle, ChevronLeft, ChevronRight,
  Clock, CheckCircle, AlertCircle, AlertTriangle, Loader2,
  X, Search, BookOpen, Paperclip, ExternalLink, Users,
} from 'lucide-react'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, isToday, isBefore, parseISO,
} from 'date-fns'
import { es } from 'date-fns/locale'

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

interface CuotaCalendario {
  id: string
  monto: number
  fechaVencimiento: string
  pagado: boolean
  numero: number
  financiamiento: {
    estudiante: {
      nombre: string
      acudiente?: { nombre: string; telefono: string } | null
    }
  }
}

type Tab = 'matriculas' | 'calendario'
type FiltroEstado = 'porCobrar' | 'cobrado' | 'vencidas' | null

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function esVencidaCuota(c: Cuota | CuotaCalendario) {
  return !c.pagado && isBefore(parseISO(c.fechaVencimiento), new Date()) && !isToday(parseISO(c.fechaVencimiento))
}

function generarMensajeWA(cuota: CuotaCalendario) {
  const ac = cuota.financiamiento.estudiante.acudiente
  const nombre = ac?.nombre ?? cuota.financiamiento.estudiante.nombre
  const telefono = ac?.telefono?.replace(/\D/g, '') ?? ''
  const msg = encodeURIComponent(
    `Hola ${nombre}, le recordamos que la cuota de *${cuota.financiamiento.estudiante.nombre}* por *${formatCOP(cuota.monto)}* vence el *${formatDate(cuota.fechaVencimiento)}*. Por favor realizar el pago a tiempo. Gracias — Grupo 500 🎓`
  )
  return telefono ? `https://wa.me/${telefono}?text=${msg}` : null
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
function MatriculasView({ fetcher }: { fetcher: <T>(path: string, opts?: RequestInit) => Promise<T> }) {
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'pendiente' | 'vencido' | 'completado'>('todos')
  const [seleccionado, setSeleccionado] = useState<
    | { tipo: 'financiamiento'; data: Financiamiento }
    | { tipo: 'pago'; data: Pago }
    | null
  >(null)

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

  // Stats unificadas
  const totalPorCobrar =
    pagos.filter(p => p.estado === 'PENDIENTE').reduce((s, p) => s + p.monto, 0) +
    financiamientos.flatMap(f => f.cuotas).filter(c => !c.pagado && !esVencidaCuota(c)).reduce((s, c) => s + c.monto, 0)

  const totalCobrado =
    pagos.filter(p => p.estado === 'PAGADO').reduce((s, p) => s + p.monto, 0) +
    financiamientos.flatMap(f => f.cuotas).filter(c => c.pagado).reduce((s, c) => s + c.monto, 0)

  const totalVencidos =
    pagos.filter(p => p.estado === 'VENCIDO').length +
    financiamientos.flatMap(f => f.cuotas).filter(c => esVencidaCuota(c)).length

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
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: 'Por cobrar', value: formatCOP(totalPorCobrar), color: 'text-on-surface', bg: 'bg-[var(--primary-container)] text-primary', icon: Wallet },
          { label: 'Cobrado', value: formatCOP(totalCobrado), color: 'text-secondary', bg: 'bg-[var(--secondary-container)] text-secondary', icon: CheckCircle },
          { label: 'Vencidos', value: String(totalVencidos), color: 'text-[var(--error)]', bg: 'bg-[var(--error-container)] text-[var(--error)]', icon: AlertCircle },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className="card p-3 flex flex-col items-center text-center gap-2">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', bg)}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="w-full">
              <p className="text-[10px] font-medium text-on-surface-variant leading-none mb-1">{label}</p>
              <p className={cn('text-[13px] font-bold tabular leading-none', color)}>{value}</p>
            </div>
          </div>
        ))}
      </div>

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

/* ─── Vista Calendario ───────────────────────────────────────────────────── */
function CalendarioView({ fetcher }: { fetcher: <T>(path: string, opts?: RequestInit) => Promise<T> }) {
  const queryClient = useQueryClient()
  const [mesActual, setMesActual] = useState(new Date())
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date>(new Date())
  const [filtro, setFiltro] = useState<FiltroEstado>(null)

  const desde = startOfMonth(mesActual).toISOString().split('T')[0]
  const hasta = endOfMonth(mesActual).toISOString().split('T')[0]

  const { data, isLoading } = useQuery({
    queryKey: ['cobros-calendario', desde, hasta],
    queryFn: () => fetcher<any>(`/cobros/calendario?desde=${desde}&hasta=${hasta}`),
  })

  const pagarCuotaMutation = useMutation({
    mutationFn: (id: string) => fetcher(`/cuotas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ pagado: true }),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cobros-calendario'] }),
  })

  const calendarioData: Record<string, CuotaCalendario[]> = data?.data ?? {}
  const todasLasCuotas = Object.values(calendarioData).flat()

  const cuotasDelDia = Object.entries(calendarioData)
    .filter(([fecha]) => isSameDay(parseISO(fecha), diaSeleccionado))
    .flatMap(([, cuotas]) => cuotas)

  const cuotasFiltradas = !filtro ? cuotasDelDia
    : filtro === 'cobrado' ? cuotasDelDia.filter(c => c.pagado)
    : filtro === 'vencidas' ? cuotasDelDia.filter(c => esVencidaCuota(c))
    : cuotasDelDia.filter(c => !c.pagado && !esVencidaCuota(c))

  const diasDelMes = eachDayOfInterval({ start: startOfMonth(mesActual), end: endOfMonth(mesActual) })
  const cuotasEnDia = (dia: Date) =>
    Object.entries(calendarioData)
      .filter(([fecha]) => isSameDay(parseISO(fecha), dia))
      .flatMap(([, cuotas]) => cuotas)

  const totalPorCobrar = todasLasCuotas.filter(c => !c.pagado && !esVencidaCuota(c)).reduce((s, c) => s + c.monto, 0)
  const totalCobrado = todasLasCuotas.filter(c => c.pagado).reduce((s, c) => s + c.monto, 0)
  const totalVencidas = todasLasCuotas.filter(c => esVencidaCuota(c)).length
  const toggleFiltro = (f: FiltroEstado) => setFiltro(prev => prev === f ? null : f)

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { key: 'porCobrar' as FiltroEstado, label: 'Por cobrar', value: formatCOP(totalPorCobrar), activeRing: 'ring-primary/40', activeBg: 'bg-[var(--primary-container)]/50 border-primary/30', iconBg: 'bg-[var(--primary-container)] text-primary', iconBgActive: 'bg-primary text-on-primary', icon: Wallet },
          { key: 'cobrado' as FiltroEstado, label: 'Cobrado', value: formatCOP(totalCobrado), activeRing: 'ring-secondary/40', activeBg: 'bg-[var(--secondary-container)]/50 border-secondary/30', iconBg: 'bg-[var(--secondary-container)] text-secondary', iconBgActive: 'bg-secondary text-white', icon: CheckCircle },
          { key: 'vencidas' as FiltroEstado, label: 'Vencidas', value: String(totalVencidas), activeRing: 'ring-[var(--error)]/40', activeBg: 'bg-[var(--error-container)]/50 border-[var(--error)]/30', iconBg: 'bg-[var(--error-container)] text-[var(--error)]', iconBgActive: 'bg-[var(--error)] text-white', icon: AlertCircle },
        ].map(({ key, label, value, activeRing, activeBg, iconBg, iconBgActive, icon: Icon }) => (
          <button key={key} onClick={() => toggleFiltro(key)}
            className={cn('card p-3 flex flex-col items-center text-center gap-2 cursor-pointer select-none transition-all duration-150 ring-2 ring-transparent',
              filtro === key ? cn(activeRing, activeBg) : 'hover:bg-[var(--surface-high)]'
            )}>
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', filtro === key ? iconBgActive : iconBg)}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="w-full">
              <p className="text-[10px] font-medium text-on-surface-variant leading-none mb-1">{label}</p>
              <p className="text-[13px] font-bold text-on-surface tabular leading-none">{value}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendario */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-semibold text-on-surface capitalize">
              {format(mesActual, 'MMMM yyyy', { locale: es })}
            </h2>
            <div className="flex items-center gap-1">
              <button onClick={() => setMesActual(subMonths(mesActual, 1))} className="btn-ghost p-2"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setMesActual(new Date())} className="btn-ghost text-xs px-3 py-2">Hoy</button>
              <button onClick={() => setMesActual(addMonths(mesActual, 1))} className="btn-ghost p-2"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
          ) : (
            <>
              <div className="grid grid-cols-7 mb-2">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                  <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: (startOfMonth(mesActual).getDay() + 6) % 7 }).map((_, i) => <div key={`e-${i}`} />)}
                {diasDelMes.map(dia => {
                  const cuotas = cuotasEnDia(dia)
                  const pendientes = cuotas.filter(c => !c.pagado)
                  const vencidas = cuotas.filter(c => esVencidaCuota(c))
                  const isSelected = isSameDay(dia, diaSeleccionado)
                  const esHoy = isToday(dia)
                  return (
                    <button key={dia.toISOString()} onClick={() => setDiaSeleccionado(dia)}
                      className={cn('relative flex flex-col items-center py-2 px-1 rounded-lg transition-all duration-150 min-h-[52px]',
                        isSelected ? 'bg-[var(--primary-container)] border border-primary/30 text-primary'
                          : esHoy ? 'border border-secondary/40 text-secondary'
                          : 'hover:bg-[var(--surface-high)] text-on-surface-variant hover:text-on-surface',
                      )}>
                      <span className={cn('text-[13px] font-medium', esHoy && 'font-bold')}>{format(dia, 'd')}</span>
                      {cuotas.length > 0 && (
                        <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                          {pendientes.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />}
                          {vencidas.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[var(--error)]" />}
                          {cuotas.some(c => c.pagado) && <span className="w-1.5 h-1.5 rounded-full bg-secondary" />}
                        </div>
                      )}
                      {cuotas.length > 1 && <span className="absolute top-1 right-1 text-[9px] font-bold text-tertiary">{cuotas.length}</span>}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-5 mt-4 pt-4 border-t border-[var(--outline-variant)]">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-tertiary" /><span className="text-[11px] text-on-surface-variant">Pendiente</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-secondary" /><span className="text-[11px] text-on-surface-variant">Pagado</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--error)]" /><span className="text-[11px] text-on-surface-variant">Vencido</span></div>
              </div>
            </>
          )}
        </div>

        {/* Panel lateral */}
        <div className="card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              <h3 className="text-[14px] font-semibold text-on-surface">
                {format(diaSeleccionado, "d 'de' MMMM", { locale: es })}
              </h3>
            </div>
            {filtro && (
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                filtro === 'porCobrar' ? 'bg-[var(--primary-container)] text-primary'
                  : filtro === 'cobrado' ? 'bg-[var(--secondary-container)] text-secondary'
                  : 'bg-[var(--error-container)] text-[var(--error)]',
              )}>
                {filtro === 'porCobrar' ? 'Por cobrar' : filtro === 'cobrado' ? 'Cobrado' : 'Vencidas'}
              </span>
            )}
          </div>

          {cuotasFiltradas.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <CalendarDays className="w-10 h-10 text-[var(--outline-variant)] mb-3" />
              <p className="text-[13px] text-on-surface-variant">
                {cuotasDelDia.length > 0 && filtro ? 'Sin cuotas con este filtro' : 'Sin cobros para este día'}
              </p>
            </div>
          ) : (
            <div className="flex-1 space-y-2.5 overflow-y-auto">
              {cuotasFiltradas.map(cuota => {
                const vencido = esVencidaCuota(cuota)
                const waLink = generarMensajeWA(cuota)
                return (
                  <div key={cuota.id} className={cn('rounded-xl p-3 border transition-colors',
                    cuota.pagado ? 'bg-[var(--secondary-container)]/30 border-[var(--outline-variant)]'
                      : vencido ? 'bg-[var(--error-container)]/40 border-[var(--error)]/20'
                      : 'bg-[var(--surface-high)] border-[var(--outline-variant)]',
                  )}>
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-on-surface truncate">{cuota.financiamiento.estudiante.nombre}</p>
                        {cuota.financiamiento.estudiante.acudiente && (
                          <p className="text-[11px] text-on-surface-variant">{cuota.financiamiento.estudiante.acudiente.nombre}</p>
                        )}
                        <p className="text-[10px] text-on-surface-variant/60">Cuota #{cuota.numero}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        {cuota.pagado && <span className="chip-success text-[10px]"><CheckCircle className="w-3 h-3" />Pagado</span>}
                        {vencido && <span className="chip-error text-[10px]"><AlertCircle className="w-3 h-3" />Vencido</span>}
                        {!cuota.pagado && !vencido && <Clock className="w-4 h-4 text-tertiary" />}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <span className="text-[14px] font-bold text-on-surface tabular">{formatCOP(cuota.monto)}</span>
                      <div className="flex items-center gap-1.5">
                        {!cuota.pagado && (
                          <button onClick={() => pagarCuotaMutation.mutate(cuota.id)} disabled={pagarCuotaMutation.isPending}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary/20 transition-colors disabled:opacity-40">
                            <CheckCircle className="w-3 h-3" />Pagar
                          </button>
                        )}
                        {!cuota.pagado && waLink && (
                          <a href={waLink} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-colors">
                            <MessageCircle className="w-3 h-3" />WA
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {cuotasFiltradas.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--outline-variant)]">
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-on-surface-variant font-medium">Total pendiente del día</span>
                <span className="text-[14px] font-bold text-on-surface tabular">
                  {formatCOP(cuotasFiltradas.filter(c => !c.pagado).reduce((s, c) => s + c.monto, 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ─── Página principal ───────────────────────────────────────────────────── */
export default function CobrosPage() {
  const { getToken } = useAuth()
  const [tab, setTab] = useState<Tab>('matriculas')

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getToken()
    return createClientFetcher(token)<T>(path, opts)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Cobros" subtitle="Gestiona matrículas, pagos y fechas de cobro" />

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-high rounded-xl p-1 w-fit">
        {([
          { key: 'matriculas', label: 'Matrículas', icon: Wallet },
          { key: 'calendario', label: 'Calendario', icon: CalendarDays },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150',
              tab === key ? 'bg-surface-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            )}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Contenido del tab activo */}
      {tab === 'matriculas'
        ? <MatriculasView fetcher={fetcher} />
        : <CalendarioView fetcher={fetcher} />
      }
    </div>
  )
}
