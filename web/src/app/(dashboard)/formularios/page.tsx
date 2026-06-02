'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, getClientToken } from '@/lib/api'
import {
  Plus, X, Trash2, Copy, ExternalLink, Eye, EyeOff,
  Loader2, Check, Upload, Globe, Link2,
  FileText, Calendar, LayoutTemplate, Pencil, Save,
} from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Campo {
  id: string
  tipo: string
  label: string
  requerido: boolean
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

// ── Toast ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [msg, setMsg] = useState('')
  const show = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }, [])
  return { msg, show }
}

// ── Card de formulario ────────────────────────────────────────────────────────
function FormCard({ form, index, onDelete, onToggleActivo, onToggleLanding, onCopyLink, onEditNombre, toggling }: {
  form: Formulario; index: number; toggling: boolean
  onDelete: () => void; onCopyLink: () => void; onEditNombre: () => void
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
          <div className="flex items-start gap-1.5 group/title">
            <h3 className="font-bold text-on-surface truncate flex-1">{form.nombre}</h3>
            <button onClick={onEditNombre}
              title="Editar nombre"
              className="opacity-0 group-hover/title:opacity-100 transition-opacity p-1 rounded-lg
                text-on-surface-variant hover:text-primary hover:bg-primary/5 cursor-pointer active:scale-[0.95] shrink-0">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
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
              hover:bg-surface-high cursor-pointer transition-all active:scale-[0.97]"
            title="Abrir formulario">
            <ExternalLink className="w-4 h-4" />
          </a>
          <button onClick={onDelete}
            className="p-2 rounded-xl border border-outline-variant text-on-surface-variant
              hover:bg-red-50 hover:border-red-200 hover:text-red-500 cursor-pointer transition-all active:scale-[0.97]">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Botón generar enlace por asesor */}
        <EnlaceAsesorBtn formId={form.id} />
      </div>
    </div>
  )
}

