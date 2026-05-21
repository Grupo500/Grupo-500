'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCOP, formatDate, cn } from '@/lib/utils'
import {
  Wallet, CheckCircle, AlertTriangle, Loader2, X, Search,
  BookOpen, Paperclip, Users, Plus, Calendar,
} from 'lucide-react'
import { isBefore, parseISO, isToday } from 'date-fns'
import { VerComprobante } from '@/components/ui/VerComprobante'

/* ─── Tipos ──────────────────────────────────────────────────────────────── */
interface Cuota {
  id: string
  numero: number
  monto: number
  fechaVencimiento: string
  pagado: boolean
  fechaPago?: string
  comprobante?: string
}

interface Financiamiento {
  id: string
  montoTotal: number
  estado: 'ACTIVO' | 'COMPLETADO' | 'CANCELADO'
  createdAt: string
  estudiante: {
    nombre: string
    email: string
    telefono?: string
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
function esVencida(c: Cuota) {
  return !c.pagado && isBefore(parseISO(c.fechaVencimiento), new Date()) && !isToday(parseISO(c.fechaVencimiento))
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })
}

/* ─── Modal wrapper ──────────────────────────────────────────────────────── */
function Modal({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className={cn('relative bg-surface-lowest border border-outline-variant rounded-xl shadow-float w-full', wide ? 'max-w-lg' : 'max-w-md')}>
          {children}
        </div>
      </div>
    </div>
  )
}

