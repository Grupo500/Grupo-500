'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, getClientToken } from '@/lib/api'
import {
  Plus, X, Trash2, Copy, ExternalLink, Eye, EyeOff,
  Loader2, Check, Upload, ChevronDown, ChevronUp,
  FileText, Settings, Globe, Link2, Type, Mail, Phone,
  Calendar, List, CheckSquare, Paperclip, Minus, Hash,
  AlignLeft, LayoutTemplate, Pencil, Save, ArrowLeft,
} from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────────────
type TipoCampo = 'texto' | 'textarea' | 'email' | 'telefono' | 'fecha' | 'select' | 'checkbox' | 'archivo' | 'seccion' | 'numero'

interface Campo {
  id: string
  tipo: TipoCampo
  label: string
  placeholder?: string
  descripcion?: string
  requerido: boolean
  opciones?: string[]
}

interface Formulario {
  id: string
  nombre: string
  descripcion?: string
  campos: Campo[]
  activo: boolean
  visibleEnLanding: boolean
  cursoId?: string | null
  createdAt: string
  respuestas?: number
}

// ── Config tipos de campo ─────────────────────────────────────────────────────
const TIPOS: { tipo: TipoCampo; label: string; icon: React.ElementType; color: string }[] = [
  { tipo: 'texto',    label: 'Texto corto',   icon: Type,        color: 'bg-blue-100 text-blue-600' },
  { tipo: 'textarea', label: 'Texto largo',   icon: AlignLeft,   color: 'bg-indigo-100 text-indigo-600' },
  { tipo: 'email',    label: 'Email',         icon: Mail,        color: 'bg-violet-100 text-violet-600' },
  { tipo: 'telefono', label: 'Teléfono',      icon: Phone,       color: 'bg-purple-100 text-purple-600' },
  { tipo: 'fecha',    label: 'Fecha',         icon: Calendar,    color: 'bg-rose-100 text-rose-600' },
  { tipo: 'numero',   label: 'Número',        icon: Hash,        color: 'bg-orange-100 text-orange-600' },
  { tipo: 'select',   label: 'Selección',     icon: List,        color: 'bg-amber-100 text-amber-600' },
  { tipo: 'checkbox', label: 'Casilla',       icon: CheckSquare, color: 'bg-emerald-100 text-emerald-600' },
  { tipo: 'archivo',  label: 'Archivo',       icon: Paperclip,   color: 'bg-teal-100 text-teal-600' },
  { tipo: 'seccion',  label: 'Sección',       icon: Minus,       color: 'bg-slate-100 text-slate-600' },
]
const getTipoConfig = (tipo: TipoCampo) => TIPOS.find(t => t.tipo === tipo) ?? TIPOS[0]
const uid = () => Math.random().toString(36).slice(2, 10)

const inputCls = 'w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all duration-150'
const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1'

// ── Toast ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [msg, setMsg] = useState('')
  const show = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }, [])
  return { msg, show }
}