// ── Botón generar enlace por asesor ──────────────────────────────────────────
function EnlaceAsesorBtn({ formId }: { formId: string }) {
  const [open, setOpen]         = useState(false)
  const [asesores, setAsesores] = useState<{ id: string; nombre: string }[]>([])
  const [loading, setLoading]   = useState(false)
  const [copiado, setCopiado]   = useState<string | null>(null)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  async function cargarAsesores() {
    if (asesores.length > 0) { setOpen(true); return }
    setLoading(true)
    try {
      const token = await getClientToken()
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'
      const res = await fetch(`${apiUrl}/asesores`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const json = await res.json()
      setAsesores(json.data ?? [])
      setOpen(true)
    } finally { setLoading(false) }
  }

  function copiar(asesorId: string) {
    const url = `${origin}/inscripcion/f/${formId}?asesor=${asesorId}`
    navigator.clipboard.writeText(url)
    setCopiado(asesorId)
    setTimeout(() => setCopiado(null), 2000)
  }

  return (
    <div className="relative">
      <button onClick={cargarAsesores} disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-primary/30
          text-xs font-semibold text-primary hover:bg-primary/5 transition-all active:scale-[0.97]
          cursor-pointer disabled:opacity-50 mt-2">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
        Generar enlace por asesor
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-surface-lowest border border-outline-variant
            rounded-2xl shadow-2xl overflow-hidden"
            style={{ animation: 'slideInUp 0.2s cubic-bezier(0.23,1,0.32,1) both' }}>
            <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
              <p className="text-xs font-bold text-on-surface">Enlace personalizado por asesor</p>
              <button onClick={() => setOpen(false)} className="text-on-surface-variant hover:text-on-surface cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-outline-variant/30">
              {asesores.length === 0
                ? <p className="text-xs text-on-surface-variant text-center py-4">No hay asesores registrados</p>
                : asesores.map(a => (
                  <div key={a.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-high">
                    <div>
                      <p className="text-xs font-semibold text-on-surface">{a.nombre}</p>
                      <p className="text-[10px] text-on-surface-variant font-mono truncate max-w-[160px]">
                        ?asesor={a.id}
                      </p>
                    </div>
                    <button onClick={() => copiar(a.id)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer active:scale-[0.95]
                        ${copiado === a.id ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}>
                      {copiado === a.id ? <><Check className="w-3 h-3" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
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
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Ícono + info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
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
        </div>
        {/* Botón subir */}
        <input ref={inputRef} type="file" accept=".pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
        <button onClick={() => inputRef.current?.click()} disabled={uploading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold
            text-white cursor-pointer transition-all active:scale-[0.97] disabled:opacity-50 shrink-0
            bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600
            shadow-md shadow-amber-200 w-full sm:w-auto">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? 'Subiendo...' : 'Subir PDF'}
        </button>
      </div>
    </div>

    {/* Lightbox PDF */}
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
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState<Formulario | null>(null)
  const [nuevoNombre, setNuevoNombre] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['formularios'],
    queryFn:  () => apiFetch<any>('/formularios'),
  })
  const formularios: Formulario[] = (data as any)?.data ?? []

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

  const renombrar = useMutation({
    mutationFn: ({ id, nombre }: { id: string; nombre: string }) =>
      apiFetch(`/formularios/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formularios'] })
      setEditNombre(null)
      showToast('Nombre actualizado')
    },
  })

  function handleCopyLink(id: string) {
    const url = `${window.location.origin}/inscripcion/f/${id}`
    navigator.clipboard.writeText(url).then(() => showToast('Link copiado al portapapeles'))
  }

  return (
    <>
      <style>{`
        @keyframes slideInUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
        @media (prefers-reduced-motion: reduce) { * { animation-duration:0.01ms !important; } }
      `}</style>

      <div className="flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 shrink-0 border-b border-outline-variant"
          style={{ animation: 'slideInUp 0.2s ease-out both' }}>
          <div>
            <h1 className="text-[22px] font-bold text-on-surface tracking-tight">Formularios</h1>
            <p className="text-[13px] text-on-surface-variant mt-0.5">
              Gestiona los formularios de inscripción públicos
            </p>
          </div>
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
              <p className="font-bold text-on-surface text-base mb-1">Sin formularios disponibles</p>
              <p className="text-sm text-on-surface-variant max-w-xs">
                Los formularios se gestionan directamente desde la base de datos.
              </p>
            </div>
          )}

          {/* Grid */}
          {formularios.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {formularios.map((form, i) => (
                <FormCard key={form.id} form={form} index={i}
                  toggling={togglingId === form.id}
                  onDelete={() => setConfirmDel(form.id)}
                  onCopyLink={() => handleCopyLink(form.id)}
                  onEditNombre={() => { setEditNombre(form); setNuevoNombre(form.nombre) }}
                  onToggleActivo={() => { setTogglingId(form.id); toggle.mutate({ id: form.id, field: 'activo', value: !form.activo }) }}
                  onToggleLanding={() => { setTogglingId(form.id); toggle.mutate({ id: form.id, field: 'visibleEnLanding', value: !form.visibleEnLanding }) }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal editar nombre */}
      {editNombre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ animation: 'fadeIn 0.15s ease-out both' }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditNombre(null)} />
          <div className="relative bg-surface-lowest rounded-2xl shadow-2xl p-6 w-full max-w-md"
            style={{ animation: 'slideInUp 0.2s cubic-bezier(0.23,1,0.32,1) both' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Pencil className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-on-surface text-sm">Editar nombre del formulario</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">Se actualizará en todas las vistas (landing, panel y enlaces existentes)</p>
              </div>
            </div>

            <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
              Nombre
            </label>
            <input
              autoFocus
              value={nuevoNombre}
              onChange={e => setNuevoNombre(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && nuevoNombre.trim().length >= 2 && nuevoNombre !== editNombre.nombre) {
                  renombrar.mutate({ id: editNombre.id, nombre: nuevoNombre.trim() })
                }
                if (e.key === 'Escape') setEditNombre(null)
              }}
              placeholder="Nombre del formulario..."
              className="w-full px-4 py-3 rounded-xl border-2 border-outline-variant bg-surface-lowest text-on-surface
                focus:outline-none focus:border-primary transition-all"
            />
            {nuevoNombre.trim().length > 0 && nuevoNombre.trim().length < 2 && (
              <p className="text-xs text-red-500 mt-1.5 font-medium">El nombre debe tener al menos 2 caracteres</p>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditNombre(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant
                  text-sm font-semibold cursor-pointer hover:bg-surface-high transition-colors active:scale-[0.97]">
                Cancelar
              </button>
              <button
                onClick={() => renombrar.mutate({ id: editNombre.id, nombre: nuevoNombre.trim() })}
                disabled={renombrar.isPending || nuevoNombre.trim().length < 2 || nuevoNombre.trim() === editNombre.nombre}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-on-primary
                  text-sm font-bold cursor-pointer hover:opacity-90 transition-all active:scale-[0.97]
                  disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-primary/20">
                {renombrar.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Save className="w-4 h-4" />
                }
                Guardar
              </button>
            </div>
          </div>
        </div>
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