/* ─── Modal Abono ────────────────────────────────────────────────────────── */
function ModalAbono({
  f, onClose, fetcher,
}: {
  f: Financiamiento
  onClose: () => void
  fetcher: <T>(path: string, opts?: RequestInit) => Promise<T>
}) {
  const queryClient = useQueryClient()

  const cuotasPendientes = f.cuotas.filter(c => !c.pagado)

  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [montoAbono, setMontoAbono]       = useState('')
  const [fechaAbono, setFechaAbono]       = useState(new Date().toISOString().split('T')[0])
  const [comprobante, setComprobante]     = useState('')
  const [subiendo, setSubiendo]           = useState(false)
  const [error, setError]                 = useState('')

  // Monto total de las cuotas seleccionadas
  const montoSeleccionado = cuotasPendientes
    .filter(c => seleccionadas.has(c.id))
    .reduce((s, c) => s + c.monto, 0)

  const toggleCuota = (id: string) => {
    setSeleccionadas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      // Autocompletar el monto con la suma de seleccionadas
      const suma = cuotasPendientes
        .filter(c => next.has(c.id))
        .reduce((s, c) => s + c.monto, 0)
      setMontoAbono(suma > 0 ? String(suma) : '')
      return next
    })
  }

  const subirComprobante = async (file: File) => {
    setSubiendo(true)
    try {
      const token = await getClientToken()
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/imagen`, {
        method: 'POST', headers: { Authorization: `Bearer ${token ?? ''}` }, body: fd,
      })
      const json = await res.json()
      if (!res.ok || !json?.data?.url) throw new Error(json?.error ?? 'Error al subir')
      setComprobante(json.data.url)
    } catch (e: any) {
      setError(e.message ?? 'Error al subir comprobante')
    } finally {
      setSubiendo(false)
    }
  }

  const abonoMutation = useMutation({
    mutationFn: async () => {
      if (seleccionadas.size === 0) throw new Error('Selecciona al menos una cuota')
      if (!montoAbono || Number(montoAbono) <= 0) throw new Error('Ingresa el monto del abono')
      if (!fechaAbono) throw new Error('Ingresa la fecha del abono')

      // Marcar cada cuota seleccionada como pagada
      await Promise.all(
        Array.from(seleccionadas).map(cuotaId =>
          fetcher(`/cuotas/${cuotaId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              pagado: true,
              fechaPago: fechaAbono,
              ...(comprobante && { comprobante }),
            }),
          })
        )
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financiamientos'] })
      queryClient.invalidateQueries({ queryKey: ['saldos-pendientes'] })
      onClose()
    },
    onError: (e: any) => setError(e.message ?? 'Error al registrar abono'),
  })

  const inputCls = 'w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20'

  return (
    <div className="flex flex-col max-h-[90vh]">
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4 flex-shrink-0">
        <div>
          <h2 className="text-base font-bold text-on-surface">Registrar abono</h2>
          <p className="text-[12px] text-on-surface-variant mt-0.5">{f.estudiante.nombre}</p>
        </div>
        <button onClick={onClose} className="p-1.5 text-on-surface-variant hover:text-on-surface"><X className="w-4 h-4" /></button>
      </div>

      <div className="overflow-y-auto flex-1 px-5 pb-2 space-y-4">

        {/* Resumen financiamiento */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Total',     value: formatCOP(f.montoTotal),                                              color: 'text-on-surface' },
            { label: 'Pagado',    value: formatCOP(f.cuotas.filter(c => c.pagado).reduce((s,c) => s+c.monto, 0)), color: 'text-[#16a34a]' },
            { label: 'Pendiente', value: formatCOP(cuotasPendientes.reduce((s,c) => s+c.monto, 0)),            color: 'text-[#d97706]' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-surface-high rounded-xl p-2.5 text-center">
              <p className={cn('text-[13px] font-bold tabular-nums', color)}>{value}</p>
              <p className="text-[10px] text-on-surface-variant mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Selección de cuotas */}
        <div>
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-2">
            Cuotas a saldar <span className="text-primary">({seleccionadas.size} seleccionadas)</span>
          </p>

          {cuotasPendientes.length === 0 ? (
            <p className="text-[13px] text-on-surface-variant text-center py-4">
              Todas las cuotas están pagadas ✓
            </p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
              {cuotasPendientes.map(c => {
                const vencida   = esVencida(c)
                const checked   = seleccionadas.has(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCuota(c.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all duration-150',
                      checked
                        ? 'border-primary bg-primary/8'
                        : vencida
                          ? 'border-[#dc2626]/30 bg-[#dc2626]/4 hover:border-[#dc2626]/50'
                          : 'border-outline-variant/60 bg-surface-high hover:border-outline-variant',
                    )}
                  >
                    {/* Checkbox */}
                    <div className={cn(
                      'w-4.5 h-4.5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors',
                      checked ? 'bg-primary border-primary' : 'border-outline-variant bg-surface-lowest',
                    )} style={{ width: 18, height: 18 }}>
                      {checked && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>

                    {/* Número cuota */}
                    <span className={cn('text-[11px] font-bold flex-shrink-0 w-6 text-center',
                      checked ? 'text-primary' : vencida ? 'text-[#dc2626]' : 'text-on-surface-variant'
                    )}>#{c.numero}</span>

                    {/* Monto */}
                    <span className="text-[13px] font-bold text-on-surface tabular-nums flex-1">{formatCOP(c.monto)}</span>

                    {/* Fecha + estado */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-[11px] text-on-surface-variant">{fmtFecha(c.fechaVencimiento)}</p>
                      {vencida && (
                        <p className="text-[9px] font-bold text-[#dc2626] flex items-center justify-end gap-0.5 mt-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" />VENCIDA
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Total seleccionado */}
          {seleccionadas.size > 0 && (
            <div className="mt-2 flex items-center justify-between px-1 py-1.5 border-t border-outline-variant/40">
              <span className="text-[11px] text-on-surface-variant">Suma de cuotas seleccionadas</span>
              <span className="text-[13px] font-bold text-primary tabular-nums">{formatCOP(montoSeleccionado)}</span>
            </div>
          )}
        </div>

        {/* Datos del abono */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">Datos del abono</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Monto recibido *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className={cn(inputCls, 'pl-6')}
                  value={montoAbono ? Number(montoAbono).toLocaleString('es-CO') : ''}
                  placeholder="0"
                  onChange={e => {
                    const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '')
                    setMontoAbono(raw)
                  }}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Fecha del abono *</label>
              <input type="date" className={inputCls} value={fechaAbono}
                onChange={e => setFechaAbono(e.target.value)} />
            </div>
          </div>

          {/* Comprobante */}
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Comprobante (opcional)</label>
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-surface-high border border-outline-variant rounded-lg hover:bg-surface-highest transition-colors">
              <input type="file" accept="image/*,.pdf" className="hidden" disabled={subiendo}
                onChange={e => { const file = e.target.files?.[0]; if (file) subirComprobante(file); e.target.value = '' }} />
              {subiendo ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <Paperclip className="w-4 h-4 text-on-surface-variant" />}
              <span className="text-sm text-on-surface-variant">
                {subiendo ? 'Subiendo...' : comprobante ? 'Cambiar comprobante' : 'Adjuntar comprobante'}
              </span>
            </label>
            <VerComprobante url={comprobante} label="Ver comprobante subido" className="mt-1" />
          </div>
        </div>

        {error && (
          <p className="text-xs text-[var(--error)] bg-[var(--error-container)]/40 border border-[var(--error)]/20 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center gap-3 px-5 py-4 border-t border-outline-variant/40 flex-shrink-0">
        <button onClick={onClose} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface">Cancelar</button>
        <button
          onClick={() => abonoMutation.mutate()}
          disabled={abonoMutation.isPending || seleccionadas.size === 0 || !montoAbono || !fechaAbono}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {abonoMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Registrar abono
        </button>
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
  const [vistaAbono, setVistaAbono] = useState(false)
  const cuotasPagadas   = f.cuotas.filter(c => c.pagado).length
  const progreso        = f.cuotas.length > 0 ? (cuotasPagadas / f.cuotas.length) * 100 : 0
  const montoPagado     = f.cuotas.filter(c => c.pagado).reduce((s, c) => s + c.monto, 0)
  const montoPendiente  = f.montoTotal - montoPagado
  const curso           = f.estudiante.cursos?.[0]?.curso.nombre

  if (vistaAbono) {
    return <ModalAbono f={f} onClose={() => setVistaAbono(false)} fetcher={fetcher} />
  }

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[11px] text-on-surface-variant font-medium mb-0.5">Financiamiento</p>
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

      {/* Montos */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Total',     value: formatCOP(f.montoTotal),    color: 'text-on-surface' },
          { label: 'Pagado',    value: formatCOP(montoPagado),     color: 'text-[#16a34a]' },
          { label: 'Pendiente', value: formatCOP(montoPendiente),  color: montoPendiente > 0 ? 'text-[#d97706]' : 'text-[#16a34a]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface-high rounded-xl p-2.5 text-center">
            <p className={cn('text-[13px] font-bold tabular-nums', color)}>{value}</p>
            <p className="text-[10px] text-on-surface-variant mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Progreso */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] text-on-surface-variant mb-1">
          <span>Progreso</span>
          <span>{cuotasPagadas}/{f.cuotas.length} cuotas</span>
        </div>
        <div className="w-full bg-surface-high rounded-full h-1.5">
          <div className="bg-[#16a34a] h-1.5 rounded-full transition-all" style={{ width: `${progreso}%` }} />
        </div>
      </div>

      {/* Cuotas (solo lectura) */}
      <div className="space-y-1.5 max-h-52 overflow-y-auto mb-4">
        <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-1">Cuotas</p>
        {f.cuotas.map(c => {
          const vencida = esVencida(c)
          return (
            <div key={c.id} className={cn(
              'flex items-center justify-between rounded-lg px-3 py-2 border',
              c.pagado ? 'bg-[#16a34a]/8 border-[#16a34a]/20'
                : vencida ? 'bg-[#dc2626]/8 border-[#dc2626]/20'
                : 'bg-surface-high border-outline-variant/40'
            )}>
              <div className="flex items-center gap-2.5">
                <span className={cn('text-[11px] font-bold w-5 text-center',
                  c.pagado ? 'text-[#16a34a]' : vencida ? 'text-[#dc2626]' : 'text-on-surface-variant'
                )}>#{c.numero}</span>
                <div>
                  <p className="text-[12px] font-bold text-on-surface tabular-nums">{formatCOP(c.monto)}</p>
                  <p className="text-[10px] text-on-surface-variant">{fmtFecha(c.fechaVencimiento)}</p>
                </div>
              </div>
              <div className="text-right">
                {c.pagado ? (
                  <div>
                    <span className="flex items-center gap-0.5 text-[10px] text-[#16a34a] font-semibold">
                      <CheckCircle className="w-3 h-3" />Pagado
                    </span>
                    {c.fechaPago && <p className="text-[9px] text-on-surface-variant">{fmtFecha(c.fechaPago)}</p>}
                    <VerComprobante url={c.comprobante} variante="chip" className="text-[9px] justify-end mt-0.5" />
                  </div>
                ) : vencida ? (
                  <span className="flex items-center gap-0.5 text-[10px] text-[#dc2626] font-semibold">
                    <AlertTriangle className="w-3 h-3" />Vencida
                  </span>
                ) : (
                  <span className="text-[10px] text-[#d97706] font-semibold">Pendiente</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Botón abono */}
      {f.estado !== 'COMPLETADO' && f.cuotas.some(c => !c.pagado) && (
        <button
          onClick={() => setVistaAbono(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />Registrar abono
        </button>
      )}
    </div>
  )
}

/* ─── Detalle Pago único ─────────────────────────────────────────────────── */
function DetallePago({
  p, onClose, fetcher,
}: {
  p: Pago
  onClose: () => void
  fetcher: <T>(path: string, opts?: RequestInit) => Promise<T>
}) {
  const queryClient = useQueryClient()

  const [fechaPago, setFechaPago]     = useState(new Date().toISOString().split('T')[0])
  const [comprobante, setComprobante] = useState(p.comprobante ?? '')
  const [subiendo, setSubiendo]       = useState(false)
  const [error, setError]             = useState('')

  const subirComprobante = async (file: File) => {
    setSubiendo(true)
    try {
      const token = await getClientToken()
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/imagen`, {
        method: 'POST', headers: { Authorization: `Bearer ${token ?? ''}` }, body: fd,
      })
      const json = await res.json()
      if (!res.ok || !json?.data?.url) throw new Error(json?.error ?? 'Error al subir')
      setComprobante(json.data.url)
    } catch (e: any) {
      setError(e.message ?? 'Error al subir')
    } finally {
      setSubiendo(false)
    }
  }

  const pagarMutation = useMutation({
    mutationFn: () => fetcher(`/pagos/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        estado: 'PAGADO',
        fechaPago,
        ...(comprobante && { comprobante }),
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos'] })
      queryClient.invalidateQueries({ queryKey: ['saldos-pendientes'] })
      onClose()
    },
    onError: (e: any) => setError(e.message ?? 'Error al registrar pago'),
  })

  const isPendiente = p.estado === 'PENDIENTE'
  const isVencido   = p.estado === 'VENCIDO'
  const inputCls    = 'w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20'

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
        <p className="text-2xl font-bold text-on-surface tabular-nums">{formatCOP(p.monto)}</p>
        <p className="text-[11px] text-on-surface-variant mt-1">Vence: {formatDate(p.fechaVencimiento)}</p>
        {p.fechaPago && <p className="text-[11px] text-[#16a34a] mt-0.5">Pagado: {formatDate(p.fechaPago)}</p>}
      </div>

      {/* Info */}
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-on-surface-variant">Estado</span>
          <span className={cn('font-semibold',
            p.estado === 'PAGADO' ? 'text-[#16a34a]' : p.estado === 'VENCIDO' ? 'text-[#dc2626]' : 'text-[#d97706]'
          )}>
            {p.estado === 'PAGADO' ? 'Pagado' : p.estado === 'VENCIDO' ? 'Vencido' : 'Pendiente'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-on-surface-variant">Método</span>
          <span className="text-on-surface font-medium">{p.metodo}</span>
        </div>
        {p.asesor && (
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Asesor</span>
            <span className="text-on-surface font-medium">{p.asesor.nombre}</span>
          </div>
        )}
      </div>

      {/* Comprobante existente */}
      <VerComprobante url={p.comprobante} variante="fila" className="mb-4" />

      {/* Formulario cobro */}
      {(isPendiente || isVencido) && (
        <div className="space-y-3 pt-3 border-t border-outline-variant/40">
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">Registrar cobro</p>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Fecha del pago *</label>
            <input type="date" className={cn(inputCls, 'max-w-[180px]')}
              value={fechaPago} onChange={e => setFechaPago(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Comprobante (opcional)</label>
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-surface-high border border-outline-variant rounded-lg hover:bg-surface-highest transition-colors">
              <input type="file" accept="image/*,.pdf" className="hidden" disabled={subiendo}
                onChange={e => { const f = e.target.files?.[0]; if (f) subirComprobante(f); e.target.value = '' }} />
              {subiendo ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <Paperclip className="w-4 h-4 text-on-surface-variant" />}
              <span className="text-sm text-on-surface-variant">
                {subiendo ? 'Subiendo...' : comprobante ? 'Cambiar comprobante' : 'Adjuntar comprobante'}
              </span>
            </label>
            <VerComprobante url={comprobante} className="mt-1" />
          </div>
          {error && <p className="text-xs text-[var(--error)]">{error}</p>}
          <button
            onClick={() => pagarMutation.mutate()}
            disabled={pagarMutation.isPending || !fechaPago}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {pagarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Marcar como pagado
          </button>
        </div>
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

  const q = busqueda.toLowerCase()
  const finsFiltrados = financiamientos.filter(f => {
    if (q && !f.estudiante.nombre.toLowerCase().includes(q)) return false
    if (filtro === 'completado') return f.estado === 'COMPLETADO'
    if (filtro === 'pendiente')  return f.estado === 'ACTIVO' && f.cuotas.some(c => !c.pagado && !esVencida(c))
    if (filtro === 'vencido')    return f.cuotas.some(c => esVencida(c))
    return true
  })
  const pagosFiltrados = pagos.filter(p => {
    if (q && !p.estudiante.nombre.toLowerCase().includes(q)) return false
    if (filtro === 'completado') return p.estado === 'PAGADO'
    if (filtro === 'pendiente')  return p.estado === 'PENDIENTE'
    if (filtro === 'vencido')    return p.estado === 'VENCIDO'
    return true
  })

  return (
    <>
      {/* Búsqueda + filtros */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input type="text" placeholder="Buscar estudiante..." value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full bg-surface-high border border-outline-variant rounded-lg pl-9 pr-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50" />
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
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : finsFiltrados.length + pagosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant bg-surface-lowest border border-outline-variant rounded-xl">
          <Users className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No hay cobros que mostrar</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">

          {/* Financiamientos */}
          {finsFiltrados.map(f => {
            const pagadas = f.cuotas.filter(c => c.pagado).length
            const progreso = f.cuotas.length > 0 ? (pagadas / f.cuotas.length) * 100 : 0
            const tieneVencidas = f.cuotas.some(c => esVencida(c))
            const proxima = f.cuotas.find(c => !c.pagado)
            const montoPagado = f.cuotas.filter(c => c.pagado).reduce((s, c) => s + c.monto, 0)
            const pendiente = f.montoTotal - montoPagado

            return (
              <div key={f.id} className="bg-surface-lowest border border-outline-variant rounded-xl p-3 flex flex-col gap-2 hover:border-primary/30 transition-colors">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">Cuotas</span>
                  {f.estado === 'COMPLETADO'
                    ? <span className="text-[9px] font-bold text-[#16a34a]">✓ Completado</span>
                    : tieneVencidas
                      ? <span className="text-[9px] font-bold text-[#dc2626]">⚠ Vencido</span>
                      : <span className="text-[9px] font-bold text-[#d97706]">Activo</span>}
                </div>

                <p className="text-[11px] font-semibold text-on-surface leading-tight line-clamp-2">{f.estudiante.nombre}</p>

                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-sm font-bold text-on-surface tabular-nums">{formatCOP(f.montoTotal)}</span>
                    <span className="text-[10px] text-on-surface-variant">{pagadas}/{f.cuotas.length}</span>
                  </div>
                  <div className="w-full bg-surface-high rounded-full h-1">
                    <div className={cn('h-1 rounded-full transition-all', tieneVencidas ? 'bg-[#dc2626]' : 'bg-[#16a34a]')}
                      style={{ width: `${progreso}%` }} />
                  </div>
                </div>

                {/* Pendiente + próxima */}
                <div className="space-y-0.5">
                  {pendiente > 0 && (
                    <p className="text-[10px] text-[#d97706] font-semibold">Pendiente: {formatCOP(pendiente)}</p>
                  )}
                  {proxima && (
                    <p className="text-[10px] text-on-surface-variant">
                      Próx: {fmtFecha(proxima.fechaVencimiento)} · {formatCOP(proxima.monto)}
                    </p>
                  )}
                </div>

                <button onClick={() => setSeleccionado({ tipo: 'financiamiento', data: f })}
                  className="mt-auto w-full py-1.5 rounded-lg text-[11px] font-semibold text-primary bg-primary/8 hover:bg-primary/15 border border-primary/20 transition-colors flex items-center justify-center gap-1">
                  <Wallet className="w-3 h-3" />Ver / Abonar
                </button>
              </div>
            )
          })}

          {/* Pagos únicos */}
          {pagosFiltrados.map(p => {
            const isPagado  = p.estado === 'PAGADO'
            const isVencido = p.estado === 'VENCIDO'
            return (
              <div key={p.id} className="bg-surface-lowest border border-outline-variant rounded-xl p-3 flex flex-col gap-2 hover:border-primary/30 transition-colors">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-secondary/10 text-secondary">Único</span>
                  {isPagado
                    ? <span className="text-[9px] font-bold text-[#16a34a]">✓ Pagado</span>
                    : isVencido
                      ? <span className="text-[9px] font-bold text-[#dc2626]">⚠ Vencido</span>
                      : <span className="text-[9px] font-bold text-[#d97706]">Pendiente</span>}
                </div>

                <p className="text-[11px] font-semibold text-on-surface leading-tight line-clamp-2">{p.estudiante.nombre}</p>
                <p className="text-sm font-bold text-on-surface tabular-nums">{formatCOP(p.monto)}</p>

                <p className="text-[10px] text-on-surface-variant">
                  {isPagado
                    ? <><span className="font-medium">Pagado:</span> {formatDate(p.fechaPago ?? p.createdAt)}</>
                    : <><span className="font-medium">Vence:</span> {formatDate(p.fechaVencimiento)}</>}
                </p>

                {p.comprobante && (
                  <VerComprobante url={p.comprobante} variante="chip" className="text-[10px]" />
                )}

                <button onClick={() => setSeleccionado({ tipo: 'pago', data: p })}
                  className="mt-auto w-full py-1.5 rounded-lg text-[11px] font-semibold text-primary bg-primary/8 hover:bg-primary/15 border border-primary/20 transition-colors">
                  Ver / Cobrar
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Modales */}
      <Modal open={seleccionado?.tipo === 'financiamiento'} onClose={() => setSeleccionado(null)} wide>
        {seleccionado?.tipo === 'financiamiento' && (
          <DetalleFinanciamiento key={seleccionado.data.id} f={seleccionado.data}
            onClose={() => setSeleccionado(null)} fetcher={fetcher} />
        )}
      </Modal>
      <Modal open={seleccionado?.tipo === 'pago'} onClose={() => setSeleccionado(null)}>
        {seleccionado?.tipo === 'pago' && (
          <DetallePago key={seleccionado.data.id} p={seleccionado.data}
            onClose={() => setSeleccionado(null)} fetcher={fetcher} />
        )}
      </Modal>
    </>
  )
}

/* ─── Página ─────────────────────────────────────────────────────────────── */
export default function CobrosPage() {

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getClientToken()
    return createClientFetcher(token ?? '')<T>(path, opts)
  }

  const { data: dataF, isLoading: loadingF } = useQuery({
    queryKey: ['financiamientos'],
    queryFn: () => fetcher<any>('/financiamientos'),
  })
  const { data: dataP, isLoading: loadingP } = useQuery({
    queryKey: ['pagos'],
    queryFn: () => fetcher<any>('/pagos'),
  })

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Cobros" subtitle="Gestiona matrículas y pagos" />
      <MatriculasView
        financiamientos={dataF?.data ?? []}
        pagos={dataP?.data ?? []}
        isLoading={loadingF || loadingP}
        fetcher={fetcher}
      />
    </div>
  )
}