// ── CampoEditor ───────────────────────────────────────────────────────────────
function CampoEditor({ campo, index, total, onChange, onDelete, onMoveUp, onMoveDown }: {
  campo: Campo; index: number; total: number
  onChange: (c: Campo) => void; onDelete: () => void
  onMoveUp: () => void; onMoveDown: () => void
}) {
  const [open, setOpen] = useState(false)
  const [opcionInput, setOpcionInput] = useState('')
  const cfg = getTipoConfig(campo.tipo)
  const Icon = cfg.icon

  return (
    <div className={`group relative bg-surface-lowest border rounded-xl overflow-hidden
      transition-all duration-200 ease-out
      ${open ? 'border-primary/40 shadow-lg shadow-primary/5' : 'border-outline-variant hover:border-outline hover:shadow-sm'}`}
      style={{ animation: 'slideIn 0.2s cubic-bezier(0.23,1,0.32,1) both' }}>
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${cfg.color.split(' ')[0]}`} />
      <div className="flex items-center gap-3 px-4 py-3 pl-5">
        <div className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${cfg.color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-on-surface truncate">{campo.label || 'Sin nombre'}</p>
          <p className="text-xs text-on-surface-variant">{cfg.label}{campo.requerido ? ' · Requerido' : ' · Opcional'}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button onClick={onMoveUp} disabled={index === 0}
            className="p-1.5 rounded-lg hover:bg-surface-high disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-all active:scale-[0.97]">
            <ChevronUp className="w-3.5 h-3.5 text-on-surface-variant" />
          </button>
          <button onClick={onMoveDown} disabled={index === total - 1}
            className="p-1.5 rounded-lg hover:bg-surface-high disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-all active:scale-[0.97]">
            <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant" />
          </button>
          <button onClick={() => setOpen(o => !o)}
            className="p-1.5 rounded-lg hover:bg-surface-high cursor-pointer transition-all active:scale-[0.97]">
            <Settings className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-90 text-primary' : 'text-on-surface-variant'}`} />
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer transition-all active:scale-[0.97] group/del">
            <Trash2 className="w-3.5 h-3.5 text-on-surface-variant group-hover/del:text-red-500 transition-colors" />
          </button>
        </div>
      </div>
      {open && (
        <div className="px-5 pb-4 pt-2 border-t border-outline-variant space-y-3 bg-surface-high/30"
          style={{ animation: 'fadeDown 0.15s ease-out both' }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Etiqueta *</label>
              <input className={inputCls} value={campo.label}
                onChange={e => onChange({ ...campo, label: e.target.value })} placeholder="Ej: Nombre completo" />
            </div>
            <div>
              <label className={labelCls}>Placeholder</label>
              <input className={inputCls} value={campo.placeholder ?? ''}
                onChange={e => onChange({ ...campo, placeholder: e.target.value })} placeholder="Texto de ayuda..." />
            </div>
          </div>
          <div>
            <label className={labelCls}>Descripción</label>
            <input className={inputCls} value={campo.descripcion ?? ''}
              onChange={e => onChange({ ...campo, descripcion: e.target.value })} placeholder="Instrucción adicional..." />
          </div>
          <div className="flex items-center justify-between py-1">
            <span className={labelCls + ' mb-0'}>Requerido</span>
            <button onClick={() => onChange({ ...campo, requerido: !campo.requerido })}
              className={`relative w-10 h-5 rounded-full transition-all duration-200 cursor-pointer focus:outline-none
                ${campo.requerido ? 'bg-primary' : 'bg-outline-variant'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200
                ${campo.requerido ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {campo.tipo === 'select' && (
            <div>
              <label className={labelCls}>Opciones</label>
              <div className="space-y-1.5 mb-2">
                {(campo.opciones ?? []).map((op, i) => (
                  <div key={i} className="flex items-center gap-2" style={{ animation: 'slideIn 0.15s ease-out both' }}>
                    <div className="flex-1 px-3 py-1.5 bg-surface-high rounded-lg text-sm text-on-surface border border-outline-variant">{op}</div>
                    <button onClick={() => onChange({ ...campo, opciones: (campo.opciones ?? []).filter((_, j) => j !== i) })}
                      className="p-1 rounded-lg hover:bg-red-50 cursor-pointer transition-colors active:scale-[0.97]">
                      <X className="w-3.5 h-3.5 text-on-surface-variant hover:text-red-500 transition-colors" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input className={`${inputCls} flex-1`} value={opcionInput}
                  onChange={e => setOpcionInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && opcionInput.trim()) {
                      onChange({ ...campo, opciones: [...(campo.opciones ?? []), opcionInput.trim()] })
                      setOpcionInput('')
                    }
                  }}
                  placeholder="Nueva opción... (Enter para agregar)" />
                <button onClick={() => {
                  if (opcionInput.trim()) {
                    onChange({ ...campo, opciones: [...(campo.opciones ?? []), opcionInput.trim()] })
                    setOpcionInput('')
                  }
                }} className="px-3 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity active:scale-[0.97]">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Form Builder Panel ────────────────────────────────────────────────────────
function FormBuilder({ inicial, onSave, onClose }: {
  inicial?: Formulario | null
  onSave: (d: { nombre: string; descripcion: string; campos: Campo[] }) => Promise<void>
  onClose: () => void
}) {
  const [nombre,      setNombre]      = useState(inicial?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? '')
  const [campos,      setCampos]      = useState<Campo[]>((inicial?.campos as Campo[]) ?? [])
  const [saving,      setSaving]      = useState(false)

  // Sincronizar cuando se abre el editor con un formulario diferente
  useEffect(() => {
    setNombre(inicial?.nombre ?? '')
    setDescripcion(inicial?.descripcion ?? '')
    setCampos((inicial?.campos as Campo[]) ?? [])
  }, [inicial?.id])

  function agregar(tipo: TipoCampo) {
    setCampos(p => [...p, { id: uid(), tipo, label: getTipoConfig(tipo).label, requerido: false, ...(tipo === 'select' ? { opciones: [] } : {}) }])
  }
  function actualizar(id: string, c: Campo) { setCampos(p => p.map(x => x.id === id ? c : x)) }
  function eliminar(id: string)             { setCampos(p => p.filter(x => x.id !== id)) }
  function moverArriba(i: number) {
    setCampos(p => { const a = [...p]; if (i > 0) [a[i-1], a[i]] = [a[i], a[i-1]]; return a })
  }
  function moverAbajo(i: number) {
    setCampos(p => { const a = [...p]; if (i < a.length-1) [a[i], a[i+1]] = [a[i+1], a[i]]; return a })
  }
  async function handleSave() {
    if (!nombre.trim()) return
    setSaving(true)
    try { await onSave({ nombre: nombre.trim(), descripcion: descripcion.trim(), campos }) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex" style={{ animation: 'fadeIn 0.15s ease-out both' }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-4xl bg-surface-lowest shadow-2xl flex flex-col"
        style={{ animation: 'slideInRight 0.25s cubic-bezier(0.23,1,0.32,1) both' }}>

        {/* Header builder */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-outline-variant shrink-0
          bg-gradient-to-r from-surface-lowest to-surface-high/20">
          <button onClick={onClose}
            className="p-2 rounded-xl hover:bg-surface-high cursor-pointer transition-all active:scale-[0.97]">
            <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
          </button>
          <div className="flex-1 min-w-0">
            <input value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Nombre del formulario..."
              className="w-full bg-transparent font-bold text-lg text-on-surface focus:outline-none placeholder-on-surface-variant/40" />
            <input value={descripcion} onChange={e => setDescripcion(e.target.value)}
              placeholder="Descripción opcional..."
              className="w-full bg-transparent text-sm text-on-surface-variant focus:outline-none placeholder-on-surface-variant/30 mt-0.5" />
          </div>
          <button onClick={handleSave} disabled={saving || !nombre.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary
              text-sm font-bold cursor-pointer hover:opacity-90 disabled:opacity-40
              disabled:cursor-not-allowed transition-all active:scale-[0.97] shadow-lg shadow-primary/25">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {inicial ? 'Guardar' : 'Crear formulario'}
          </button>
        </div>

        {/* Body: paleta + canvas */}
        <div className="flex flex-1 overflow-hidden">
          {/* Paleta */}
          <div className="w-60 shrink-0 border-r border-outline-variant bg-surface-high/30 p-4 overflow-y-auto">
            <p className={labelCls + ' mb-3 px-1'}>Tipos de campo</p>
            <div className="space-y-1">
              {TIPOS.map(({ tipo, label, icon: Icon, color }) => (
                <button key={tipo} onClick={() => agregar(tipo)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer
                    hover:bg-surface-lowest transition-all duration-150 active:scale-[0.97] group text-left
                    border border-transparent hover:border-outline-variant hover:shadow-sm">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color}
                    group-hover:scale-110 transition-transform duration-150`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-medium text-on-surface">{label}</span>
                  <Plus className="w-3 h-3 text-on-surface-variant ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
            <div className="mt-5 p-3 rounded-xl bg-primary/5 border border-primary/10">
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Clic para agregar. Usa las flechas para reordenar campos.
              </p>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-y-auto p-5">
            {campos.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center"
                style={{ animation: 'fadeIn 0.3s ease-out both' }}>
                <div className="w-16 h-16 rounded-2xl bg-surface-high flex items-center justify-center mb-4">
                  <LayoutTemplate className="w-8 h-8 text-on-surface-variant/30" />
                </div>
                <p className="font-semibold text-on-surface-variant text-sm">Formulario vacío</p>
                <p className="text-xs text-on-surface-variant/60 mt-1">
                  Selecciona un tipo de campo para comenzar
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-w-2xl">
                <div className="flex items-center justify-between mb-4">
                  <p className={labelCls + ' mb-0'}>{campos.length} campo{campos.length !== 1 ? 's' : ''}</p>
                  <button onClick={() => setCampos([])}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors cursor-pointer">
                    Limpiar todo
                  </button>
                </div>
                {campos.map((c, i) => (
                  <CampoEditor key={c.id} campo={c} index={i} total={campos.length}
                    onChange={nc => actualizar(c.id, nc)}
                    onDelete={() => eliminar(c.id)}
                    onMoveUp={() => moverArriba(i)}
                    onMoveDown={() => moverAbajo(i)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Card de formulario ────────────────────────────────────────────────────────
function FormCard({ form, index, onEdit, onDelete, onToggleActivo, onToggleLanding, onCopyLink, toggling }: {
  form: Formulario; index: number; toggling: boolean
  onEdit: () => void; onDelete: () => void; onCopyLink: () => void
  onToggleActivo: () => void; onToggleLanding: () => void
}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://grupo-500.vercel.app'

  return (
    <div className="group relative bg-surface-lowest border border-outline-variant rounded-2xl overflow-hidden
      hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-200 ease-out"
      style={{ animation: `slideInUp 0.3s cubic-bezier(0.23,1,0.32,1) ${index * 60}ms both` }}>
      {/* Barra top degradado */}
      <div className={`h-1 w-full transition-all duration-300 ${
        form.activo
          ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400'
          : 'bg-gradient-to-r from-slate-200 to-slate-300'
      }`} />

      <div className="p-5">
        {/* Estado + nombre */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider
              px-2 py-0.5 rounded-full transition-all duration-200 ${
              form.activo
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${form.activo ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {form.activo ? 'Activo' : 'Inactivo'}
            </span>
            {form.visibleEnLanding && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider
                px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                <Globe className="w-2.5 h-2.5" />Landing
              </span>
            )}
          </div>
          <h3 className="font-bold text-on-surface truncate">{form.nombre}</h3>
          {form.descripcion && (
            <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-1">{form.descripcion}</p>
          )}
        </div>

        {/* Stats — una sola línea */}
        <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-4 flex-wrap">
          <span className="flex items-center gap-1 shrink-0">
            <LayoutTemplate className="w-3 h-3" />
            {form.campos.length} campos
          </span>
          <span className="text-outline-variant">·</span>
          <span className="flex items-center gap-1 shrink-0">
            <Calendar className="w-3 h-3" />
            {new Date(form.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
          </span>
          <span className="text-outline-variant">·</span>
          <span className={`flex items-center gap-1 shrink-0 font-semibold px-1.5 py-0.5 rounded-full text-[11px]
            ${(form.respuestas ?? 0) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-high text-on-surface-variant'}`}>
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {form.respuestas ?? 0} resp.
          </span>
        </div>

        {/* Link copiable */}
        <button onClick={onCopyLink}
          className="w-full flex items-center gap-2 p-2.5 bg-surface-high rounded-xl mb-4
            hover:bg-surface-high/80 cursor-pointer transition-all active:scale-[0.99] group/link">
          <Link2 className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
          <span className="text-xs text-on-surface-variant truncate flex-1 font-mono text-left">
            /inscripcion/f/{form.id.slice(0, 10)}…
          </span>
          <Copy className="w-3.5 h-3.5 text-on-surface-variant group-hover/link:text-primary transition-colors shrink-0" />
        </button>

        {/* Acciones */}
        <div className="flex items-center gap-2">
          <button onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-outline-variant
              text-xs font-semibold text-on-surface hover:bg-surface-high cursor-pointer transition-all active:scale-[0.97]">
            <Pencil className="w-3.5 h-3.5" />Editar
          </button>
          <button onClick={onToggleActivo} disabled={toggling}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
              text-xs font-semibold cursor-pointer transition-all active:scale-[0.97] disabled:opacity-50 ${
              form.activo
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                : 'bg-surface-high text-on-surface-variant border border-outline-variant hover:bg-surface-high'
            }`}>
            {toggling
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : form.activo ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />
            }
            {form.activo ? 'Activo' : 'Activar'}
          </button>
          <button onClick={onToggleLanding}
            title={form.visibleEnLanding ? 'Ocultar de landing' : 'Mostrar en landing'}
            className={`p-2 rounded-xl border cursor-pointer transition-all active:scale-[0.97] ${
              form.visibleEnLanding
                ? 'bg-primary/10 border-primary/20 text-primary'
                : 'border-outline-variant text-on-surface-variant hover:bg-surface-high'
            }`}>
            <Globe className="w-4 h-4" />
          </button>
          <a href={`${origin}/inscripcion/f/${form.id}`} target="_blank" rel="noopener noreferrer"
            className="p-2 rounded-xl border border-outline-variant text-on-surface-variant
              hover:bg-surface-high cursor-pointer transition-all active:scale-[0.97]">
            <ExternalLink className="w-4 h-4" />
          </a>
          <button onClick={onDelete}
            className="p-2 rounded-xl border border-outline-variant text-on-surface-variant
              hover:bg-red-50 hover:border-red-200 hover:text-red-500 cursor-pointer transition-all active:scale-[0.97]">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sección T&C ───────────────────────────────────────────────────────────────
function UploadTCSection() {
  const queryClient = useQueryClient()
  const [uploading,   setUploading]   = useState(false)
  const [tcUrl,       setTcUrl]       = useState('')
  const [msg,         setMsg]         = useState('')
  const [lightbox,    setLightbox]    = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data } = useQuery({
    queryKey: ['terminos-url'],
    queryFn:  () => apiFetch<any>('/config/terminos'),
  })
  useEffect(() => {
    const url = (data as any)?.data?.url ?? (data as any)?.url ?? ''
    if (url) setTcUrl(url)
  }, [data])

  async function handleUpload(file: File) {
    setUploading(true); setMsg('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const token = await getClientToken()
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'
      const res  = await fetch(`${apiUrl}/config/terminos`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body:    fd,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error')
      setTcUrl(json.data?.url ?? tcUrl)
      setMsg('Términos actualizados correctamente')
      queryClient.invalidateQueries({ queryKey: ['terminos-url'] })
    } catch (err: any) {
      setMsg(`Error: ${err.message}`)
    } finally { setUploading(false) }
  }

  return (
    <>
    <div className="bg-surface-lowest border border-outline-variant rounded-2xl p-5
      transition-all duration-200 hover:border-amber-300/50 hover:shadow-sm"
      style={{ animation: 'slideInUp 0.3s cubic-bezier(0.23,1,0.32,1) 0.1s both' }}>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-400
          flex items-center justify-center shrink-0 shadow-md shadow-amber-200">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-on-surface text-sm">Términos y Condiciones</p>
          <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
            PDF oficial que los estudiantes deben aceptar. Aplica a todos los formularios.
          </p>
          {tcUrl && (
            <button onClick={() => setLightbox(true)}
              className="inline-flex items-center gap-1 mt-2 text-xs text-amber-600 hover:text-amber-700 font-semibold hover:underline transition-colors cursor-pointer">
              <ExternalLink className="w-3 h-3" />
              Ver documento actual
            </button>
          )}
          {msg && (
            <p className={`text-xs mt-1.5 font-medium ${msg.startsWith('Error') ? 'text-red-500' : 'text-emerald-600'}`}>
              {msg}
            </p>
          )}
        </div>
        <input ref={inputRef} type="file" accept=".pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
        <button onClick={() => inputRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold
            text-white cursor-pointer transition-all active:scale-[0.97] disabled:opacity-50 shrink-0
            bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600
            shadow-md shadow-amber-200">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? 'Subiendo...' : 'Subir PDF'}
        </button>
      </div>
    </div>

    {/* ── Lightbox PDF ──────────────────────────────────────────────────────── */}
    {lightbox && tcUrl && (
      <div
        onClick={() => setLightbox(false)}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        style={{ animation: 'fadeIn 0.2s ease-out both' }}
      >
        <div
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-4xl h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ animation: 'slideInUp 0.25s cubic-bezier(0.23,1,0.32,1) both' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-outline-variant bg-surface-lowest shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-bold text-on-surface">Términos y Condiciones</p>
            </div>
            <div className="flex items-center gap-2">
              <a href={tcUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                  text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-all">
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir en nueva pestaña
              </a>
              <button onClick={() => setLightbox(false)}
                className="w-8 h-8 rounded-xl bg-surface-high flex items-center justify-center
                  text-on-surface-variant hover:text-on-surface hover:bg-surface-highest
                  transition-all active:scale-[0.95] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* PDF embed via Google Docs viewer (evita bloqueo X-Frame-Options de Cloudinary) */}
          <iframe
            src={`/api/pdf-proxy?url=${encodeURIComponent(tcUrl)}`}
            className="flex-1 w-full border-0"
            title="Términos y Condiciones"
          />
        </div>
      </div>
    )}
    </>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function FormulariosPage() {
  const queryClient = useQueryClient()
  const { msg: toastMsg, show: showToast } = useToast()
  const router = useRouter()
  const [builder,    setBuilder]    = useState<'new' | Formulario | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['formularios'],
    queryFn:  () => apiFetch<any>('/formularios'),
  })
  const formularios: Formulario[] = (data as any)?.data ?? []

  const crear = useMutation({
    mutationFn: (b: any) => apiFetch('/formularios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['formularios'] }); setBuilder(null) },
  })
  const actualizar = useMutation({
    mutationFn: ({ id, ...b }: any) => apiFetch(`/formularios/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['formularios'] }); setBuilder(null) },
  })
  const eliminar = useMutation({
    mutationFn: (id: string) => apiFetch(`/formularios/${id}`, { method: 'DELETE' }),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['formularios'] }); setConfirmDel(null) },
  })
  const toggle = useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: string; value: boolean }) =>
      apiFetch(`/formularios/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }) }),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['formularios'] }),
    onSettled:  () => setTogglingId(null),
  })

  async function handleSave(d: { nombre: string; descripcion: string; campos: Campo[] }) {
    if (typeof builder === 'object' && builder && (builder as Formulario).id) {
      await actualizar.mutateAsync({ id: (builder as Formulario).id, ...d })
    } else {
      await crear.mutateAsync(d)
    }
  }

  function handleCopyLink(id: string) {
    const url = `${window.location.origin}/inscripcion/f/${id}`
    navigator.clipboard.writeText(url).then(() => showToast('Link copiado al portapapeles'))
  }

  return (
    <>
      <style>{`
        @keyframes slideInUp    { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideInRight { from { opacity:0; transform:translateX(48px); } to { opacity:1; transform:translateX(0); } }
        @keyframes slideIn      { from { opacity:0; transform:translateY(8px);  } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn       { from { opacity:0; } to { opacity:1; } }
        @keyframes fadeDown     { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        @media (prefers-reduced-motion: reduce) { * { animation-duration:0.01ms !important; } }
      `}</style>

      <div className="flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 shrink-0 border-b border-outline-variant"
          style={{ animation: 'slideInUp 0.2s ease-out both' }}>
          <div>
            <h1 className="text-[22px] font-bold text-on-surface tracking-tight">Formularios</h1>
            <p className="text-[13px] text-on-surface-variant mt-0.5">
              Crea y gestiona los formularios de inscripción públicos
            </p>
          </div>
          <button onClick={() => router.push('/formularios/builder/nuevo')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary
              text-sm font-bold cursor-pointer hover:opacity-90 transition-all active:scale-[0.97]
              shadow-lg shadow-primary/25">
            <Plus className="w-4 h-4" />
            Nuevo formulario
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* T&C */}
          <UploadTCSection />

          {/* Divisor */}
          <div className="flex items-center gap-3" style={{ animation: 'fadeIn 0.4s ease-out 0.15s both' }}>
            <div className="h-px flex-1 bg-outline-variant" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              {formularios.length} formulario{formularios.length !== 1 ? 's' : ''}
            </span>
            <div className="h-px flex-1 bg-outline-variant" />
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <span className="text-sm text-on-surface-variant font-medium">Cargando formularios...</span>
              </div>
            </div>
          )}

          {/* Empty */}
          {!isLoading && formularios.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center"
              style={{ animation: 'fadeIn 0.4s ease-out both' }}>
              <div className="relative w-20 h-20 mb-5">
                <div className="absolute inset-0 bg-primary/5 rounded-3xl animate-pulse" />
                <div className="relative w-20 h-20 rounded-3xl bg-surface-high flex items-center justify-center">
                  <FileText className="w-9 h-9 text-on-surface-variant/30" />
                </div>
              </div>
              <p className="font-bold text-on-surface text-base mb-1">Sin formularios aún</p>
              <p className="text-sm text-on-surface-variant mb-6 max-w-xs">
                Crea tu primer formulario de inscripción con el constructor visual
              </p>
              <button onClick={() => router.push('/formularios/builder/nuevo')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-on-primary
                  text-sm font-bold cursor-pointer hover:opacity-90 transition-all active:scale-[0.97]
                  shadow-lg shadow-primary/25">
                <Plus className="w-4 h-4" />
                Crear primer formulario
              </button>
            </div>
          )}

          {/* Grid */}
          {formularios.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {formularios.map((form, i) => (
                <FormCard key={form.id} form={form} index={i}
                  toggling={togglingId === form.id}
                  onEdit={() => router.push(`/formularios/builder/${form.id}`)}
                  onDelete={() => setConfirmDel(form.id)}
                  onCopyLink={() => handleCopyLink(form.id)}
                  onToggleActivo={() => { setTogglingId(form.id); toggle.mutate({ id: form.id, field: 'activo', value: !form.activo }) }}
                  onToggleLanding={() => { setTogglingId(form.id); toggle.mutate({ id: form.id, field: 'visibleEnLanding', value: !form.visibleEnLanding }) }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Builder panel */}
      {builder !== null && (
        <FormBuilder
          inicial={typeof builder === 'object' && (builder as Formulario).id ? builder as Formulario : null}
          onSave={handleSave}
          onClose={() => setBuilder(null)}
        />
      )}

      {/* Confirm delete */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ animation: 'fadeIn 0.15s ease-out both' }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDel(null)} />
          <div className="relative bg-surface-lowest rounded-2xl shadow-2xl p-6 w-full max-w-sm"
            style={{ animation: 'slideInUp 0.2s cubic-bezier(0.23,1,0.32,1) both' }}>
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <h3 className="font-bold text-on-surface mb-1">Eliminar formulario</h3>
            <p className="text-sm text-on-surface-variant mb-5">
              Esta acción es irreversible. El formulario dejará de estar disponible públicamente.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant
                  text-sm font-semibold cursor-pointer hover:bg-surface-high transition-colors active:scale-[0.97]">
                Cancelar
              </button>
              <button onClick={() => eliminar.mutate(confirmDel)} disabled={eliminar.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold
                  cursor-pointer hover:bg-red-600 transition-colors active:scale-[0.97] disabled:opacity-50">
                {eliminar.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          style={{ animation: 'slideInUp 0.2s cubic-bezier(0.23,1,0.32,1) both' }}>
          <div className="flex items-center gap-2 px-4 py-3 bg-slate-900 text-white
            text-sm font-medium rounded-xl shadow-2xl">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            {toastMsg}
          </div>
        </div>
      )}
    </>
  )
}
