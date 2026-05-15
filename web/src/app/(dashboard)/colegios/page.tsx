'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth, useUser } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate, cn } from '@/lib/utils'
import {
  School, Plus, X, Loader2, MapPin, Users,
  Handshake, User, Calendar, ChevronRight,
} from 'lucide-react'

// ── Interfaces ─────────────────────────────────────────────────────────────
interface Colegio {
  id: string
  nombre: string
  ciudad: string
  _count?: { estudiantes: number }
}

type Etapa =
  | 'PROSPECTO' | 'CONTACTO_INICIAL' | 'VISITA_PROGRAMADA'
  | 'PROPUESTA_ENVIADA' | 'EN_NEGOCIACION' | 'CONVENIO_FIRMADO' | 'DESCARTADO'

interface Negociacion {
  id: string
  etapa: Etapa
  notas?: string
  fechaContacto?: string
  fechaVisita?: string
  fechaProxContacto?: string
  updatedAt: string
  colegio: { id: string; nombre: string; ciudad: string }
  asesor:  { id: string; nombre: string }
}

// ── Config pipeline ────────────────────────────────────────────────────────
const ETAPAS: {
  etapa: Etapa
  label: string
  labelCorto: string
  color: string
  bg: string
  bgActive: string
  border: string
  dot: string
  textActive: string
}[] = [
  { etapa: 'PROSPECTO',         label: 'Prospecto',         labelCorto: 'Prospecto',   color: 'text-slate-500',   bg: 'bg-slate-100 dark:bg-slate-800/40',    bgActive: 'bg-slate-500',   border: 'border-slate-300 dark:border-slate-600',  dot: 'bg-slate-400',   textActive: 'text-white' },
  { etapa: 'CONTACTO_INICIAL',  label: 'Contacto inicial',  labelCorto: 'Contacto',    color: 'text-blue-500',    bg: 'bg-blue-50 dark:bg-blue-900/20',       bgActive: 'bg-blue-500',    border: 'border-blue-200 dark:border-blue-800',    dot: 'bg-blue-400',    textActive: 'text-white' },
  { etapa: 'VISITA_PROGRAMADA', label: 'Visita programada', labelCorto: 'Visita',      color: 'text-violet-500',  bg: 'bg-violet-50 dark:bg-violet-900/20',   bgActive: 'bg-violet-500',  border: 'border-violet-200 dark:border-violet-800',dot: 'bg-violet-400',  textActive: 'text-white' },
  { etapa: 'PROPUESTA_ENVIADA', label: 'Propuesta enviada', labelCorto: 'Propuesta',   color: 'text-amber-500',   bg: 'bg-amber-50 dark:bg-amber-900/20',     bgActive: 'bg-amber-500',   border: 'border-amber-200 dark:border-amber-800',  dot: 'bg-amber-400',   textActive: 'text-white' },
  { etapa: 'EN_NEGOCIACION',    label: 'En negociación',    labelCorto: 'Negociando',  color: 'text-orange-500',  bg: 'bg-orange-50 dark:bg-orange-900/20',   bgActive: 'bg-orange-500',  border: 'border-orange-200 dark:border-orange-800',dot: 'bg-orange-400',  textActive: 'text-white' },
  { etapa: 'CONVENIO_FIRMADO',  label: 'Convenio firmado',  labelCorto: 'Convenio',    color: 'text-green-500',   bg: 'bg-green-50 dark:bg-green-900/20',     bgActive: 'bg-green-500',   border: 'border-green-200 dark:border-green-800',  dot: 'bg-green-400',   textActive: 'text-white' },
  { etapa: 'DESCARTADO',        label: 'Descartado',        labelCorto: 'Descartado',  color: 'text-red-400',     bg: 'bg-red-50 dark:bg-red-900/20',         bgActive: 'bg-red-400',     border: 'border-red-200 dark:border-red-800',      dot: 'bg-red-400',     textActive: 'text-white' },
]

// ── Modal genérico ─────────────────────────────────────────────────────────
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

