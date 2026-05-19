'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth, useUser } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { formatCOP, formatDate, cn } from '@/lib/utils'
import {
  ArrowLeft, Pencil, Trash2, Loader2, User, BookOpen,
  Phone, Mail, MapPin, School, Users, CreditCard, History,
  Wallet, CheckCircle, AlertTriangle, Paperclip, ExternalLink,
  X, Save, Calendar, Plus,
} from 'lucide-react'
import { isBefore, parseISO, isToday } from 'date-fns'
import { DEPARTAMENTOS, getMunicipios } from '@/lib/colombia'

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Cuota {
  id: string; numero: number; monto: number
  fechaVencimiento: string; pagado: boolean
  fechaPago?: string; comprobante?: string
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

interface EstudianteDetalle {
  id: string; nombre: string
  tipoDocumento?: string; documento?: string
  email: string; telefono: string
  fechaNacimiento: string
  departamento?: string; ciudad?: string
  colegio?: { id: string; nombre: string }
  acudiente?: { nombre: string; email: string; telefono: string; relacion: string }
  asesor?: { id: string; nombre: string }
  cursos?: { id: string; cursoId: string; descuentoPorcentaje: number; curso: { id: string; nombre: string; precio: number } }[]
  pagos?: Pago[]
  financiamientos?: Financiamiento[]
  createdAt: string
}

// ── Helpers ────────────────────────────────────────────────────────────────
function esVencida(fechaVenc: string) {
  return isBefore(parseISO(fechaVenc), new Date()) && !isToday(parseISO(fechaVenc))
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })
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

type Tab = 'perfil' | 'financiero' | 'historial' | 'abonos'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'perfil',      label: 'Perfil',      icon: User      },
  { key: 'financiero',  label: 'Financiero',  icon: Wallet    },
  { key: 'historial',  label: 'Historial',   icon: History   },
  { key: 'abonos',     label: 'Abonos',      icon: CreditCard },
]

