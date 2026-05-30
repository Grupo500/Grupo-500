'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Poppins } from 'next/font/google'
import { ChevronLeft, Loader2, Check, Upload, ArrowLeft, AlertCircle } from 'lucide-react'
import Link from 'next/link'

const poppins = Poppins({ subsets: ['latin'], weight: ['400', '600', '700', '800'] })
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

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
}

// ── Componentes de campo ──────────────────────────────────────────────────────
function FieldInput({ campo, value, onChange, error }: {
  campo: Campo
  value: any
  onChange: (v: any) => void
  error?: string
}) {
  const base = `w-full px-4 py-3 rounded-xl border-2 text-slate-800 text-sm bg-white
    focus:outline-none transition-all duration-150 placeholder:text-slate-400
    ${error ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-[#21b9f7]'}`

  if (campo.tipo === 'seccion') {
    return (
      <div className="pt-2 pb-1">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{campo.label}</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        {campo.descripcion && <p className="text-xs text-slate-400 text-center mt-1">{campo.descripcion}</p>}
      </div>
    )
  }

  if (campo.tipo === 'textarea') {
    return <textarea className={`${base} resize-none`} rows={3} value={value ?? ''}
      onChange={e => onChange(e.target.value)} placeholder={campo.placeholder} />
  }

  if (campo.tipo === 'select') {
    return (
      <select className={`${base} cursor-pointer`} value={value ?? ''}
        onChange={e => onChange(e.target.value)}>
        <option value="">Selecciona una opción</option>
        {(campo.opciones ?? []).map(op => <option key={op} value={op}>{op}</option>)}
      </select>
    )
  }

  if (campo.tipo === 'checkbox') {
    return (
      <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border-2 transition-all
        ${value ? 'border-[#21b9f7] bg-[#21b9f7]/5' : 'border-slate-200 hover:border-slate-300'}`}>
        <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)}
          className="mt-0.5 w-5 h-5 accent-[#21b9f7] cursor-pointer shrink-0" />
        <span className="text-sm text-slate-700">{campo.descripcion || campo.label}</span>
      </label>
    )
  }

  if (campo.tipo === 'archivo') {
    return (
      <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all
        ${value ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-dashed border-slate-300 bg-slate-50 hover:border-[#21b9f7] text-slate-500'}`}>
        {value ? <Check className="w-5 h-5 shrink-0" /> : <Upload className="w-5 h-5 shrink-0" />}
        <span className="text-sm font-medium truncate">
          {value ? (typeof value === 'string' ? 'Archivo cargado ✓' : value.name) : 'Toca para seleccionar'}
        </span>
        <input type="file" className="hidden" onChange={e => onChange(e.target.files?.[0] ?? null)} />
      </label>
    )
  }

  const inputType = campo.tipo === 'email' ? 'email'
    : campo.tipo === 'telefono' ? 'tel'
    : campo.tipo === 'fecha' ? 'date'
    : campo.tipo === 'numero' ? 'number'
    : 'text'

  return (
    <input type={inputType} className={base} value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={campo.placeholder}
      inputMode={campo.tipo === 'telefono' ? 'tel' : campo.tipo === 'numero' ? 'numeric' : undefined} />
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function FormularioDinamico() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()

  const [form,      setForm]      = useState<Formulario | null>(null)
  const [terminosUrl, setTerminos] = useState('https://res.cloudinary.com/dbc1cm3hq/raw/upload/v1780155655/grupo500/documentos/terminos-condiciones-grupo500.pdf')
  const [loading,   setLoading]   = useState(true)
  const [notFound,  setNotFound]  = useState(false)
  const [valores,   setValores]   = useState<Record<string, any>>({})
  const [errors,    setErrors]    = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [exito,     setExito]     = useState(false)
  const [errorGlobal, setErrorGlobal] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`${API}/inscripcion/formularios/${id}`).then(r => r.json()),
      fetch(`${API}/inscripcion/terminos`).then(r => r.json()),
    ]).then(([fData, tData]) => {
      if (!fData.success || !fData.data?.activo) { setNotFound(true); return }
      setForm(fData.data)
      if (tData.success && tData.data?.url) setTerminos(tData.data.url)
    }).catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  function set(campoId: string, valor: any) {
    setValores(v => ({ ...v, [campoId]: valor }))
    setErrors(e => ({ ...e, [campoId]: '' }))
  }

  function validar(): boolean {
    if (!form) return false
    const errs: Record<string, string> = {}
    form.campos.forEach(c => {
      if (c.tipo === 'seccion') return
      if (c.requerido && !valores[c.id]) errs[c.id] = 'Este campo es requerido'
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function enviar() {
    if (!validar() || !form) return
    setSubmitting(true)
    setErrorGlobal('')
    try {
      // Construir payload con los valores
      const payload: Record<string, any> = { formularioId: id, campos: {} }
      form.campos.forEach(c => {
        if (c.tipo !== 'seccion') payload.campos[c.id] = { label: c.label, valor: valores[c.id] }
      })
      // Por ahora simula el envío (en una fase futura conectar con BD)
      await new Promise(r => setTimeout(r, 1200))
      setExito(true)
    } catch (err: any) {
      setErrorGlobal(err.message ?? 'Error al enviar. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ──
  if (loading) return (
    <div className="min-h-dvh bg-gradient-to-b from-[#21b9f7] to-[#1a7de0] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-10 h-10 text-white animate-spin" />
        <p className="text-white/80 text-sm font-medium">Cargando formulario...</p>
      </div>
    </div>
  )

  // ── Not found ──
  if (notFound || !form) return (
    <div className="min-h-dvh bg-gradient-to-b from-[#21b9f7] to-[#1a7de0] flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-sm w-full">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className={`${poppins.className} font-bold text-slate-800 text-lg mb-2`}>
          Formulario no disponible
        </h2>
        <p className="text-slate-500 text-sm mb-5">
          Este formulario no existe o no está activo en este momento.
        </p>
        <Link href="/inscripcion"
          className="block w-full py-3 rounded-xl bg-[#21b9f7] text-white font-bold text-sm text-center">
          Ver formularios activos
        </Link>
      </div>
    </div>
  )

  // ── Éxito ──
  if (exito) return (
    <div className="min-h-dvh bg-gradient-to-b from-[#21b9f7] to-[#1a7de0] flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-sm w-full"
        style={{ animation: 'scaleIn 0.3s cubic-bezier(0.23,1,0.32,1) both' }}>
        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
          <Check className="w-10 h-10 text-emerald-500" strokeWidth={2.5} />
        </div>
        <h2 className={`${poppins.className} font-bold text-slate-800 text-2xl mb-2`}>¡Listo!</h2>
        <p className="text-slate-500 text-sm mb-6">
          Tu formulario fue enviado exitosamente. En breve nos ponemos en contacto contigo.
        </p>
        <a href="https://wa.me/573168819037" target="_blank" rel="noopener noreferrer"
          className="block w-full py-3 rounded-xl bg-[#25D366] text-white font-bold text-sm mb-3">
          Escribir por WhatsApp
        </a>
        <button onClick={() => router.push('/')}
          className="text-sm text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
          Volver al inicio
        </button>
      </div>
      <style>{`@keyframes scaleIn { from { opacity:0; transform:scale(0.92); } to { opacity:1; transform:scale(1); } }`}</style>
    </div>
  )

  // ── Formulario ──
  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#21b9f7] to-[#1a7de0] flex flex-col">
      <style>{`
        @keyframes slideInUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* Header */}
      <header className="w-full pt-6 pb-4 px-5 flex items-center gap-3">
        <Link href="/inscripcion"
          className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors cursor-pointer">
          <ArrowLeft className="w-5 h-5 text-white" />
        </Link>
        <div>
          <p className={`${poppins.className} text-white font-bold text-base leading-tight`}>{form.nombre}</p>
          {form.descripcion && <p className="text-white/70 text-xs mt-0.5">{form.descripcion}</p>}
        </div>
      </header>

      <main className="flex-1 px-4 pb-10">
        <div className="bg-white rounded-3xl shadow-2xl p-6 space-y-5 max-w-xl mx-auto"
          style={{ animation: 'slideInUp 0.3s cubic-bezier(0.23,1,0.32,1) both' }}>

          {form.campos.map((campo, i) => (
            <div key={campo.id} style={{ animation: `slideInUp 0.25s cubic-bezier(0.23,1,0.32,1) ${i * 40}ms both` }}>
              {campo.tipo !== 'seccion' && campo.tipo !== 'checkbox' && (
                <div className="mb-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    {campo.label}
                    {campo.requerido && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  {campo.descripcion && (
                    <p className="text-xs text-slate-400 mt-0.5">{campo.descripcion}</p>
                  )}
                </div>
              )}
              <FieldInput campo={campo} value={valores[campo.id]}
                onChange={v => set(campo.id, v)} error={errors[campo.id]} />
              {errors[campo.id] && (
                <p className="text-xs text-red-500 font-medium mt-1">{errors[campo.id]}</p>
              )}
            </div>
          ))}

          {/* T&C */}
          <div className="rounded-2xl border-2 border-slate-200 p-4 space-y-2">
            <p className="text-sm font-semibold text-slate-700">Términos y condiciones</p>
            <p className="text-xs text-slate-500">
              Lee los términos antes de enviar.{' '}
              <a href={terminosUrl} target="_blank" rel="noopener noreferrer"
                className="text-[#1a7de0] underline font-medium">
                Ver documento
              </a>
            </p>
            <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl transition-all
              ${valores['__terminos'] ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50'}`}>
              <input type="checkbox" checked={!!valores['__terminos']}
                onChange={e => set('__terminos', e.target.checked)}
                className="mt-0.5 w-5 h-5 accent-[#21b9f7] cursor-pointer shrink-0" />
              <span className="text-sm text-slate-700">
                Acepto los términos y condiciones del curso.
              </span>
            </label>
          </div>

          {errorGlobal && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-600 font-medium">{errorGlobal}</p>
            </div>
          )}

          <button onClick={enviar} disabled={submitting || !valores['__terminos']}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl
              bg-[#F97316] text-white font-bold text-sm shadow-lg cursor-pointer
              hover:shadow-xl hover:scale-[1.01] transition-all active:scale-[0.99]
              disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100">
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
              : <><Check className="w-4 h-4" /> Enviar formulario</>
            }
          </button>
        </div>
        <p className="text-center text-white/40 text-xs mt-6">
          Desarrollado por <span className="text-white/60 font-semibold">NexCode97</span>
        </p>
      </main>
    </div>
  )
}
