'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { formatCOP, cn } from '@/lib/utils'
import {
  ArrowLeft, Pencil, Trash2, Loader2, User, BookOpen,
  Phone, Mail, Users, CreditCard, History,
  Wallet, CheckCircle, AlertTriangle, Paperclip,
  Save, ChevronDown, ChevronUp,
  MessageSquarePlus, Trash2 as Trash,
} from 'lucide-react'
import { VerComprobante } from '@/components/ui/VerComprobante'
import { isBefore, parseISO, isToday } from 'date-fns'
import { DEPARTAMENTOS, getMunicipios } from '@/lib/colombia'

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Cuota {
  id: string; numero: number; monto: number
  fechaVencimiento: string; pagado: boolean
  fechaPago?: string; comprobante?: string
  medioPago?: string; notas?: string
}
interface Financiamiento {
  id: string; montoTotal: number
  estado: 'ACTIVO' | 'COMPLETADO' | 'CANCELADO'
  createdAt: string; cuotas: Cuota[]
}
interface Pago {
  id: string; monto: number
  estado: 'PENDIENTE' | 'PAGADO' | 'VENCIDO' | 'CANCELADO'
  metodo: string; fechaVencimiento: string
  fechaPago?: string; comprobante?: string
  createdAt: string; notas?: string
  asesor?: { nombre: string }
}
interface HistorialItem {
  id: string; accion: string; descripcion: string
  cambios?: any; realizadoPor: string; createdAt: string
}
interface EstudianteDetalle {
  id: string; nombre: string
  tipoDocumento?: string; documento?: string; documentoUrl?: string | null
  email: string; telefono: string; fechaNacimiento: string
  departamento?: string; ciudad?: string
  colegio?: { id: string; nombre: string }
  acudiente?: { nombre: string; email: string; telefono: string; relacion: string }
  asesor?: { id: string; nombre: string }
  lineaAutorizada?: number | null
  agregado?: boolean
  nombreGrupo?: string | null
  verificado?: boolean
  verificadoPor?: string | null
  verificadoAt?: string | null
  cursos?: { id: string; cursoId: string; descuentoPorcentaje: number; precioAcordado?: number | null; curso: { id: string; nombre: string; precio: number } }[]
  pagos?: Pago[]
  financiamientos?: Financiamiento[]
  createdAt: string
}

// ── Helpers ────────────────────────────────────────────────────────────────
function esUrlValida(s: string | null | undefined): boolean {
  return !!s && /^https?:\/\//i.test(s.trim())
}
function esVencida(fechaVenc: string) {
  return isBefore(parseISO(fechaVenc), new Date()) && !isToday(parseISO(fechaVenc))
}
function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })
}
function fmtFechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function fmtNum(raw: string | number): string {
  const n = typeof raw === 'string' ? raw.replace(/\./g, '') : String(raw)
  const num = Number(n)
  if (isNaN(num) || n === '') return ''
  return num.toLocaleString('es-CO')
}
function NumericInput({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string
}) {
  return (
    <input type="text" inputMode="numeric" value={fmtNum(value)} placeholder={placeholder}
      className={className}
      onChange={e => onChange(e.target.value.replace(/\./g, '').replace(/[^0-9]/g, ''))} />
  )
}

type Tab = 'perfil' | 'financiero' | 'historial' | 'observaciones'
const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'perfil',         label: 'Perfil',         icon: User               },
  { key: 'financiero',     label: 'Financiero',     icon: Wallet             },
  { key: 'observaciones',  label: 'Observaciones',  icon: MessageSquarePlus  },
  { key: 'historial',      label: 'Historial',      icon: History            },
]

const inputCls = 'w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20'
const labelCls = 'block text-xs font-medium text-on-surface-variant mb-1'

const MEDIOS_PAGO = ['Bancolombia', 'Bre-B', 'Nequi', 'Otro']