const inputCls = 'w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20'
const labelCls = 'block text-xs font-medium text-on-surface-variant mb-1'

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
  const descuentoValorInicial = cursoActivo
    ? String(Math.round(cursoActivo.curso.precio * cursoActivo.descuentoPorcentaje / 100)) : '0'

  const [form, setForm] = useState({
    nombre: e.nombre, tipoDocumento: e.tipoDocumento ?? 'CC',
    documento: e.documento ?? '', email: e.email, telefono: e.telefono,
    fechaNacimiento: e.fechaNacimiento?.split('T')[0] ?? '',
    departamento: e.departamento ?? '', ciudad: e.ciudad ?? '',
    colegioId: e.colegio?.id ?? '', asesorId: e.asesor?.id ?? '',
    cursoId: cursoActivo?.cursoId ?? '', descuentoValor: descuentoValorInicial,
    acudienteNombre: e.acudiente?.nombre ?? '', acudienteEmail: e.acudiente?.email ?? '',
    acudienteTelefono: e.acudiente?.telefono ?? '', acudienteRelacion: e.acudiente?.relacion ?? 'Padre',
  })

  const guardarMutation = useMutation({
    mutationFn: async () => {
      if (!form.nombre || !form.email || !form.telefono) throw new Error('Completa los campos obligatorios')
      const cursoPrecio = cursos.find(c => c.id === form.cursoId)?.precio ?? 0
      const descPct = cursoPrecio > 0 ? (Number(form.descuentoValor) / cursoPrecio) * 100 : 0
      return fetcher(`/estudiantes/${e.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre.trim(), tipoDocumento: form.tipoDocumento,
          documento: form.documento.trim() || null,
          email: form.email.trim(), telefono: form.telefono.trim(),
          fechaNacimiento: form.fechaNacimiento,
          departamento: form.departamento || null, ciudad: form.ciudad || null,
          colegioId: form.colegioId || null,
          ...(isAdmin && { asesorId: form.asesorId || null, cursoId: form.cursoId || null, descuentoPorcentaje: descPct }),
        }),
      })
    },
    onSuccess: () => { setEditando(false); setError(''); onRefresh() },
    onError: (err: any) => setError(err.message ?? 'Error al guardar'),
  })

  const f = (key: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [key]: v }))

  if (!editando) return (
    <div className="space-y-6">
      {/* Datos personales */}
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
            { icon: MapPin,     label: 'Ubicación',  value: [e.ciudad, e.departamento].filter(Boolean).join(', ') || '—' },
            { icon: School,     label: 'Colegio',    value: e.colegio?.nombre ?? '—' },
            { icon: Calendar,   label: 'Nacimiento', value: e.fechaNacimiento ? fmtFecha(e.fechaNacimiento) : '—' },
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

      {/* Curso */}
      {cursoActivo && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Curso adquirido</p>
          <div className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant bg-surface-lowest">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-on-surface">{cursoActivo.curso.nombre}</p>
              <p className="text-[11px] text-on-surface-variant">Precio: {formatCOP(cursoActivo.curso.precio)}</p>
            </div>
            {cursoActivo.descuentoPorcentaje > 0 && (
              <span className="flex-shrink-0 text-[11px] font-semibold px-2 py-1 rounded-lg bg-[#16a34a]/10 text-[#16a34a]">
                −{formatCOP(Math.round(cursoActivo.curso.precio * cursoActivo.descuentoPorcentaje / 100))}
              </span>
            )}
          </div>
        </section>
      )}

      {/* Acudiente */}
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

  // ── Modo edición ──
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Editando perfil</p>
        <button onClick={() => setEditando(false)} className="text-xs text-on-surface-variant hover:text-on-surface cursor-pointer">Cancelar</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
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
          <input type="date" className={inputCls} value={form.fechaNacimiento} onChange={e => f('fechaNacimiento')(e.target.value)} />
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
              <label className={labelCls}>Curso</label>
              <select className={inputCls} value={form.cursoId} onChange={e => { f('cursoId')(e.target.value); f('descuentoValor')('0') }}>
                <option value="">Sin curso</option>
                {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            {form.cursoId && (
              <div>
                <label className={labelCls}>Descuento en pesos</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">$</span>
                  <NumericInput value={form.descuentoValor} onChange={f('descuentoValor')} placeholder="0" className={cn(inputCls, 'pl-6')} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Acudiente */}
      <div>
        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-3">Acudiente</p>
        <div className="grid grid-cols-2 gap-3">
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
          <div className="col-span-2">
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
// TAB: FINANCIERO
// ══════════════════════════════════════════════════════════════════════════
function TabFinanciero({ e }: { e: EstudianteDetalle }) {
  const financiamientos = e.financiamientos ?? []
  const pagos = e.pagos ?? []
  const hoy = new Date()

  const totalFin = financiamientos.reduce((s, f) => s + f.montoTotal, 0)
  const pagadoFin = financiamientos.flatMap(f => f.cuotas).filter(c => c.pagado).reduce((s, c) => s + c.monto, 0)
  const pendienteFin = totalFin - pagadoFin

  const totalPagosDir = pagos.reduce((s, p) => s + p.monto, 0)
  const pagadoPagosDir = pagos.filter(p => p.estado === 'PAGADO').reduce((s, p) => s + p.monto, 0)
  const pendientePagosDir = pagos.filter(p => p.estado === 'PENDIENTE' || p.estado === 'VENCIDO').reduce((s, p) => s + p.monto, 0)

  const totalGeneral = totalFin + totalPagosDir
  const totalPagado = pagadoFin + pagadoPagosDir
  const totalPendiente = pendienteFin + pendientePagosDir
  const progreso = totalGeneral > 0 ? Math.min(100, (totalPagado / totalGeneral) * 100) : 0

  const totalMora = financiamientos.flatMap(f => f.cuotas).filter(c =>
    !c.pagado && isBefore(parseISO(c.fechaVencimiento), hoy) && !isToday(parseISO(c.fechaVencimiento))
  ).reduce((s, c) => s + c.monto, 0)
    + pagos.filter(p => p.estado === 'VENCIDO').reduce((s, p) => s + p.monto, 0)

  if (totalGeneral === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
      <Wallet className="w-10 h-10 mb-3 opacity-30" />
      <p className="text-sm">Sin información financiera registrada</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
        {[
          { label: 'Total', value: formatCOP(totalGeneral), color: 'text-on-surface' },
          { label: 'Pagado', value: formatCOP(totalPagado), color: 'text-[#16a34a]' },
          { label: 'Pendiente', value: formatCOP(totalPendiente), color: totalPendiente > 0 ? 'text-[#d97706]' : 'text-on-surface-variant' },
          { label: 'En mora', value: formatCOP(totalMora), color: totalMora > 0 ? 'text-[#dc2626]' : 'text-on-surface-variant' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface-high rounded-2xl p-3 text-center">
            <p className={cn('text-base font-bold tabular-nums', color)}>{value}</p>
            <p className="text-[10px] text-on-surface-variant mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Barra progreso */}
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

      {/* Financiamientos (cuotas) */}
      {financiamientos.map(fin => (
        <section key={fin.id} className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
              Financiamiento · {formatCOP(fin.montoTotal)}
            </p>
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
              fin.estado === 'COMPLETADO' ? 'bg-[#16a34a]/12 text-[#16a34a]' :
              fin.estado === 'CANCELADO' ? 'bg-[#dc2626]/12 text-[#dc2626]' :
              'bg-primary/10 text-primary')}>
              {fin.estado}
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
            {fin.cuotas.map(c => {
              const vencida = !c.pagado && esVencida(c.fechaVencimiento)
              return (
                <div key={c.id} className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl border',
                  c.pagado ? 'border-[#16a34a]/20 bg-[#16a34a]/4' :
                  vencida  ? 'border-[#dc2626]/25 bg-[#dc2626]/4' :
                             'border-outline-variant/50 bg-surface-high/40',
                )}>
                  <div className={cn('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                    c.pagado ? 'bg-[#16a34a]/15' : vencida ? 'bg-[#dc2626]/15' : 'bg-surface-high')}>
                    {c.pagado
                      ? <CheckCircle className="w-3.5 h-3.5 text-[#16a34a]" />
                      : vencida
                        ? <AlertTriangle className="w-3.5 h-3.5 text-[#dc2626]" />
                        : <span className="text-[10px] font-bold text-on-surface-variant">#{c.numero}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-on-surface">Cuota #{c.numero} · {formatCOP(c.monto)}</p>
                    <p className="text-[10px] text-on-surface-variant">
                      {c.pagado ? `Pagado ${c.fechaPago ? fmtFecha(c.fechaPago) : ''}` : `Vence ${fmtFecha(c.fechaVencimiento)}`}
                    </p>
                  </div>
                  {c.comprobante && (
                    <a href={c.comprobante} target="_blank" rel="noopener noreferrer"
                      className="flex-shrink-0 text-[10px] text-primary flex items-center gap-1 hover:underline">
                      <Paperclip className="w-3 h-3" />Ver
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {/* Pagos directos */}
      {pagos.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Pagos directos</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
            {pagos.map(p => {
              const pagado = p.estado === 'PAGADO'
              const vencido = p.estado === 'VENCIDO'
              return (
                <div key={p.id} className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl border',
                  pagado ? 'border-[#16a34a]/20 bg-[#16a34a]/4' :
                  vencido ? 'border-[#dc2626]/25 bg-[#dc2626]/4' :
                  'border-outline-variant/50 bg-surface-high/40',
                )}>
                  <div className={cn('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                    pagado ? 'bg-[#16a34a]/15' : vencido ? 'bg-[#dc2626]/15' : 'bg-surface-high')}>
                    {pagado ? <CheckCircle className="w-3.5 h-3.5 text-[#16a34a]" />
                            : vencido ? <AlertTriangle className="w-3.5 h-3.5 text-[#dc2626]" />
                            : <CreditCard className="w-3.5 h-3.5 text-on-surface-variant" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-on-surface">{formatCOP(p.monto)} · {p.metodo}</p>
                    <p className="text-[10px] text-on-surface-variant">
                      {pagado && p.fechaPago ? `Pagado ${fmtFecha(p.fechaPago)}` : `Vence ${fmtFecha(p.fechaVencimiento)}`}
                    </p>
                  </div>
                  {p.comprobante && (
                    <a href={p.comprobante} target="_blank" rel="noopener noreferrer"
                      className="flex-shrink-0 text-[10px] text-primary flex items-center gap-1 hover:underline">
                      <Paperclip className="w-3 h-3" />Ver
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// TAB: HISTORIAL
// ══════════════════════════════════════════════════════════════════════════
function TabHistorial({ e }: { e: EstudianteDetalle }) {
  // Construir línea de tiempo unificada
  type Evento = {
    fecha: string; tipo: 'cuota' | 'pago'; descripcion: string
    monto: number; estado: string; comprobante?: string
  }

  const eventos: Evento[] = [
    ...(e.financiamientos?.flatMap(f =>
      f.cuotas.filter(c => c.pagado).map(c => ({
        fecha: c.fechaPago ?? c.fechaVencimiento,
        tipo: 'cuota' as const,
        descripcion: `Cuota #${c.numero}`,
        monto: c.monto, estado: 'PAGADO',
        comprobante: c.comprobante,
      }))
    ) ?? []),
    ...(e.pagos?.filter(p => p.estado === 'PAGADO').map(p => ({
      fecha: p.fechaPago ?? p.createdAt,
      tipo: 'pago' as const,
      descripcion: `Pago directo · ${p.metodo}`,
      monto: p.monto, estado: 'PAGADO',
      comprobante: p.comprobante,
    })) ?? []),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

  if (eventos.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
      <History className="w-10 h-10 mb-3 opacity-30" />
      <p className="text-sm">Sin movimientos registrados aún</p>
    </div>
  )

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-3">
        {eventos.length} movimiento{eventos.length !== 1 ? 's' : ''} registrado{eventos.length !== 1 ? 's' : ''}
      </p>
      <div className="relative pl-5 space-y-0">
        {/* Línea vertical */}
        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-outline-variant/40" />
        {eventos.map((ev, i) => (
          <div key={i} className="relative flex gap-3 pb-4">
            {/* Dot */}
            <div className="absolute -left-5 mt-1.5 w-3.5 h-3.5 rounded-full bg-[#16a34a]/20 border-2 border-[#16a34a] flex-shrink-0" />
            <div className="flex-1 pl-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-semibold text-on-surface">{ev.descripcion}</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">{fmtFecha(ev.fecha)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[13px] font-bold text-[#16a34a] tabular-nums">{formatCOP(ev.monto)}</p>
                  {ev.comprobante && (
                    <a href={ev.comprobante} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-primary flex items-center justify-end gap-1 hover:underline mt-0.5">
                      <ExternalLink className="w-2.5 h-2.5" />Comprobante
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// TAB: ABONOS
// ══════════════════════════════════════════════════════════════════════════
function TabAbonos({ e, fetcher, onRefresh }: {
  e: EstudianteDetalle
  fetcher: <T>(path: string, opts?: RequestInit) => Promise<T>
  onRefresh: () => void
}) {
  const queryClient = useQueryClient()
  const { getToken } = useAuth()

  const financiamientos = e.financiamientos ?? []
  const cuotasPendientes = financiamientos.flatMap(f =>
    f.cuotas.filter(c => !c.pagado).map(c => ({ ...c, financiamientoId: f.id }))
  )
  const pagosPendientes = (e.pagos ?? []).filter(p => p.estado === 'PENDIENTE' || p.estado === 'VENCIDO')

  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [montoAbono, setMontoAbono] = useState('')
  const [fechaAbono, setFechaAbono] = useState(new Date().toISOString().split('T')[0])
  const [comprobante, setComprobante] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')

  const montoSeleccionado = cuotasPendientes
    .filter(c => seleccionadas.has(c.id))
    .reduce((s, c) => s + c.monto, 0)

  const toggleCuota = (id: string, monto: number) => {
    setSeleccionadas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      const suma = cuotasPendientes.filter(c => next.has(c.id)).reduce((s, c) => s + c.monto, 0)
      setMontoAbono(suma > 0 ? String(suma) : '')
      return next
    })
  }

  const subirComprobante = async (file: File) => {
    setSubiendo(true)
    try {
      const token = await getToken()
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/imagen`, {
        method: 'POST', headers: { Authorization: `Bearer ${token ?? ''}` }, body: fd,
      })
      const json = await res.json()
      if (!res.ok || !json?.data?.url) throw new Error(json?.error ?? 'Error al subir')
      setComprobante(json.data.url)
    } catch (err: any) {
      setError(err.message ?? 'Error al subir')
    } finally { setSubiendo(false) }
  }

  const abonoMutation = useMutation({
    mutationFn: async () => {
      if (seleccionadas.size === 0) throw new Error('Selecciona al menos una cuota')
      if (!montoAbono || Number(montoAbono) <= 0) throw new Error('Ingresa el monto del abono')
      if (!fechaAbono) throw new Error('Ingresa la fecha del abono')
      await Promise.all(
        Array.from(seleccionadas).map(cuotaId =>
          fetcher(`/cuotas/${cuotaId}`, {
            method: 'PATCH',
            body: JSON.stringify({ pagado: true, fechaPago: fechaAbono, ...(comprobante && { comprobante }) }),
          })
        )
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saldos-pendientes'] })
      setSeleccionadas(new Set()); setMontoAbono(''); setComprobante('')
      setFechaAbono(new Date().toISOString().split('T')[0]); setError('')
      onRefresh()
    },
    onError: (err: any) => setError(err.message ?? 'Error al registrar abono'),
  })

  const tienePendientes = cuotasPendientes.length > 0 || pagosPendientes.length > 0

  if (!tienePendientes) return (
    <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
      <CheckCircle className="w-10 h-10 mb-3 opacity-30 text-[#16a34a]" />
      <p className="text-sm font-medium">¡Todo pagado!</p>
      <p className="text-xs mt-1">No hay cuotas ni pagos pendientes</p>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Resumen rápido */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Total pendiente', value: formatCOP(cuotasPendientes.reduce((s,c) => s+c.monto,0) + pagosPendientes.reduce((s,p) => s+p.monto,0)), color: 'text-[#d97706]' },
          { label: 'Cuotas',  value: String(cuotasPendientes.length), color: 'text-on-surface' },
          { label: 'Seleccionado', value: formatCOP(montoSeleccionado), color: 'text-primary' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface-high rounded-xl p-2.5 text-center">
            <p className={cn('text-sm font-bold tabular-nums', color)}>{value}</p>
            <p className="text-[10px] text-on-surface-variant mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Lista de cuotas para seleccionar */}
      {cuotasPendientes.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">
            Cuotas pendientes · seleccioná las que vas a saldar
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
            {cuotasPendientes.map(c => {
              const vencida = esVencida(c.fechaVencimiento)
              const checked = seleccionadas.has(c.id)
              return (
                <button key={c.id} type="button" onClick={() => toggleCuota(c.id, c.monto)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all duration-150 cursor-pointer',
                    checked  ? 'border-primary bg-primary/8' :
                    vencida  ? 'border-[#dc2626]/30 bg-[#dc2626]/4 hover:border-[#dc2626]/50' :
                               'border-outline-variant/60 bg-surface-high hover:border-outline-variant',
                  )}>
                  <div className={cn('w-4.5 h-4.5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors',
                    checked ? 'bg-primary border-primary' : 'border-outline-variant bg-surface-lowest')}
                    style={{ width: 18, height: 18 }}>
                    {checked && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <span className={cn('text-[11px] font-bold flex-shrink-0 w-6 text-center',
                    checked ? 'text-primary' : vencida ? 'text-[#dc2626]' : 'text-on-surface-variant')}>
                    #{c.numero}
                  </span>
                  <span className="text-[13px] font-bold text-on-surface tabular-nums flex-1">{formatCOP(c.monto)}</span>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[11px] text-on-surface-variant">{fmtFecha(c.fechaVencimiento)}</p>
                    {vencida && <p className="text-[9px] font-bold text-[#dc2626] mt-0.5">VENCIDA</p>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Datos del abono */}
      <div className="space-y-3 pt-2 border-t border-outline-variant/40">
        <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">Datos del abono</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Monto recibido *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">$</span>
              <NumericInput value={montoAbono} onChange={setMontoAbono} placeholder="0" className={cn(inputCls, 'pl-6')} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Fecha del abono *</label>
            <input type="date" className={inputCls} value={fechaAbono} onChange={e => setFechaAbono(e.target.value)} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Comprobante (opcional)</label>
          <label className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-surface-high border border-outline-variant rounded-lg hover:bg-surface-high/80 transition-colors">
            <input type="file" accept="image/*,.pdf" className="hidden" disabled={subiendo}
              onChange={e => { const file = e.target.files?.[0]; if (file) subirComprobante(file); e.target.value = '' }} />
            {subiendo ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <Paperclip className="w-4 h-4 text-on-surface-variant" />}
            <span className="text-sm text-on-surface-variant">
              {subiendo ? 'Subiendo...' : comprobante ? 'Cambiar comprobante' : 'Adjuntar comprobante'}
            </span>
          </label>
          {comprobante && (
            <a href={comprobante} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
              <ExternalLink className="w-3 h-3" />Ver comprobante subido
            </a>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-[var(--error)] bg-[var(--error-container)]/40 border border-[var(--error)]/20 rounded-lg px-3 py-2">{error}</p>}

      <button onClick={() => abonoMutation.mutate()}
        disabled={abonoMutation.isPending || seleccionadas.size === 0 || !montoAbono || !fechaAbono}
        className="flex items-center gap-2 w-full justify-center py-3 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer">
        {abonoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        Registrar abono ({seleccionadas.size} cuota{seleccionadas.size !== 1 ? 's' : ''})
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════
export default function EstudianteDetallePage() {
  const params  = useParams<{ id: string }>()
  const router  = useRouter()
  const { getToken } = useAuth()
  const { user } = useUser()
  const isAdmin = user?.publicMetadata?.role === 'ADMIN'
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<Tab>('perfil')
  const [confirmEliminar, setConfirmEliminar] = useState(false)

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getToken()
    return createClientFetcher(token)<T>(path, opts)
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['estudiante', params.id],
    queryFn: () => fetcher<{ data: EstudianteDetalle }>(`/estudiantes/${params.id}`),
    enabled: !!params.id,
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
  })

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
  const cuotasPend = financiamientos.flatMap(f => f.cuotas.filter(c => !c.pagado)).length
  const pagosPend  = pagos.filter(p => p.estado === 'PENDIENTE' || p.estado === 'VENCIDO').length
  const totalPend  = cuotasPend + pagosPend
  const hasMora    = financiamientos.flatMap(f => f.cuotas).some(c =>
    !c.pagado && isBefore(parseISO(c.fechaVencimiento), new Date()) && !isToday(parseISO(c.fechaVencimiento))
  ) || pagos.some(p => p.estado === 'VENCIDO')

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
                {totalPend > 0 && (
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                    hasMora ? 'bg-[#dc2626]/12 text-[#dc2626]' : 'bg-[#d97706]/12 text-[#d97706]')}>
                    {totalPend} pendiente{totalPend !== 1 ? 's' : ''}
                  </span>
                )}
                {totalPend === 0 && financiamientos.length + pagos.length > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#16a34a]/12 text-[#16a34a]">Al día</span>
                )}
              </div>
            </div>

            {isAdmin && (
              <button onClick={() => setConfirmEliminar(true)}
                className="flex-shrink-0 p-2 rounded-xl border border-[#dc2626]/30 text-[#dc2626] hover:bg-[#dc2626]/8 transition-colors cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 p-0.5 rounded-xl bg-surface-high border border-outline-variant/40">
        {TABS.map(t => {
          const Icon = t.icon
          const showBadge = t.key === 'abonos' && totalPend > 0
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium transition-all duration-150 relative cursor-pointer',
                tab === t.key ? 'bg-surface-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface',
              )}>
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
              {showBadge && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#dc2626]" />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Contenido del tab ── */}
      <div className="rounded-2xl border border-outline-variant bg-surface-lowest p-5">
        {tab === 'perfil' && (
          <TabPerfil e={e} fetcher={fetcher} isAdmin={isAdmin} colegios={colegios} asesores={asesores} cursos={cursos} onRefresh={() => refetch()} />
        )}
        {tab === 'financiero' && <TabFinanciero e={e} />}
        {tab === 'historial' && <TabHistorial e={e} />}
        {tab === 'abonos' && <TabAbonos e={e} fetcher={fetcher} onRefresh={() => refetch()} />}
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