// ── Tarjeta de negociación ─────────────────────────────────────────────────
function NegCard({ neg, onClick }: { neg: Negociacion; onClick: () => void }) {
  const cfg = ETAPAS.find(e => e.etapa === neg.etapa)!
  return (
    <div
      onClick={onClick}
      className="bg-surface-lowest border border-outline-variant rounded-xl p-4 cursor-pointer hover:border-primary/30 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-[13px] font-semibold text-on-surface leading-snug">{neg.colegio.nombre}</p>
        <ChevronRight className="w-4 h-4 text-on-surface-variant opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
      </div>
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <MapPin className="w-3 h-3 flex-shrink-0" />{neg.colegio.ciudad}
        </div>
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <User className="w-3 h-3 flex-shrink-0" />{neg.asesor.nombre}
        </div>
        {neg.fechaProxContacto && (
          <div className="flex items-center gap-2 text-xs text-primary font-medium">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            Próx: {formatDate(neg.fechaProxContacto)}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className={cn('inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full', cfg.bg, cfg.color)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
          {cfg.labelCorto}
        </span>
        <span className="text-[10px] text-on-surface-variant">{formatDate(neg.updatedAt)}</span>
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function ColegiosPage() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const isAdmin = user?.publicMetadata?.role === 'ADMIN'
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<'colegios' | 'negociaciones'>('colegios')
  const [etapaActiva, setEtapaActiva] = useState<Etapa>('PROSPECTO')

  // Colegios state
  const [modalCrearColegio, setModalCrearColegio] = useState(false)
  const [formColegio, setFormColegio] = useState({ nombre: '', ciudad: '' })

  // Negociaciones state
  const [modalCrearNeg, setModalCrearNeg] = useState(false)
  const [modalEditarNeg, setModalEditarNeg] = useState<Negociacion | null>(null)
  const [formNeg, setFormNeg] = useState({
    colegioId: '', asesorId: '', etapa: 'PROSPECTO' as Etapa,
    notas: '', fechaContacto: '', fechaVisita: '', fechaProxContacto: '',
  })

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getToken()
    return createClientFetcher(token)<T>(path, opts)
  }

  // ── Queries ──
  const { data: colegiosData, isLoading: loadingColegios } = useQuery({
    queryKey: ['colegios'],
    queryFn: () => fetcher<any>('/colegios'),
  })
  const { data: negData, isLoading: loadingNeg } = useQuery({
    queryKey: ['negociaciones'],
    queryFn: () => fetcher<any>('/negociaciones'),
  })
  const { data: asesoresData } = useQuery({
    queryKey: ['asesores-select'],
    queryFn: () => fetcher<any>('/asesores?limit=100'),
  })

  // ── Mutations colegios ──
  const crearColegioMutation = useMutation({
    mutationFn: () => fetcher('/colegios', { method: 'POST', body: JSON.stringify(formColegio) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colegios'] })
      setModalCrearColegio(false)
      setFormColegio({ nombre: '', ciudad: '' })
    },
  })

  // ── Mutations negociaciones ──
  const resetFormNeg = () => setFormNeg({ colegioId: '', asesorId: '', etapa: 'PROSPECTO', notas: '', fechaContacto: '', fechaVisita: '', fechaProxContacto: '' })

  const crearNegMutation = useMutation({
    mutationFn: () => fetcher('/negociaciones', { method: 'POST', body: JSON.stringify(formNeg) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['negociaciones'] }); setModalCrearNeg(false); resetFormNeg() },
    onError: (e: any) => alert(e?.message ?? 'Error al crear'),
  })

  const actualizarNegMutation = useMutation({
    mutationFn: (data: Partial<typeof formNeg>) =>
      fetcher(`/negociaciones/${modalEditarNeg?.id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['negociaciones'] }); setModalEditarNeg(null) },
    onError: (e: any) => alert(e?.message ?? 'Error al actualizar'),
  })

  const eliminarNegMutation = useMutation({
    mutationFn: (id: string) => fetcher(`/negociaciones/${id}`, { method: 'DELETE' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['negociaciones'] }); setModalEditarNeg(null) },
  })

  const abrirEditarNeg = (neg: Negociacion) => {
    setFormNeg({
      colegioId: neg.colegio.id, asesorId: neg.asesor.id, etapa: neg.etapa,
      notas: neg.notas ?? '',
      fechaContacto:     neg.fechaContacto     ? neg.fechaContacto.split('T')[0]     : '',
      fechaVisita:       neg.fechaVisita        ? neg.fechaVisita.split('T')[0]        : '',
      fechaProxContacto: neg.fechaProxContacto  ? neg.fechaProxContacto.split('T')[0]  : '',
    })
    setModalEditarNeg(neg)
  }

  const colegios: Colegio[]      = colegiosData?.data ?? []
  const negociaciones: Negociacion[] = negData?.data ?? []
  const asesores                 = asesoresData?.data ?? []
  const tarjetasActivas          = negociaciones.filter(n => n.etapa === etapaActiva)
  const cfgActiva                = ETAPAS.find(e => e.etapa === etapaActiva)!

  const inputCls = 'w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20'
  const labelCls = 'block text-xs font-medium text-on-surface-variant mb-1'

  const NegFormFields = ({ value: f, onChange }: { value: typeof formNeg; onChange: (f: typeof formNeg) => void }) => (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Colegio *</label>
        <select className={inputCls} value={f.colegioId} onChange={e => onChange({ ...f, colegioId: e.target.value })}>
          <option value="">Seleccionar colegio…</option>
          {colegios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Asesor asignado *</label>
        <select className={inputCls} value={f.asesorId} onChange={e => onChange({ ...f, asesorId: e.target.value })}>
          <option value="">Seleccionar asesor…</option>
          {asesores.map((a: any) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Etapa</label>
        <select className={inputCls} value={f.etapa} onChange={e => onChange({ ...f, etapa: e.target.value as Etapa })}>
          {ETAPAS.map(c => <option key={c.etapa} value={c.etapa}>{c.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Fecha contacto</label>
          <input type="date" className={inputCls} value={f.fechaContacto} onChange={e => onChange({ ...f, fechaContacto: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Fecha visita</label>
          <input type="date" className={inputCls} value={f.fechaVisita} onChange={e => onChange({ ...f, fechaVisita: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Próximo contacto</label>
        <input type="date" className={inputCls} value={f.fechaProxContacto} onChange={e => onChange({ ...f, fechaProxContacto: e.target.value })} />
      </div>
      <div>
        <label className={labelCls}>Notas</label>
        <textarea className={inputCls} rows={3} value={f.notas} onChange={e => onChange({ ...f, notas: e.target.value })} placeholder="Observaciones del proceso…" />
      </div>
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Colegios"
        subtitle="Gestiona colegios y el pipeline de negociaciones"
        actions={
          tab === 'colegios' ? (
            <button onClick={() => setModalCrearColegio(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Nuevo colegio
            </button>
          ) : isAdmin ? (
            <button onClick={() => { resetFormNeg(); setModalCrearNeg(true) }} className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Nueva negociación
            </button>
          ) : undefined
        }
      />

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-surface-high border border-outline-variant rounded-xl p-1 w-fit">
        {([
          { id: 'colegios',      label: 'Colegios',      icon: School,    count: colegios.length },
          { id: 'negociaciones', label: 'Negociaciones', icon: Handshake, count: negociaciones.length },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-surface-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            <span className={cn(
              'text-[11px] px-1.5 py-0.5 rounded-full font-semibold',
              tab === t.id ? 'bg-primary/10 text-primary' : 'bg-outline-variant/50 text-on-surface-variant',
            )}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════
          TAB: COLEGIOS
      ══════════════════════════════════════════ */}
      {tab === 'colegios' && (
        loadingColegios ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
        ) : colegios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant bg-surface-lowest border border-outline-variant rounded-xl">
            <School className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No hay colegios registrados</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {colegios.map(c => (
              <div key={c.id} className="bg-surface-lowest border border-outline-variant rounded-xl p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <School className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{c.nombre}</p>
                    <p className="flex items-center gap-1 text-xs text-on-surface-variant">
                      <MapPin className="w-3 h-3" />{c.ciudad}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                  <Users className="w-3.5 h-3.5" />
                  <span>{c._count?.estudiantes ?? 0} estudiantes</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ══════════════════════════════════════════
          TAB: NEGOCIACIONES — Pipeline
      ══════════════════════════════════════════ */}
      {tab === 'negociaciones' && (
        loadingNeg ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
        ) : (
          <div className="space-y-5">

            {/* ── Selector móvil ── */}
            <div className="md:hidden">
              <select
                value={etapaActiva}
                onChange={e => setEtapaActiva(e.target.value as Etapa)}
                className="w-full bg-surface-lowest border border-outline-variant rounded-xl px-4 py-3 text-sm font-medium text-on-surface focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              >
                {ETAPAS.map(cfg => {
                  const count = negociaciones.filter(n => n.etapa === cfg.etapa).length
                  return (
                    <option key={cfg.etapa} value={cfg.etapa}>
                      {cfg.label}{count > 0 ? ` (${count})` : ''}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* ── Barra de pipeline — solo desktop ── */}
            <div className="hidden md:block bg-surface-lowest border border-outline-variant rounded-xl p-4">
              <div className="flex items-center w-full gap-0">
                {ETAPAS.map((cfg, i) => {
                  const count  = negociaciones.filter(n => n.etapa === cfg.etapa).length
                  const activo = etapaActiva === cfg.etapa
                  const isLast = i === ETAPAS.length - 1

                  return (
                    <div key={cfg.etapa} className="flex items-center flex-1 min-w-0">
                      {/* Paso */}
                      <button
                        onClick={() => setEtapaActiva(cfg.etapa)}
                        className={cn(
                          'flex flex-col items-center gap-1 flex-1 py-2.5 px-1 rounded-xl transition-all duration-200 min-w-0',
                          activo ? `${cfg.bgActive} shadow-sm` : 'hover:bg-surface-high',
                        )}
                      >
                        {/* Número / dot */}
                        <div className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                          activo
                            ? 'bg-white/20 text-white'
                            : count > 0
                              ? `${cfg.bg} ${cfg.color} border ${cfg.border}`
                              : 'bg-surface-high text-on-surface-variant border border-outline-variant',
                        )}>
                          {count > 0 ? count : <span className="w-2 h-2 rounded-full bg-current opacity-30 block" />}
                        </div>

                        {/* Label */}
                        <span className={cn(
                          'text-[10px] font-semibold leading-tight text-center truncate w-full px-1 transition-colors',
                          activo ? 'text-white' : count > 0 ? cfg.color : 'text-on-surface-variant',
                        )}>
                          {cfg.labelCorto}
                        </span>
                      </button>

                      {/* Conector */}
                      {!isLast && (
                        <div className={cn(
                          'h-px w-3 flex-shrink-0 transition-colors',
                          negociaciones.some(n => ETAPAS.indexOf(ETAPAS.find(e => e.etapa === n.etapa)!) > i)
                            ? 'bg-primary/40'
                            : 'bg-outline-variant',
                        )} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Encabezado de etapa activa ── */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={cn('w-3 h-3 rounded-full', cfgActiva.dot)} />
                <h3 className={cn('text-sm font-semibold', cfgActiva.color)}>{cfgActiva.label}</h3>
                <span className="text-xs text-on-surface-variant">
                  — {tarjetasActivas.length} negociación{tarjetasActivas.length !== 1 ? 'es' : ''}
                </span>
              </div>
            </div>

            {/* ── Grid de tarjetas ── */}
            {tarjetasActivas.length === 0 ? (
              <div className={cn('flex flex-col items-center justify-center py-14 rounded-xl border border-dashed', cfgActiva.bg, cfgActiva.border)}>
                <span className={cn('text-3xl mb-2 opacity-30', cfgActiva.dot.replace('bg-', 'text-'))}>◉</span>
                <p className="text-sm text-on-surface-variant">Sin negociaciones en esta etapa</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {tarjetasActivas.map(neg => (
                  <NegCard key={neg.id} neg={neg} onClick={() => abrirEditarNeg(neg)} />
                ))}
              </div>
            )}
          </div>
        )
      )}

      {/* ── Modal crear colegio ── */}
      <Modal open={modalCrearColegio} onClose={() => setModalCrearColegio(false)}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-on-surface">Nuevo colegio</h2>
            <button onClick={() => setModalCrearColegio(false)} className="p-1.5 text-on-surface-variant hover:text-on-surface"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Nombre del colegio *</label>
              <input className={inputCls} value={formColegio.nombre} onChange={e => setFormColegio(f => ({ ...f, nombre: e.target.value }))} placeholder="Colegio La Salle" />
            </div>
            <div>
              <label className={labelCls}>Ciudad *</label>
              <input className={inputCls} value={formColegio.ciudad} onChange={e => setFormColegio(f => ({ ...f, ciudad: e.target.value }))} placeholder="Bogotá" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setModalCrearColegio(false)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface">Cancelar</button>
            <button
              onClick={() => crearColegioMutation.mutate()}
              disabled={crearColegioMutation.isPending || !formColegio.nombre || !formColegio.ciudad}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {crearColegioMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Crear
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal crear negociación ── */}
      <Modal open={modalCrearNeg} onClose={() => setModalCrearNeg(false)}>
        <div className="p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-on-surface">Nueva negociación</h2>
            <button onClick={() => setModalCrearNeg(false)} className="p-1.5 text-on-surface-variant hover:text-on-surface"><X className="w-4 h-4" /></button>
          </div>
          <NegFormFields value={formNeg} onChange={setFormNeg} />
          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => setModalCrearNeg(false)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface">Cancelar</button>
            <button
              onClick={() => crearNegMutation.mutate()}
              disabled={crearNegMutation.isPending || !formNeg.colegioId || !formNeg.asesorId}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {crearNegMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Crear
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal editar negociación ── */}
      <Modal open={!!modalEditarNeg} onClose={() => setModalEditarNeg(null)}>
        <div className="p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-on-surface">Actualizar negociación</h2>
            <button onClick={() => setModalEditarNeg(null)} className="p-1.5 text-on-surface-variant hover:text-on-surface"><X className="w-4 h-4" /></button>
          </div>
          <NegFormFields value={formNeg} onChange={setFormNeg} />
          <div className="flex items-center justify-between mt-5">
            {isAdmin && (
              <button
                onClick={() => { if (confirm('¿Eliminar esta negociación?')) eliminarNegMutation.mutate(modalEditarNeg!.id) }}
                className="px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Eliminar
              </button>
            )}
            <div className="flex gap-3 ml-auto">
              <button onClick={() => setModalEditarNeg(null)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface">Cancelar</button>
              <button
                onClick={() => actualizarNegMutation.mutate(formNeg)}
                disabled={actualizarNegMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {actualizarNegMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