// ══════════════════════════════════════════════════════════════════════════
// COMPONENTE: FILA DE CUOTA (vista + edición inline)
// ══════════════════════════════════════════════════════════════════════════
function FilaCuota({ c, fetcher, onRefresh }: {
  c: Cuota
  fetcher: <T>(path: string, opts?: RequestInit) => Promise<T>
  onRefresh: () => void
}) {
  const [editando, setEditando] = useState(false)
  const [monto, setMonto] = useState(String(Math.round(c.monto)))
  const [fechaVenc, setFechaVenc] = useState(c.fechaVencimiento?.split('T')[0] ?? '')
  const [fechaPago, setFechaPago] = useState(c.fechaPago?.split('T')[0] ?? '')
  const [medioPago, setMedioPago] = useState(
    MEDIOS_PAGO.includes(c.medioPago ?? '') ? (c.medioPago ?? 'Bancolombia') : 'Otro'
  )
  const [otroMedio, setOtroMedio] = useState(
    MEDIOS_PAGO.includes(c.medioPago ?? '') ? '' : (c.medioPago ?? '')
  )
  const [comprobante, setComprobante] = useState(c.comprobante ?? '')
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')

  const vencida = !c.pagado && esVencida(c.fechaVencimiento)

  const subirComp = async (file: File) => {
    setSubiendo(true)
    try {
      const token = await getClientToken()
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/imagen`, {
        method: 'POST', headers: { Authorization: `Bearer ${token ?? ''}` }, body: fd,
      })
      const json = await res.json()
      if (!res.ok || !json?.data?.url) throw new Error(json?.error ?? 'Error')
      setComprobante(json.data.url)
    } catch (e: any) { setError(e.message ?? 'Error al subir') }
    finally { setSubiendo(false) }
  }

  const medioFinal = medioPago === 'Otro' ? (otroMedio.trim() || 'Otro') : medioPago

  const editarMutation = useMutation({
    mutationFn: () => fetcher(`/cuotas/${c.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        monto: Number(monto),
        fechaVencimiento: fechaVenc,
        ...(c.pagado && { fechaPago, medioPago: medioFinal }),
        ...(comprobante && { comprobante }),
      }),
    }),
    onSuccess: () => { setEditando(false); setError(''); onRefresh() },
    onError: (e: any) => setError(e.message ?? 'Error al guardar'),
  })

  if (editando) return (
    <div className="px-3 py-3 rounded-xl border-2 border-primary/40 bg-primary/5 space-y-3">
      <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">Editando cuota #{c.numero}</p>
      {/* Cuota pendiente: monto + vencimiento */}
      {!c.pagado && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Monto</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant">$</span>
              <NumericInput value={monto} onChange={setMonto} placeholder="0" className={cn(inputCls, 'pl-6 text-sm py-1.5')} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Vencimiento</label>
            <input type="date" className={cn(inputCls, 'text-sm py-1.5 w-full')} value={fechaVenc} onChange={e => setFechaVenc(e.target.value)} />
          </div>
        </div>
      )}

      {/* Cuota pagada: fecha pago primero */}
      {c.pagado && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Fecha de pago</label>
              <input type="date" className={cn(inputCls, 'text-sm py-1.5 w-full')} value={fechaPago} onChange={e => setFechaPago(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Monto</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant">$</span>
                <NumericInput value={monto} onChange={setMonto} placeholder="0" className={cn(inputCls, 'pl-6 text-sm py-1.5')} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Vencimiento</label>
              <input type="date" className={cn(inputCls, 'text-sm py-1.5 w-full')} value={fechaVenc} onChange={e => setFechaVenc(e.target.value)} />
            </div>
            <div /></div>
          <div>
            <label className={labelCls}>Medio de pago</label>
            <div className="flex gap-1.5">
              {MEDIOS_PAGO.map(m => (
                <button key={m} type="button" onClick={() => setMedioPago(m)}
                  className={cn('flex-1 py-1.5 rounded-lg border-2 text-[11px] font-semibold transition-all cursor-pointer',
                    medioPago === m ? 'border-primary bg-primary/8 text-primary' : 'border-outline-variant text-on-surface-variant hover:border-outline')}>
                  {m}
                </button>
              ))}
            </div>
            {medioPago === 'Otro' && (
              <input className={cn(inputCls, 'mt-1.5 text-sm')} placeholder="Especifica el medio..." value={otroMedio}
                onChange={e => setOtroMedio(e.target.value)} />
            )}
          </div>
          <div>
            <label className={labelCls}>Comprobante</label>
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-surface-high border border-outline-variant rounded-lg hover:bg-surface-high/80 transition-colors">
              <input type="file" accept="image/*,.pdf" className="hidden" disabled={subiendo}
                onChange={e => { const f = e.target.files?.[0]; if (f) subirComp(f); e.target.value = '' }} />
              {subiendo ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" /> : <Paperclip className="w-3.5 h-3.5 text-on-surface-variant" />}
              <span className="text-xs text-on-surface-variant">{subiendo ? 'Subiendo...' : esUrlValida(comprobante) ? '✓ Comprobante adjunto' : 'Adjuntar comprobante'}</span>
            </label>
            <VerComprobante url={comprobante} label="Ver comprobante actual" className="mt-1" />
          </div>
        </>
      )}

      {error && <p className="text-xs text-[var(--error)]">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={() => setEditando(false)} className="px-3 py-1 text-xs text-on-surface-variant hover:text-on-surface cursor-pointer">Cancelar</button>
        <button onClick={() => editarMutation.mutate()} disabled={editarMutation.isPending}
          className="flex items-center gap-1 px-3 py-1 bg-primary text-on-primary rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50">
          {editarMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Guardar
        </button>
      </div>
    </div>
  )

  return (
    <div className={cn(
      'flex items-center gap-3 px-3 py-2.5 rounded-xl border group',
      c.pagado ? 'border-[#16a34a]/20 bg-[#16a34a]/4' :
      vencida  ? 'border-[#dc2626]/25 bg-[#dc2626]/4' :
                 'border-outline-variant/50 bg-surface-high/40',
    )}>
      <div className={cn('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
        c.pagado ? 'bg-[#16a34a]/15' : vencida ? 'bg-[#dc2626]/15' : 'bg-surface-high')}>
        {c.pagado ? <CheckCircle className="w-3.5 h-3.5 text-[#16a34a]" />
                  : vencida ? <AlertTriangle className="w-3.5 h-3.5 text-[#dc2626]" />
                  : <span className="text-[10px] font-bold text-on-surface-variant">#{c.numero}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-on-surface">Cuota #{c.numero} · {formatCOP(c.monto)}</p>
        <p className="text-[10px] text-on-surface-variant">
          {c.pagado
            ? `Pagado ${c.fechaPago ? fmtFecha(c.fechaPago) : ''}${c.medioPago ? ` · ${c.medioPago}` : ''}`
            : `Vence ${fmtFecha(c.fechaVencimiento)}`}
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <VerComprobante url={c.comprobante} variante="chip" />
        <button onClick={() => setEditando(true)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-surface-high transition-all cursor-pointer">
          <Pencil className="w-3 h-3 text-on-surface-variant" />
        </button>
        {/* Revertir pago — solo cuotas pagadas */}
        {c.pagado && (
          <button
            onClick={async () => {
              if (!confirm('¿Revertir este abono? La cuota volverá a pendiente.')) return
              const token = await getClientToken()
              await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cuotas/${c.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
                body: JSON.stringify({ pagado: false }),
              })
              onRefresh()
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-[#dc2626]/10 transition-all cursor-pointer">
            <Trash2 className="w-3 h-3 text-[#dc2626]" />
          </button>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// COMPONENTE: FORM ABONO
// ══════════════════════════════════════════════════════════════════════════
function FormAbono({ cuotasPendientes, fetcher, onSuccess }: {
  cuotasPendientes: Cuota[]
  fetcher: <T>(path: string, opts?: RequestInit) => Promise<T>
  onSuccess: () => void
}) {
  type CuotaAbono = { cuotaId: string; numero: number; montoOrig: number; monto: string; fecha: string }
  const [seleccionadas, setSeleccionadas] = useState<CuotaAbono[]>([])
  const [medioPago, setMedioPago] = useState('Bancolombia')
  const [otroMedio, setOtroMedio] = useState('')
  const [comprobante, setComprobante] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const hoy = new Date().toISOString().split('T')[0]

  const toggleCuota = (c: Cuota) => {
    setSeleccionadas(prev => {
      const existe = prev.find(s => s.cuotaId === c.id)
      if (existe) return prev.filter(s => s.cuotaId !== c.id)
      return [...prev, { cuotaId: c.id, numero: c.numero, montoOrig: c.monto, monto: String(Math.round(c.monto)), fecha: hoy }]
    })
  }

  const actualizarCuotaAbono = (cuotaId: string, field: 'monto' | 'fecha', value: string) => {
    setSeleccionadas(prev => prev.map(s => s.cuotaId === cuotaId ? { ...s, [field]: value } : s))
  }

  const subirComprobante = async (file: File) => {
    setSubiendo(true)
    try {
      const token = await getClientToken()
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/imagen`, {
        method: 'POST', headers: { Authorization: `Bearer ${token ?? ''}` }, body: fd,
      })
      const json = await res.json()
      if (!res.ok || !json?.data?.url) throw new Error(json?.error ?? 'Error al subir')
      setComprobante(json.data.url)
    } catch (e: any) { setError(e.message ?? 'Error al subir')
    } finally { setSubiendo(false) }
  }

  const medioFinal = medioPago === 'Otro' ? (otroMedio.trim() || 'Otro') : medioPago

  const abonoMutation = useMutation({
    mutationFn: async () => {
      if (seleccionadas.length === 0) throw new Error('Selecciona al menos una cuota')
      if (seleccionadas.some(s => !s.monto || Number(s.monto) <= 0)) throw new Error('Ingresa el monto de cada cuota seleccionada')
      if (seleccionadas.some(s => !s.fecha)) throw new Error('Ingresa la fecha de pago de cada cuota')
      await Promise.all(
        seleccionadas.map(s =>
          fetcher(`/cuotas/${s.cuotaId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              pagado: true,
              fechaPago: s.fecha,
              monto: Number(s.monto),
              medioPago: medioFinal,
              ...(comprobante && { comprobante }),
            }),
          })
        )
      )
    },
    onSuccess: () => {
      setSeleccionadas([]); setComprobante(''); setError(''); setOtroMedio('')
      onSuccess()
    },
    onError: (e: any) => setError(e.message ?? 'Error al registrar abono'),
  })

  const totalAbono = seleccionadas.reduce((s, c) => s + (Number(c.monto) || 0), 0)

  if (cuotasPendientes.length === 0) return (
    <div className="flex flex-col items-center justify-center py-8 text-on-surface-variant">
      <CheckCircle className="w-8 h-8 mb-2 text-[#16a34a] opacity-60" />
      <p className="text-sm">Todas las cuotas están pagadas</p>
    </div>
  )

  return (
    <div className="space-y-4 pt-3 border-t border-outline-variant/40">
      <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Registrar abono</p>

      {/* Selección de cuotas */}
      <div className="space-y-1.5">
        <p className="text-[11px] text-on-surface-variant">Seleccioná las cuotas a saldar</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
          {cuotasPendientes.map(c => {
            const sel = seleccionadas.find(s => s.cuotaId === c.id)
            const vencida = esVencida(c.fechaVencimiento)
            return (
              <div key={c.id} className="space-y-2">
                <button type="button" onClick={() => toggleCuota(c)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all duration-150 cursor-pointer',
                    sel     ? 'border-primary bg-primary/8' :
                    vencida ? 'border-[#dc2626]/30 bg-[#dc2626]/4 hover:border-[#dc2626]/50' :
                              'border-outline-variant/60 bg-surface-high hover:border-outline-variant',
                  )}>
                  <div className={cn('w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors',
                    sel ? 'bg-primary border-primary' : 'border-outline-variant bg-surface-lowest')}>
                    {sel && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <span className={cn('text-[11px] font-bold w-5 text-center flex-shrink-0',
                    sel ? 'text-primary' : vencida ? 'text-[#dc2626]' : 'text-on-surface-variant')}>
                    #{c.numero}
                  </span>
                  <span className="text-[13px] font-bold text-on-surface tabular-nums flex-1">{formatCOP(c.monto)}</span>
                  <div className="text-right">
                    <p className="text-[11px] text-on-surface-variant">{fmtFecha(c.fechaVencimiento)}</p>
                    {vencida && <p className="text-[9px] font-bold text-[#dc2626]">VENCIDA</p>}
                  </div>
                </button>

                {/* Campos de monto y fecha por cuota seleccionada */}
                {sel && (
                  <div className="grid grid-cols-2 gap-2 pl-2">
                    <div>
                      <label className={labelCls}>Monto pagado *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant">$</span>
                        <NumericInput value={sel.monto} onChange={v => actualizarCuotaAbono(c.id, 'monto', v)}
                          placeholder="0" className={cn(inputCls, 'pl-6 text-sm py-1.5')} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Fecha de pago *</label>
                      <input type="date" className={cn(inputCls, 'text-sm py-1.5')} value={sel.fecha}
                        onChange={e => actualizarCuotaAbono(c.id, 'fecha', e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Total seleccionado */}
      {seleccionadas.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-primary/6 rounded-xl border border-primary/20">
          <span className="text-[12px] font-medium text-on-surface-variant">{seleccionadas.length} cuota{seleccionadas.length !== 1 ? 's' : ''} · Total abono</span>
          <span className="text-[14px] font-bold text-primary tabular-nums">{formatCOP(totalAbono)}</span>
        </div>
      )}

      {/* Medio de pago */}
      <div>
        <label className={labelCls}>Medio de pago *</label>
        <div className="flex gap-2">
          {MEDIOS_PAGO.map(m => (
            <button key={m} type="button" onClick={() => setMedioPago(m)}
              className={cn('flex-1 py-2 rounded-lg border-2 text-xs font-semibold transition-all cursor-pointer',
                medioPago === m ? 'border-primary bg-primary/8 text-primary' : 'border-outline-variant text-on-surface-variant hover:border-outline-variant/80')}>
              {m}
            </button>
          ))}
        </div>
        {medioPago === 'Otro' && (
          <input className={cn(inputCls, 'mt-2')} placeholder="Especifica el medio de pago..." value={otroMedio}
            onChange={e => setOtroMedio(e.target.value)} />
        )}
      </div>

      {/* Comprobante */}
      <div>
        <label className={labelCls}>Comprobante (opcional)</label>
        <label className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-surface-high border border-outline-variant rounded-lg hover:bg-surface-high/80 transition-colors">
          <input type="file" accept="image/*,.pdf" className="hidden" disabled={subiendo}
            onChange={e => { const f = e.target.files?.[0]; if (f) subirComprobante(f); e.target.value = '' }} />
          {subiendo ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <Paperclip className="w-4 h-4 text-on-surface-variant" />}
          <span className="text-sm text-on-surface-variant">{subiendo ? 'Subiendo...' : esUrlValida(comprobante) ? '✓ Comprobante adjunto' : 'Adjuntar comprobante'}</span>
        </label>
        <VerComprobante url={comprobante} className="mt-1" />
      </div>

      {error && <p className="text-xs text-[var(--error)] bg-[var(--error-container)]/40 border border-[var(--error)]/20 rounded-lg px-3 py-2">{error}</p>}

      <button onClick={() => abonoMutation.mutate()}
        disabled={abonoMutation.isPending || seleccionadas.length === 0}
        className="flex items-center gap-2 w-full justify-center py-2.5 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer">
        {abonoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        Registrar abono ({seleccionadas.length} cuota{seleccionadas.length !== 1 ? 's' : ''})
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// TAB: PERFIL
// ══════════════════════════════════════════════════════════════════════════
function TabPerfil({ e, fetcher, isAdmin, colegios, asesores, cursos, onRefresh }: {
  e: EstudianteDetalle
  fetcher: <T>(path: string, opts?: RequestInit) => Promise<T>
  isAdmin: boolean
  colegios: { id: string; nombre: string }[]
  asesores: { id: string; nombre: string }[]
  cursos: { id: string; nombre: string; precio: number }[]
  onRefresh: () => void
}) {
  const [editando, setEditando] = useState(false)
  const [error, setError] = useState('')
  const cursoActivo = e.cursos?.[0]

  // Normalizar tipoDocumento: la BD puede tener el nombre largo (dato antiguo)
  const TIPO_DOC_MAP: Record<string, string> = {
    'Cédula de Ciudadanía': 'CC', 'Cedula de Ciudadania': 'CC',
    'Tarjeta de Identidad': 'TI', 'Tarjeta de Identidad (TI)': 'TI',
    'Cédula de Extranjería': 'CE', 'Cedula de Extranjeria': 'CE',
    'Pasaporte': 'PA', 'Registro Civil': 'RC',
  }
  const TIPOS_VALIDOS = ['CC', 'TI', 'CE', 'PA', 'RC']
  const normalizarTipoDoc = (v: string | null | undefined) => {
    if (!v) return 'CC'
    if (TIPOS_VALIDOS.includes(v)) return v
    return TIPO_DOC_MAP[v] ?? 'CC'
  }

  const [form, setForm] = useState({
    nombre: e.nombre, tipoDocumento: normalizarTipoDoc(e.tipoDocumento),
    documento: e.documento ?? '', email: e.email, telefono: e.telefono,
    fechaNacimiento: e.fechaNacimiento?.split('T')[0] ?? '',
    departamento: e.departamento ?? '', ciudad: e.ciudad ?? '',
    colegioId: e.colegio?.id ?? '', asesorId: e.asesor?.id ?? '',
    lineaAutorizada: e.lineaAutorizada ? String(e.lineaAutorizada) : '',
    agregado: e.agregado ? 'si' : 'no',
    nombreGrupo: e.nombreGrupo ?? '',
    cursoId: cursoActivo?.cursoId ?? '',
    acudienteNombre: e.acudiente?.nombre ?? '', acudienteEmail: e.acudiente?.email ?? '',
    acudienteTelefono: e.acudiente?.telefono ?? '', acudienteRelacion: e.acudiente?.relacion ?? 'Padre',
  })

  const guardarMutation = useMutation({
    mutationFn: async () => {
      if (!form.nombre || !form.email || !form.telefono) throw new Error('Completa los campos obligatorios')
      // Incluir acudiente si tiene nombre y teléfono
      const acudiente = form.acudienteNombre.trim() && form.acudienteTelefono.trim()
        ? {
            nombre:   form.acudienteNombre.trim(),
            email:    form.acudienteEmail.trim() || null,
            telefono: form.acudienteTelefono.trim(),
            relacion: form.acudienteRelacion,
          }
        : undefined
      return fetcher(`/estudiantes/${e.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre.trim(), tipoDocumento: form.tipoDocumento,
          documento: form.documento.trim() || null,
          email: form.email.trim(), telefono: form.telefono.trim(),
          fechaNacimiento: form.fechaNacimiento,
          departamento: form.departamento || null, ciudad: form.ciudad || null,
          colegioId: form.colegioId || null,
          agregado: form.agregado === 'si',
          nombreGrupo: form.agregado === 'si' ? (form.nombreGrupo.trim() || null) : null,
          ...(isAdmin && {
            asesorId: form.asesorId || null,
            cursoId: form.cursoId || null,
            lineaAutorizada: form.lineaAutorizada ? Number(form.lineaAutorizada) : null,
          }),
          ...(acudiente && { acudiente }),
        }),
      })
    },
    onSuccess: () => { setEditando(false); setError(''); onRefresh() },
    onError: (err: any) => setError(err.message ?? 'Error al guardar'),
  })

  const f = (key: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [key]: v }))

  if (!editando) return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Datos personales</p>
          <button onClick={() => setEditando(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-colors cursor-pointer">
            <Pencil className="w-3 h-3" />Editar
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: User,       label: 'Nombre',     value: e.nombre },
            { icon: CreditCard, label: 'Documento',  value: e.documento ? `${e.tipoDocumento} ${e.documento}` : e.tipoDocumento ?? '—' },
            { icon: Mail,       label: 'Email',      value: e.email },
            { icon: Phone,      label: 'Teléfono',   value: e.telefono },
            { icon: Users,      label: 'Asesor',     value: e.asesor?.nombre ?? '—' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-high/60">
              <Icon className="w-3.5 h-3.5 text-on-surface-variant mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-on-surface-variant">{label}</p>
                <p className="text-[13px] font-medium text-on-surface truncate">{value || '—'}</p>
              </div>
            </div>
          ))}
        </div>

      </section>

      {cursoActivo && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Curso adquirido</p>
          <div className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant bg-surface-lowest">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-on-surface">{cursoActivo.curso.nombre}</p>
              <p className="text-[11px] text-on-surface-variant">Precio: {formatCOP(cursoActivo.precioAcordado ?? cursoActivo.curso.precio)}</p>
            </div>
          </div>
        </section>
      )}

      {e.acudiente && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Acudiente</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Nombre',   value: e.acudiente.nombre },
              { label: 'Relación', value: e.acudiente.relacion },
              { label: 'Email',    value: e.acudiente.email },
              { label: 'Teléfono',value: e.acudiente.telefono },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded-xl bg-surface-high/60">
                <p className="text-[10px] text-on-surface-variant">{label}</p>
                <p className="text-[13px] font-medium text-on-surface">{value}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Editando perfil</p>
        <button onClick={() => setEditando(false)} className="text-xs text-on-surface-variant hover:text-on-surface cursor-pointer">Cancelar</button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="col-span-2 lg:col-span-2">
          <label className={labelCls}>Nombre completo *</label>
          <input className={inputCls} value={form.nombre} onChange={e => f('nombre')(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Tipo doc.</label>
          <select className={inputCls} value={form.tipoDocumento} onChange={e => f('tipoDocumento')(e.target.value)}>
            {['CC','TI','CE','PA','RC'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Número documento</label>
          <input className={inputCls} value={form.documento} onChange={e => f('documento')(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Email *</label>
          <input type="email" className={inputCls} value={form.email} onChange={e => f('email')(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Teléfono *</label>
          <input className={inputCls} value={form.telefono} onChange={e => f('telefono')(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Fecha nacimiento</label>
          <input type="date" className={cn(inputCls, 'w-auto')} value={form.fechaNacimiento} onChange={e => f('fechaNacimiento')(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Colegio</label>
          <select className={inputCls} value={form.colegioId} onChange={e => f('colegioId')(e.target.value)}>
            <option value="">Sin colegio</option>
            {colegios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Departamento</label>
          <select className={inputCls} value={form.departamento} onChange={e => { f('departamento')(e.target.value); f('ciudad')('') }}>
            <option value="">Seleccionar</option>
            {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Ciudad</label>
          <select className={inputCls} value={form.ciudad} onChange={e => f('ciudad')(e.target.value)} disabled={!form.departamento}>
            <option value="">Seleccionar</option>
            {getMunicipios(form.departamento).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {isAdmin && (
          <>
            <div>
              <label className={labelCls}>Asesor</label>
              <select className={inputCls} value={form.asesorId} onChange={e => f('asesorId')(e.target.value)}>
                <option value="">Sin asignar</option>
                {asesores.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Línea autorizada</label>
              <select className={inputCls} value={form.lineaAutorizada} onChange={e => f('lineaAutorizada')(e.target.value)}>
                <option value="">Sin asignar</option>
                {[1,2,3,4,5,6].map(n => <option key={n} value={n}>Línea {n}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Agregado</label>
              <select className={inputCls} value={form.agregado} onChange={e => f('agregado')(e.target.value)}>
                <option value="no">No</option>
                <option value="si">Sí</option>
              </select>
            </div>
            {form.agregado === 'si' && (
              <div>
                <label className={labelCls}>Nombre del grupo</label>
                <input className={inputCls} placeholder="Ej: Grupo WhatsApp A" value={form.nombreGrupo} onChange={e => f('nombreGrupo')(e.target.value)} />
              </div>
            )}
            <div>
              <label className={labelCls}>Curso</label>
              <select className={inputCls} value={form.cursoId} onChange={e => f('cursoId')(e.target.value)}>
                <option value="">Sin curso</option>
                {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-3">Acudiente</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>Nombre</label>
            <input className={inputCls} value={form.acudienteNombre} onChange={e => f('acudienteNombre')(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} value={form.acudienteEmail} onChange={e => f('acudienteEmail')(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Teléfono</label>
            <input className={inputCls} value={form.acudienteTelefono} onChange={e => f('acudienteTelefono')(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Relación</label>
            <select className={inputCls} value={form.acudienteRelacion} onChange={e => f('acudienteRelacion')(e.target.value)}>
              {['Padre','Madre','Tutor','Hermano/a','Otro'].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </div>
      {error && <p className="text-xs text-[var(--error)] bg-[var(--error-container)]/40 border border-[var(--error)]/20 rounded-lg px-3 py-2">{error}</p>}
      <button onClick={() => guardarMutation.mutate()} disabled={guardarMutation.isPending}
        className="flex items-center gap-2 w-full justify-center py-2.5 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer">
        {guardarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Guardar cambios
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// COMPONENTE: FORM NUEVO PAGO DIRECTO
// ══════════════════════════════════════════════════════════════════════════
// El método se guarda directamente como string en la BD (sin enum)
const METODOS_DISPLAY = ['Bancolombia', 'Bre-B', 'Nequi', 'Tarjeta', 'Otro']

function FormNuevoPago({ estudianteId, fetcher, onSuccess }: {
  estudianteId: string
  fetcher: <T>(path: string, opts?: RequestInit) => Promise<T>
  onSuccess: () => void
}) {
  const hoy = new Date().toISOString().split('T')[0]
  const [monto,       setMonto]       = useState('')
  const [pagarAhora,  setPagarAhora]  = useState(true)
  const [fechaPago,   setFechaPago]   = useState(hoy)
  const [fechaVenc,   setFechaVenc]   = useState(hoy)
  const [metodo,      setMetodo]      = useState('Bancolombia')
  const [otroMetodo,  setOtroMetodo]  = useState('')
  const [comprobante, setComprobante] = useState('')
  const [subiendo,    setSubiendo]    = useState(false)
  const [error,       setError]       = useState('')

  const subirComp = async (file: File) => {
    setSubiendo(true)
    try {
      const token = await getClientToken()
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/imagen`, {
        method: 'POST', headers: { Authorization: `Bearer ${token ?? ''}` }, body: fd,
      })
      const json = await res.json()
      if (!res.ok || !json?.data?.url) throw new Error(json?.error ?? 'Error al subir')
      setComprobante(json.data.url)
    } catch (e: any) { setError(e.message ?? 'Error al subir') }
    finally { setSubiendo(false) }
  }

  const metodoFinal = metodo === 'Otro' ? (otroMetodo.trim() || 'Otro') : metodo

  const mutation = useMutation({
    mutationFn: async () => {
      const n = Number(monto)
      if (!n || n <= 0) throw new Error('Ingresa un monto válido')
      // Si paga ahora la "fecha de vencimiento" = fecha de pago (ya pagó)
      const vencimiento = pagarAhora ? fechaPago : fechaVenc
      if (!vencimiento) throw new Error(pagarAhora ? 'Ingresa la fecha de pago' : 'Ingresa la fecha de vencimiento')

      // 1. Crear el pago (siempre necesita fechaVencimiento en el backend)
      const created = await fetcher<{ data: { id: string } }>('/pagos', {
        method: 'POST',
        body: JSON.stringify({ estudianteId, monto: n, metodo: metodoFinal, fechaVencimiento: vencimiento }),
      })

      // 2. Si "pagar ahora", marcar PAGADO en el mismo request
      if (pagarAhora && created?.data?.id) {
        await fetcher(`/pagos/${created.data.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            estado: 'PAGADO', fechaPago,
            ...(comprobante && { comprobante }),
          }),
        })
      }
    },
    onSuccess: () => { setMonto(''); setComprobante(''); setError(''); setOtroMetodo(''); onSuccess() },
    onError:   (e: any) => setError(e.message ?? 'Error al registrar pago'),
  })

  const montoNum = Number(monto)

  return (
    <div className="space-y-4 pt-3 border-t border-outline-variant/40">
      <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Registrar pago directo</p>

      {/* ── 1. Toggle "Pagar ahora" PRIMERO — define el flujo completo ── */}
      <div
        onClick={() => setPagarAhora(v => !v)}
        className={cn(
          'flex items-center gap-3 py-3 px-4 rounded-xl border-2 transition-all duration-200 cursor-pointer select-none',
          pagarAhora
            ? 'border-[#16a34a]/40 bg-[#16a34a]/6'
            : 'border-outline-variant/60 bg-surface-high hover:border-outline-variant',
        )}
      >
        <div className={cn(
          'relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0',
          pagarAhora ? 'bg-[#16a34a]' : 'bg-outline-variant',
        )}>
          <span className={cn(
            'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200',
            pagarAhora && 'translate-x-5',
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-[13px] font-bold', pagarAhora ? 'text-[#16a34a]' : 'text-on-surface')}>
            {pagarAhora ? '✓ Pago recibido' : 'Cobro pendiente'}
          </p>
          <p className="text-[11px] text-on-surface-variant leading-tight">
            {pagarAhora
              ? 'El estudiante ya pagó — se registra como PAGADO'
              : 'El estudiante aún no paga — queda pendiente para cobrar'}
          </p>
        </div>
      </div>

      {/* ── 2. Monto + fecha (contexto según modo) ── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Monto *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">$</span>
            <NumericInput value={monto} onChange={setMonto} placeholder="0" className={cn(inputCls, 'pl-6')} />
          </div>
        </div>
        {pagarAhora ? (
          <div>
            <label className={labelCls}>Fecha de pago *</label>
            <input type="date" className={inputCls} value={fechaPago}
              onChange={e => setFechaPago(e.target.value)} />
          </div>
        ) : (
          <div>
            <label className={labelCls}>Fecha de vencimiento *</label>
            <input type="date" className={inputCls} value={fechaVenc}
              onChange={e => setFechaVenc(e.target.value)} />
          </div>
        )}
      </div>

      {/* ── 3. Método de pago ── */}
      <div>
        <label className={labelCls}>Método de pago *</label>
        <div className="flex flex-wrap gap-1.5">
          {METODOS_DISPLAY.map(m => (
            <button key={m} type="button" onClick={() => setMetodo(m)}
              className={cn('px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all cursor-pointer',
                metodo === m ? 'border-primary bg-primary/8 text-primary' : 'border-outline-variant text-on-surface-variant hover:border-outline')}>
              {m}
            </button>
          ))}
        </div>
        {metodo === 'Otro' && (
          <input className={cn(inputCls, 'mt-1.5')} placeholder="Especifica el método..." value={otroMetodo}
            onChange={e => setOtroMetodo(e.target.value)} />
        )}
      </div>

      {/* ── 4. Comprobante (solo si paga ahora) ── */}
      {pagarAhora && (
        <div>
          <label className={labelCls}>Comprobante (opcional)</label>
          <label className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-surface-high border border-outline-variant rounded-lg hover:bg-surface-high/80 transition-colors">
            <input type="file" accept="image/*,.pdf" className="hidden" disabled={subiendo}
              onChange={e => { const f = e.target.files?.[0]; if (f) subirComp(f); e.target.value = '' }} />
            {subiendo ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" /> : <Paperclip className="w-3.5 h-3.5 text-on-surface-variant" />}
            <span className="text-xs text-on-surface-variant">
              {subiendo ? 'Subiendo...' : esUrlValida(comprobante) ? '✓ Comprobante adjunto' : 'Adjuntar comprobante'}
            </span>
          </label>
          <VerComprobante url={comprobante} className="mt-1" />
        </div>
      )}

      {error && <p className="text-xs text-[var(--error)] bg-[var(--error-container)]/40 border border-[var(--error)]/20 rounded-lg px-3 py-2">{error}</p>}

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !monto}
        className={cn(
          'flex items-center gap-2 w-full justify-center py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50',
          pagarAhora
            ? 'bg-[#16a34a] hover:bg-[#15803d] text-white'
            : 'bg-primary hover:bg-primary/90 text-on-primary',
        )}
      >
        {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        {pagarAhora
          ? `Registrar pago${montoNum > 0 ? ` de ${formatCOP(montoNum)}` : ''}`
          : `Crear cobro pendiente${montoNum > 0 ? ` · ${formatCOP(montoNum)}` : ''}`}
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// COMPONENTE: FILA DE PAGO DIRECTO (marcar como pagado + comprobante)
// ══════════════════════════════════════════════════════════════════════════
function FilaPagoDirecto({ p, fetcher, onRefresh }: {
  p: Pago
  fetcher: <T>(path: string, opts?: RequestInit) => Promise<T>
  onRefresh: () => void
}) {
  const [abierto,    setAbierto]    = useState(false)
  const [editando,   setEditando]   = useState(false)
  const [fechaPago,  setFechaPago]  = useState(new Date().toISOString().split('T')[0])
  const [comprobante, setComprobante] = useState(p.comprobante ?? '')
  const [subiendo,   setSubiendo]   = useState(false)
  const [error,      setError]      = useState('')

  // Edit state
  const metodoInicial = METODOS_DISPLAY.includes(p.metodo ?? '') ? (p.metodo ?? 'Bancolombia') : 'Otro'
  const [editMonto,      setEditMonto]      = useState(String(Math.round(p.monto)))
  const [editFechaVenc,  setEditFechaVenc]  = useState(p.fechaVencimiento?.split('T')[0] ?? '')
  const [editFechaPago,  setEditFechaPago]  = useState(p.fechaPago?.split('T')[0] ?? '')
  const [editMetodo,     setEditMetodo]     = useState(metodoInicial)
  const [editOtroMetodo, setEditOtroMetodo] = useState(METODOS_DISPLAY.includes(p.metodo ?? '') ? '' : (p.metodo ?? ''))
  const [editComp,       setEditComp]       = useState(p.comprobante ?? '')
  const [editSubiendo,   setEditSubiendo]   = useState(false)
  const [editError,      setEditError]      = useState('')

  const pagado  = p.estado === 'PAGADO'
  const vencido = p.estado === 'VENCIDO'

  const subirComp = async (file: File, setter: (u: string) => void, errSetter: (e: string) => void, loadSetter: (b: boolean) => void) => {
    loadSetter(true)
    try {
      const token = await getClientToken()
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/imagen`, {
        method: 'POST', headers: { Authorization: `Bearer ${token ?? ''}` }, body: fd,
      })
      const json = await res.json()
      if (!res.ok || !json?.data?.url) throw new Error(json?.error ?? 'Error al subir')
      setter(json.data.url)
    } catch (e: any) { errSetter(e.message ?? 'Error al subir') }
    finally { loadSetter(false) }
  }

  const marcarPagado = useMutation({
    mutationFn: () => fetcher(`/pagos/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        estado: 'PAGADO', fechaPago,
        ...(comprobante && { comprobante }),
      }),
    }),
    onSuccess: () => { setAbierto(false); setError(''); onRefresh() },
    onError: (e: any) => setError(e.message ?? 'Error al guardar'),
  })

  const editMetodoFinal = editMetodo === 'Otro' ? (editOtroMetodo.trim() || 'Otro') : editMetodo

  const editarMutation = useMutation({
    mutationFn: () => fetcher(`/pagos/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        monto:           Number(editMonto),
        metodo:          editMetodoFinal,
        fechaVencimiento: editFechaVenc,
        ...(pagado && editFechaPago && { fechaPago: editFechaPago }),
        ...(esUrlValida(editComp) && { comprobante: editComp }),
      }),
    }),
    onSuccess: () => { setEditando(false); setEditError(''); onRefresh() },
    onError: (e: any) => setEditError(e.message ?? 'Error al guardar'),
  })

  const eliminar = async () => {
    if (!confirm('¿Eliminar este pago?')) return
    const token = await getClientToken()
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/pagos/${p.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token ?? ''}` },
    })
    onRefresh()
  }

  // ── Modo edición ──────────────────────────────────────────────────────────
  if (editando) return (
    <div className="px-3 py-3 rounded-xl border-2 border-primary/40 bg-primary/5 space-y-3">
      <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">Editando pago directo</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Monto</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant">$</span>
            <NumericInput value={editMonto} onChange={setEditMonto} placeholder="0" className={cn(inputCls, 'pl-6 text-sm py-1.5')} />
          </div>
        </div>
        {pagado ? (
          <div>
            <label className={labelCls}>Fecha de pago</label>
            <input type="date" className={cn(inputCls, 'text-sm py-1.5')} value={editFechaPago} onChange={e => setEditFechaPago(e.target.value)} />
          </div>
        ) : (
          <div>
            <label className={labelCls}>Fecha de vencimiento</label>
            <input type="date" className={cn(inputCls, 'text-sm py-1.5')} value={editFechaVenc} onChange={e => setEditFechaVenc(e.target.value)} />
          </div>
        )}
      </div>

      <div>
        <label className={labelCls}>Método de pago</label>
        <div className="flex flex-wrap gap-1.5">
          {METODOS_DISPLAY.map(m => (
            <button key={m} type="button" onClick={() => setEditMetodo(m)}
              className={cn('px-3 py-1.5 rounded-lg border-2 text-[11px] font-semibold transition-all cursor-pointer',
                editMetodo === m ? 'border-primary bg-primary/8 text-primary' : 'border-outline-variant text-on-surface-variant hover:border-outline')}>
              {m}
            </button>
          ))}
        </div>
        {editMetodo === 'Otro' && (
          <input className={cn(inputCls, 'mt-1.5 text-sm')} placeholder="Especifica el método..." value={editOtroMetodo}
            onChange={e => setEditOtroMetodo(e.target.value)} />
        )}
      </div>

      <div>
        <label className={labelCls}>Comprobante</label>
        <label className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-surface-high border border-outline-variant rounded-lg hover:bg-surface-high/80 transition-colors">
          <input type="file" accept="image/*,.pdf" className="hidden" disabled={editSubiendo}
            onChange={e => { const f = e.target.files?.[0]; if (f) subirComp(f, setEditComp, setEditError, setEditSubiendo); e.target.value = '' }} />
          {editSubiendo ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" /> : <Paperclip className="w-3.5 h-3.5 text-on-surface-variant" />}
          <span className="text-xs text-on-surface-variant">{editSubiendo ? 'Subiendo...' : esUrlValida(editComp) ? '✓ Comprobante adjunto' : 'Adjuntar comprobante'}</span>
        </label>
        <VerComprobante url={editComp} label="Ver comprobante actual" className="mt-1" />
      </div>

      {editError && <p className="text-xs text-[var(--error)]">{editError}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={() => setEditando(false)} className="px-3 py-1 text-xs text-on-surface-variant hover:text-on-surface cursor-pointer">Cancelar</button>
        <button onClick={() => editarMutation.mutate()} disabled={editarMutation.isPending}
          className="flex items-center gap-1 px-3 py-1 bg-primary text-on-primary rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50">
          {editarMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Guardar
        </button>
      </div>
    </div>
  )

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      pagado  ? 'border-[#16a34a]/20' :
      vencido ? 'border-[#dc2626]/25' :
                'border-outline-variant/50',
    )}>
      {/* Fila principal */}
      <div className={cn(
        'flex items-center gap-3 px-3 py-2.5 group',
        pagado  ? 'bg-[#16a34a]/4' :
        vencido ? 'bg-[#dc2626]/4' :
                  'bg-surface-high/40',
      )}>
        <div className={cn('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
          pagado ? 'bg-[#16a34a]/15' : vencido ? 'bg-[#dc2626]/15' : 'bg-surface-high')}>
          {pagado  ? <CheckCircle  className="w-3.5 h-3.5 text-[#16a34a]" />
           : vencido ? <AlertTriangle className="w-3.5 h-3.5 text-[#dc2626]" />
           : <CreditCard className="w-3.5 h-3.5 text-on-surface-variant" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-on-surface">{formatCOP(p.monto)} · {p.metodo}</p>
          <p className="text-[10px] text-on-surface-variant">
            {pagado && p.fechaPago ? `Pagado ${fmtFecha(p.fechaPago)}` : `Vence ${fmtFecha(p.fechaVencimiento)}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <VerComprobante url={p.comprobante} variante="chip" />
          {!pagado && (
            <button onClick={() => setAbierto(v => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/20 transition-colors cursor-pointer">
              <CheckCircle className="w-3 h-3" />
              {abierto ? 'Cancelar' : 'Marcar pagado'}
            </button>
          )}
          <button onClick={() => setEditando(true)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-surface-high transition-all cursor-pointer">
            <Pencil className="w-3 h-3 text-on-surface-variant" />
          </button>
          <button onClick={eliminar}
            className="p-1 rounded-md hover:bg-[#dc2626]/10 transition-colors cursor-pointer">
            <Trash2 className="w-3.5 h-3.5 text-[#dc2626]" />
          </button>
        </div>
      </div>

      {/* Panel de confirmación de pago */}
      {abierto && (
        <div className="px-4 py-3 border-t border-outline-variant/30 bg-surface-lowest space-y-3">
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">Confirmar pago</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Fecha de pago *</label>
              <input type="date" className={cn(inputCls, 'text-sm py-1.5')}
                value={fechaPago} onChange={e => setFechaPago(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Comprobante (opcional)</label>
              <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 bg-surface-high border border-outline-variant rounded-lg hover:bg-surface-high/80 transition-colors">
                <input type="file" accept="image/*,.pdf" className="hidden" disabled={subiendo}
                  onChange={e => { const f = e.target.files?.[0]; if (f) subirComp(f, setComprobante, setError, setSubiendo); e.target.value = '' }} />
                {subiendo
                  ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                  : <Paperclip className="w-3.5 h-3.5 text-on-surface-variant" />}
                <span className="text-[11px] text-on-surface-variant truncate">
                  {subiendo ? 'Subiendo...' : esUrlValida(comprobante) ? '✓ Adjunto' : 'Adjuntar'}
                </span>
              </label>
            </div>
          </div>
          <VerComprobante url={comprobante} />
          {error && <p className="text-xs text-[var(--error)]">{error}</p>}
          <button onClick={() => marcarPagado.mutate()}
            disabled={marcarPagado.isPending || !fechaPago}
            className="flex items-center gap-2 w-full justify-center py-2 bg-[#16a34a] text-white rounded-xl text-xs font-semibold hover:bg-[#15803d] disabled:opacity-50 transition-colors cursor-pointer">
            {marcarPagado.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Confirmar pago de {formatCOP(p.monto)}
          </button>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// TAB: FINANCIERO (incluye abonos)
// ══════════════════════════════════════════════════════════════════════════
function TabFinanciero({ e, fetcher, onRefresh, cursos, isAdmin }: {
  e: EstudianteDetalle
  fetcher: <T>(path: string, opts?: RequestInit) => Promise<T>
  onRefresh: () => void
  cursos: { id: string; nombre: string; precio: number }[]
  isAdmin: boolean
}) {
  const financiamientos = e.financiamientos ?? []
  const pagos = e.pagos ?? []
  const hoy = new Date()
  const [abonoAbierto, setAbonoAbierto] = useState(false)

  const cursoEst = e.cursos?.[0]

  // ── Descuento ────────────────────────────────────────────────────────────
  const precioBase      = cursoEst ? (cursoEst.precioAcordado ?? cursoEst.curso.precio) : 0
  const descuentoMonto  = cursoEst
    ? Math.round(precioBase * cursoEst.descuentoPorcentaje / 100) : 0
  const precioConDescuento = precioBase - descuentoMonto

  const [editDescuento, setEditDescuento] = useState(false)
  const [precioFinalInput, setPrecioFinalInput] = useState(String(precioConDescuento))
  const [savingDescuento, setSavingDescuento] = useState(false)

  const descuentoCalculado = Math.max(0, precioBase - Number(precioFinalInput.replace(/\./g, '') || precioConDescuento))

  async function guardarDescuento() {
    if (!cursoEst) return
    setSavingDescuento(true)
    const precioFinal = Number(precioFinalInput.replace(/\./g, ''))
    const descPct = precioBase > 0 ? Math.min(100, Math.max(0, ((precioBase - precioFinal) / precioBase) * 100)) : 0
    try {
      await fetcher(`/estudiantes/${e.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cursoId: cursoEst.cursoId, descuentoPorcentaje: descPct }),
      })
      setEditDescuento(false)
      onRefresh()
    } finally {
      setSavingDescuento(false)
    }
  }

  // ── Cálculos con descuento aplicado ──────────────────────────────────────
  const totalGeneral   = cursoEst
    ? precioConDescuento
    : financiamientos.reduce((s, f) => s + f.montoTotal, 0) + pagos.reduce((s, p) => s + p.monto, 0)

  const pagadoFin      = financiamientos.flatMap(f => f.cuotas).filter(c => c.pagado).reduce((s, c) => s + c.monto, 0)
  const pagadoPagosDir = pagos.filter(p => p.estado === 'PAGADO').reduce((s, p) => s + p.monto, 0)
  const totalPagado    = pagadoFin + pagadoPagosDir
  const totalPendiente = Math.max(0, totalGeneral - totalPagado)
  const progreso       = totalGeneral > 0 ? Math.min(100, (totalPagado / totalGeneral) * 100) : 0
  const totalMora      = financiamientos.flatMap(f => f.cuotas).filter(c =>
    !c.pagado && isBefore(parseISO(c.fechaVencimiento), hoy) && !isToday(parseISO(c.fechaVencimiento))
  ).reduce((s, c) => s + c.monto, 0) + pagos.filter(p => p.estado === 'VENCIDO').reduce((s, p) => s + p.monto, 0)

  const cuotasPendientes = financiamientos.flatMap(f => f.cuotas.filter(c => !c.pagado))
  const [nuevoPagoAbierto, setNuevoPagoAbierto] = useState(false)

  // Sin curso ni pagos ni financiamientos → realmente vacío
  if (!cursoEst && financiamientos.length === 0 && pagos.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
      <Wallet className="w-10 h-10 mb-3 opacity-30" />
      <p className="text-sm">Sin información financiera registrada</p>
    </div>
  )

  return (
    <div className="space-y-6">

      {/* ── Curso + Descuento ─────────────────────────────────────────────── */}
      {cursoEst && (
        <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-on-surface">{cursoEst.curso.nombre}</p>
                <p className="text-[11px] text-on-surface-variant">Precio base: {formatCOP(precioBase)}</p>
              </div>
            </div>
            {!editDescuento && (
              <button
                onClick={() => { setPrecioFinalInput(String(precioConDescuento)); setEditDescuento(true) }}
                className="text-[11px] text-primary hover:underline cursor-pointer flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" />Precio final
              </button>
            )}
          </div>

          {/* Fila de descuento */}
          {editDescuento ? (
            <div className="bg-surface-high rounded-xl px-3 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-on-surface-variant flex-1">Precio final:</span>
                <span className="text-sm text-on-surface-variant">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={fmtNum(precioFinalInput)}
                  onChange={e => setPrecioFinalInput(e.target.value.replace(/\./g, '').replace(/[^0-9]/g, ''))}
                  className="w-32 border border-outline-variant rounded-lg px-2 py-1 text-[13px] text-on-surface bg-surface-lowest focus:outline-none focus:border-primary/50 text-right"
                />
              </div>
              {descuentoCalculado > 0 && (
                <p className="text-[11px] text-[#16a34a]">
                  Descuento automático: −{formatCOP(descuentoCalculado)} ({Math.round((descuentoCalculado / precioBase) * 100)}%)
                </p>
              )}
              <div className="flex items-center gap-2 justify-end">
                <button onClick={() => setEditDescuento(false)}
                  className="text-[11px] text-on-surface-variant hover:text-on-surface cursor-pointer">
                  Cancelar
                </button>
                <button onClick={guardarDescuento} disabled={savingDescuento}
                  className="px-3 py-1 rounded-lg bg-primary text-white text-[11px] font-semibold disabled:opacity-60 cursor-pointer">
                  {savingDescuento ? '...' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : descuentoMonto > 0 ? (
            <div className="flex items-center justify-between bg-[#16a34a]/8 rounded-xl px-3 py-2">
              <span className="text-[12px] text-[#16a34a] font-medium">Descuento aplicado</span>
              <span className="text-[13px] font-bold text-[#16a34a]">−{formatCOP(descuentoMonto)}</span>
            </div>
          ) : null}

          {/* Precio final — siempre visible */}
          <div className="flex items-center justify-between border-t border-outline-variant/40 pt-2">
            <span className="text-[12px] font-semibold text-on-surface">Precio final</span>
            <span className="text-[15px] font-bold text-on-surface tabular-nums">{formatCOP(precioConDescuento)}</span>
          </div>
        </div>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',     value: formatCOP(totalGeneral),   color: 'text-on-surface' },
          { label: 'Pagado',    value: formatCOP(totalPagado),    color: 'text-[#16a34a]' },
          { label: 'Pendiente', value: formatCOP(totalPendiente), color: totalPendiente > 0 ? 'text-[#d97706]' : 'text-on-surface-variant' },
          { label: 'En mora',   value: formatCOP(totalMora),      color: totalMora > 0 ? 'text-[#dc2626]' : 'text-on-surface-variant' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface-high rounded-2xl p-3 text-center">
            <p className={cn('text-base font-bold tabular-nums', color)}>{value}</p>
            <p className="text-[10px] text-on-surface-variant mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Progreso */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-on-surface-variant">
          <span>Progreso de pago</span>
          <span className="font-semibold text-on-surface">{Math.round(progreso)}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-surface-high overflow-hidden">
          <div className={cn('h-full rounded-full transition-all duration-700',
            progreso >= 100 ? 'bg-[#16a34a]' : totalMora > 0 ? 'bg-[#dc2626]' : 'bg-primary')}
            style={{ width: `${progreso}%` }} />
        </div>
      </div>

      {/* Financiamientos */}
      {financiamientos.map(fin => (
        <section key={fin.id} className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
              Financiamiento · {formatCOP(fin.montoTotal)}
            </p>
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
              fin.estado === 'COMPLETADO' ? 'bg-[#16a34a]/12 text-[#16a34a]' :
              fin.estado === 'CANCELADO'  ? 'bg-[#dc2626]/12 text-[#dc2626]' :
              'bg-primary/10 text-primary')}>
              {fin.estado}
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
            {fin.cuotas.map(c => (
              <FilaCuota key={c.id} c={c} fetcher={fetcher} onRefresh={onRefresh} />
            ))}
          </div>
        </section>
      ))}

      {/* Pagos directos */}
      {pagos.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Pagos directos</p>
          <div className="space-y-2">
            {pagos.map(p => (
              <FilaPagoDirecto key={p.id} p={p} fetcher={fetcher} onRefresh={onRefresh} />
            ))}
          </div>
        </section>
      )}

      {/* ── Nuevo pago directo ── */}
      <div className="rounded-2xl border border-outline-variant overflow-hidden">
        <button onClick={() => setNuevoPagoAbierto(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-surface-high hover:bg-surface-highest transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-on-surface">Nuevo pago</span>
            <span className="text-[11px] text-on-surface-variant">· Transferencia, efectivo, etc.</span>
          </div>
          {nuevoPagoAbierto ? <ChevronUp className="w-4 h-4 text-on-surface-variant" /> : <ChevronDown className="w-4 h-4 text-on-surface-variant" />}
        </button>
        {nuevoPagoAbierto && (
          <div className="px-4 pb-4">
            <FormNuevoPago
              estudianteId={e.id}
              fetcher={fetcher}
              onSuccess={() => { setNuevoPagoAbierto(false); onRefresh() }}
            />
          </div>
        )}
      </div>

      {/* ── Sección Abonos ── */}
      {cuotasPendientes.length > 0 && (
        <div className="rounded-2xl border border-outline-variant overflow-hidden">
          <button onClick={() => setAbonoAbierto(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-surface-high hover:bg-surface-highest transition-colors cursor-pointer">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-on-surface">Registrar abono</span>
              <span className="text-[11px] text-on-surface-variant">· {cuotasPendientes.length} cuota{cuotasPendientes.length !== 1 ? 's' : ''} pendiente{cuotasPendientes.length !== 1 ? 's' : ''}</span>
            </div>
            {abonoAbierto ? <ChevronUp className="w-4 h-4 text-on-surface-variant" /> : <ChevronDown className="w-4 h-4 text-on-surface-variant" />}
          </button>
          {abonoAbierto && (
            <div className="px-4 pb-4">
              <FormAbono
                cuotasPendientes={cuotasPendientes}
                fetcher={fetcher}
                onSuccess={() => { setAbonoAbierto(false); onRefresh() }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// TAB: HISTORIAL
// ══════════════════════════════════════════════════════════════════════════
function TabHistorial({ estudianteId, fetcher }: {
  estudianteId: string
  fetcher: <T>(path: string, opts?: RequestInit) => Promise<T>
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['historial-estudiante', estudianteId],
    queryFn: () => fetcher<{ data: HistorialItem[] }>(`/estudiantes/${estudianteId}/historial`),
    staleTime: 30_000,
  })

  const registros = data?.data ?? []

  const ACCION_STYLE: Record<string, { color: string; bg: string; label: string }> = {
    UPDATE_PERFIL:         { color: 'text-primary',    bg: 'bg-primary/15',    label: 'Perfil' },
    ABONO:                 { color: 'text-[#16a34a]',  bg: 'bg-[#16a34a]/15', label: 'Abono' },
    EDITAR_CUOTA:          { color: 'text-[#d97706]',  bg: 'bg-[#d97706]/15', label: 'Edición' },
    REVERTIR_CUOTA:        { color: 'text-[#dc2626]',  bg: 'bg-[#dc2626]/15', label: 'Reversión' },
    CREAR_FINANCIAMIENTO:  { color: 'text-primary',    bg: 'bg-primary/15',    label: 'Financiamiento' },
    UPDATE_CUOTA:          { color: 'text-[#d97706]',  bg: 'bg-[#d97706]/15', label: 'Cuota' },
  }

  if (isLoading) return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-surface-high flex-shrink-0" />
          <div className="flex-1 space-y-1.5 pt-1">
            <div className="h-3 w-48 rounded bg-surface-high" />
            <div className="h-2.5 w-32 rounded bg-surface-high" />
          </div>
        </div>
      ))}
    </div>
  )

  if (registros.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
      <History className="w-10 h-10 mb-3 opacity-30" />
      <p className="text-sm">Sin actividad registrada aún</p>
      <p className="text-xs mt-1">Los cambios al perfil y abonos aparecerán aquí</p>
    </div>
  )

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-4">
        {registros.length} evento{registros.length !== 1 ? 's' : ''} registrado{registros.length !== 1 ? 's' : ''}
      </p>
      <div className="relative pl-5">
        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-outline-variant/40" />
        {registros.map((r, i) => {
          const style = ACCION_STYLE[r.accion] ?? { color: 'text-on-surface-variant', bg: 'bg-surface-high', label: r.accion }
          return (
            <div key={r.id} className="relative flex gap-3 pb-4">
              <div className={cn('absolute -left-5 mt-1 w-3.5 h-3.5 rounded-full border-2 border-surface-lowest flex-shrink-0', style.bg)} />
              <div className="flex-1 pl-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', style.bg, style.color)}>
                        {style.label}
                      </span>
                      <p className="text-[13px] font-medium text-on-surface">{r.descripcion}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[11px] text-on-surface-variant">{fmtFechaHora(r.createdAt)}</p>
                      <span className="text-on-surface-variant/30">·</span>
                      <p className="text-[11px] text-on-surface-variant">{r.realizadoPor}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// TAB OBSERVACIONES
// ══════════════════════════════════════════════════════════════════════════
function TabObservaciones({ estudianteId, fetcher, isAdmin }: {
  estudianteId: string
  fetcher: <T>(path: string, opts?: RequestInit) => Promise<T>
  isAdmin: boolean
}) {
  const queryClient = useQueryClient()
  const [texto, setTexto] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['observaciones', estudianteId],
    queryFn: () => fetcher<{ data: { id: string; texto: string; autor: string; createdAt: string }[] }>(`/estudiantes/${estudianteId}/observaciones`),
  })

  const crearMutation = useMutation({
    mutationFn: () => fetcher(`/estudiantes/${estudianteId}/observaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['observaciones', estudianteId] })
      setTexto('')
    },
    onError: (e: Error) => alert(e.message || 'Error al guardar la observación'),
  })

  const eliminarMutation = useMutation({
    mutationFn: (obsId: string) => fetcher(`/estudiantes/${estudianteId}/observaciones/${obsId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['observaciones', estudianteId] }),
    onError: (e: Error) => alert(e.message || 'Error al eliminar la observación'),
  })

  const obs = data?.data ?? []

  return (
    <div className="space-y-4">
      {/* Input nueva observación */}
      <div className="bg-surface-lowest border border-outline-variant rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Nueva observación</p>
        <textarea
          rows={3}
          placeholder="Escribe una observación sobre este estudiante..."
          value={texto}
          onChange={e => setTexto(e.target.value)}
          className="w-full bg-surface-high border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 resize-none"
        />
        <div className="flex justify-end">
          <button
            onClick={() => texto.trim() && crearMutation.mutate()}
            disabled={!texto.trim() || crearMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary/90 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {crearMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquarePlus className="w-4 h-4" />}
            Agregar
          </button>
        </div>
      </div>

      {/* Lista de observaciones */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-on-surface-variant" /></div>
      ) : obs.length === 0 ? (
        <div className="text-center py-10 text-on-surface-variant text-sm">
          <MessageSquarePlus className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Sin observaciones registradas
        </div>
      ) : (
        <div className="space-y-3">
          {obs.map(o => (
            <div key={o.id} className="bg-surface-lowest border border-outline-variant rounded-2xl p-4 group">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-on-surface leading-relaxed flex-1">{o.texto}</p>
                {isAdmin && (
                  <button
                    onClick={() => eliminarMutation.mutate(o.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-on-surface-variant hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-all cursor-pointer shrink-0"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] font-semibold text-primary">{o.autor}</span>
                <span className="text-[11px] text-on-surface-variant">
                  {new Date(o.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════
export default function EstudianteDetallePage() {
  const params  = useParams<{ id: string }>()
  const router  = useRouter()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<Tab>('perfil')
  const [confirmEliminar, setConfirmEliminar] = useState(false)

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getClientToken()
    return createClientFetcher(token ?? '')<T>(path, opts)
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['estudiante', params.id],
    queryFn: () => fetcher<{ data: EstudianteDetalle }>(`/estudiantes/${params.id}`),
    enabled: !!params.id,
    staleTime: 30_000,
  })

  const { data: colegiosData } = useQuery({ queryKey: ['colegios'], queryFn: () => fetcher<any>('/colegios') })
  const { data: asesoresData } = useQuery({ queryKey: ['asesores-select'], queryFn: () => fetcher<any>('/asesores?limit=100'), enabled: isAdmin })
  const { data: cursosData }   = useQuery({ queryKey: ['cursos-select'], queryFn: () => fetcher<any>('/cursos?limit=100') })

  const colegios: { id: string; nombre: string }[] = colegiosData?.data ?? []
  const asesores: { id: string; nombre: string }[] = asesoresData?.data ?? []
  const cursos:   { id: string; nombre: string; precio: number }[] = cursosData?.data ?? []

  const eliminarMutation = useMutation({
    mutationFn: () => fetcher(`/estudiantes/${params.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estudiantes'] })
      queryClient.invalidateQueries({ queryKey: ['saldos-pendientes'] })
      router.push('/estudiantes')
    },
    onError: (e: Error) => alert(e.message || 'Error al eliminar el estudiante'),
  })

  const handleRefresh = () => {
    refetch()
    queryClient.invalidateQueries({ queryKey: ['saldos-pendientes'] })
    queryClient.invalidateQueries({ queryKey: ['proximos-cobros'] })
    queryClient.invalidateQueries({ queryKey: ['reportes-dashboard'] })
  }

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  )

  const e = data?.data
  if (!e) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-on-surface-variant">
      <p className="text-sm">Estudiante no encontrado</p>
      <button onClick={() => router.push('/estudiantes')} className="mt-3 text-xs text-primary hover:underline cursor-pointer">Volver</button>
    </div>
  )

  const curso = e.cursos?.[0]?.curso
  const financiamientos = e.financiamientos ?? []
  const pagos = e.pagos ?? []

  // ── Cálculo de estado financiero real ──────────────────────────────────
  const cursoEst      = e.cursos?.[0]
  const precioBase    = cursoEst ? (cursoEst.precioAcordado ?? cursoEst.curso.precio) : 0
  const totalGeneral  = cursoEst
    ? precioBase
    : financiamientos.reduce((s, f) => s + f.montoTotal, 0) +
      pagos.filter(p => p.estado !== 'CANCELADO').reduce((s, p) => s + p.monto, 0)
  const pagadoFin     = financiamientos.flatMap(f => f.cuotas).filter(c => c.pagado).reduce((s, c) => s + c.monto, 0)
  const pagadoDir     = pagos.filter(p => p.estado === 'PAGADO').reduce((s, p) => s + p.monto, 0)
  const totalPagado   = pagadoFin + pagadoDir
  const saldoPend     = Math.max(0, totalGeneral - totalPagado)

  // Hay mora si alguna cuota sin pagar ya venció, o hay un pago VENCIDO
  const hasMora = financiamientos.flatMap(f => f.cuotas).some(c =>
    !c.pagado && isBefore(parseISO(c.fechaVencimiento), new Date()) && !isToday(parseISO(c.fechaVencimiento))
  ) || pagos.some(p => p.estado === 'VENCIDO')

  // Pendientes sin mora: cualquier cuota/pago sin pagar, o saldo del curso sin cubrir
  const cuotasPend = financiamientos.flatMap(f => f.cuotas.filter(c => !c.pagado)).length
  const pagosPend  = pagos.filter(p => p.estado === 'PENDIENTE' || p.estado === 'VENCIDO').length
  const totalPend  = cuotasPend + pagosPend

  // Estado final: "Al día" solo si el saldo está completamente cubierto
  const tieneSaldo     = saldoPend > 0   // hay deuda aunque sea sin fecha
  const estadoBadge    = hasMora          ? 'mora'
                       : tieneSaldo       ? 'pendiente'
                       : (totalGeneral > 0 || !!cursoEst) ? 'al-dia'
                       : 'sin-info'

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.push('/estudiantes')}
          className="mt-0.5 p-2 rounded-xl border border-outline-variant hover:bg-surface-high transition-colors cursor-pointer flex-shrink-0">
          <ArrowLeft className="w-4 h-4 text-on-surface-variant" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-on-surface truncate">{e.nombre}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {curso && (
                  <span className="flex items-center gap-1 text-xs text-on-surface-variant">
                    <BookOpen className="w-3 h-3" />{curso.nombre}
                  </span>
                )}
                {estadoBadge === 'mora' && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#dc2626]/12 text-[#dc2626]">
                    En mora
                  </span>
                )}
                {estadoBadge === 'pendiente' && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#d97706]/12 text-[#d97706]">
                    Pendiente
                  </span>
                )}
                {estadoBadge === 'al-dia' && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#16a34a]/12 text-[#16a34a]">
                    Al día
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isAdmin && (
                <button onClick={() => setConfirmEliminar(true)}
                  className="p-2 rounded-xl border border-[#dc2626]/30 text-[#dc2626] hover:bg-[#dc2626]/8 transition-colors cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 p-0.5 rounded-xl bg-surface-high border border-outline-variant/40">
        {TABS.map(t => {
          const Icon = t.icon
          const showBadge = t.key === 'financiero' && (estadoBadge === 'mora' || estadoBadge === 'pendiente')
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium transition-all duration-150 relative cursor-pointer',
                tab === t.key ? 'bg-surface-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface',
              )}>
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
              {showBadge && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#dc2626]" />}
            </button>
          )
        })}
      </div>

      {/* ── Contenido ── */}
      <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-5">
        {tab === 'perfil' && (
          <TabPerfil e={e} fetcher={fetcher} isAdmin={isAdmin} colegios={colegios} asesores={asesores} cursos={cursos} onRefresh={handleRefresh} />
        )}
        {tab === 'financiero' && (
          <TabFinanciero e={e} fetcher={fetcher} onRefresh={handleRefresh} cursos={cursos} isAdmin={isAdmin} />
        )}
        {tab === 'historial' && (
          <TabHistorial estudianteId={e.id} fetcher={fetcher} />
        )}
        {tab === 'observaciones' && (
          <TabObservaciones estudianteId={e.id} fetcher={fetcher} isAdmin={isAdmin} />
        )}
      </div>

      {/* Confirmar eliminar */}
      {confirmEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmEliminar(false)} />
          <div className="relative bg-surface-lowest border border-outline-variant rounded-xl shadow-float w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--error-container)' }}>
                <Trash2 className="w-5 h-5" style={{ color: 'var(--error)' }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface">¿Eliminar estudiante?</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Se eliminará <strong>{e.nombre}</strong> permanentemente.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmEliminar(false)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface cursor-pointer">Cancelar</button>
              <button onClick={() => eliminarMutation.mutate()} disabled={eliminarMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--error)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer">
                {eliminarMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
