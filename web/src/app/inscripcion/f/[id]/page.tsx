'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Poppins } from 'next/font/google'
import { ChevronLeft, Loader2, Check, Upload, ArrowLeft, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { DEPARTAMENTOS_MUNICIPIOS } from '@/data/municipios'

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
function FieldInput({ campo, value, onChange, error, valores }: {
  campo: Campo
  value: any
  onChange: (v: any) => void
  error?: string
  valores?: Record<string, any>
}) {
  const base = `w-full px-4 py-3 rounded-xl border-2 text-slate-800 text-sm bg-white
    focus:outline-none transition-all duration-150 placeholder:text-slate-400
    ${error ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-[#21b9f7]'}`

  if ((campo as any).tipo === 'header_image') {
    return (
      <div className="-mx-6 -mt-6 mb-2 overflow-hidden rounded-t-3xl">
        <img
          src={(campo as any).url}
          alt="Header del formulario"
          className="w-full object-cover"
          style={{ maxHeight: '160px' }}
        />
      </div>
    )
  }

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

  // ── Caso especial: municipio filtrado por departamento ────────────────────
  if (campo.id === 'municipio' || campo.id === 'ciudad_municipio') {
    const depSeleccionado = valores?.['departamento'] ?? ''
    const municipios: string[] = depSeleccionado
      ? (DEPARTAMENTOS_MUNICIPIOS[depSeleccionado] ?? [])
      : []

    if (!depSeleccionado) {
      return (
        <div className={`${base} flex items-center text-slate-400 cursor-not-allowed bg-slate-50`}>
          Primero selecciona un departamento
        </div>
      )
    }

    return (
      <select className={`${base} cursor-pointer`} value={value ?? ''}
        onChange={e => onChange(e.target.value)}>
        <option value="">Selecciona tu municipio</option>
        {municipios.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    )
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

  const [form,        setForm]      = useState<Formulario | null>(null)
  const [terminosUrl, setTerminos]  = useState('https://res.cloudinary.com/dbc1cm3hq/raw/upload/v1780155655/grupo500/documentos/terminos-condiciones-grupo500.pdf')
  const [loading,     setLoading]   = useState(true)
  const [notFound,    setNotFound]  = useState(false)
  const [valores,     setValores]   = useState<Record<string, any>>({})
  const [errors,      setErrors]    = useState<Record<string, string>>({})
  const [submitting,  setSubmitting] = useState(false)
  const [exito,       setExito]     = useState(false)
  const [errorGlobal, setErrorGlobal] = useState('')
  const [tcOpen,      setTcOpen]    = useState(false)

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
      const v = valores

      // ── 1. Subir archivos a Cloudinary si los hay ────────────────────────────
      let comprobanteUrl = ''
      let comprobantePublicId = ''
      let documentoUrl = ''

      if (v['comprobante'] instanceof File) {
        const fd = new FormData()
        fd.append('file', v['comprobante'])
        const r = await fetch(`${API}/inscripcion/upload-comprobante`, { method: 'POST', body: fd })
        const d = await r.json()
        if (d.success) { comprobanteUrl = d.data.url; comprobantePublicId = d.data.publicId }
      }
      if (v['doc_identidad'] instanceof File) {
        const fd = new FormData()
        fd.append('file', v['doc_identidad'])
        const r = await fetch(`${API}/inscripcion/upload-documento`, { method: 'POST', body: fd })
        const d = await r.json()
        if (d.success) documentoUrl = d.data.url
      }

      // ── 2. Monto: el OCR del comprobante lo extrae en el backend ────────────
      const montoNum = 0

      // ── 3. Construir payload para POST /api/inscripcion/publica ─────────────
      const payload = {
        // Paso 1 — Estudiante
        nombre:          v['nombre']       ?? '',
        email:           v['email']        ?? '',
        telefono:        v['telefono']     ?? '',
        tipoDocumento:   v['tipo_doc']     ?? 'TI',
        documento:       v['num_doc']      ?? '',
        // Paso 2 — Ubicación
        fechaNacimiento: v['fecha_nac']    ?? '',
        departamento:    v['departamento'] ?? '',
        ciudad:          v['municipio']    ?? '',
        colegio:         v['colegio']      ?? '',
        grado:           v['grado']        ?? '',
        // Paso 3 — Acudiente
        acudienteNombre:          v['nom_acudiente']  ?? '',
        acudienteParentesco:      v['parentesco']     ?? '',
        acudienteTelefono:        v['cel_acudiente']  ?? '',
        acudienteTipoDocumento:   v['tip_doc_acud']   ?? 'CC',
        acudienteNumeroDocumento: v['num_doc_acud']   ?? '',
        // Paso 4 — Académico
        primerIcfes:     v['primer_icfes'] === 'Sí' || v['primer_icfes'] === true,
        puntajeAnterior: v['puntaje_ant']  ?? '',
        carreraInteres:  'N/A',
        // Paso 5 — Pago
        cuentaPago:      v['cuenta_pago']  ?? '',
        montoDeclarado:  montoNum,
        comprobanteUrl,
        comprobantePublicId,
        documentoUrl,
        // Paso 6 — Marketing + T&C
        fuenteContacto:  v['como_conocio'] ?? '',
        aceptaTerminos:  !!v['__terminos'],
      }

      const res = await fetch(`${API}/inscripcion/publica`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Error al procesar tu inscripción.')

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
              {campo.tipo !== 'seccion' && campo.tipo !== 'checkbox' && (campo as any).tipo !== 'header_image' && (
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
              <FieldInput
                campo={campo}
                value={valores[campo.id]}
                onChange={v => {
                  set(campo.id, v)
                  // Si cambia el departamento, resetear municipio
                  if (campo.id === 'departamento') {
                    setValores(prev => ({ ...prev, municipio: '', ciudad_municipio: '' }))
                  }
                }}
                error={errors[campo.id]}
                valores={valores}
              />
              {errors[campo.id] && (
                <p className="text-xs text-red-500 font-medium mt-1">{errors[campo.id]}</p>
              )}
            </div>
          ))}

          {/* T&C */}
          <div className={`rounded-2xl border-2 p-4 space-y-3 transition-all duration-200
            ${valores['__terminos'] ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-700">Términos y condiciones <span className="text-red-400">*</span></p>
              <button
                type="button"
                onClick={() => setTcOpen(true)}
                className="flex items-center gap-1 text-xs font-semibold text-[#1a7de0] hover:text-[#21b9f7]
                  bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all active:scale-[0.97] cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Leer documento
              </button>
            </div>
            <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition-all
              ${valores['__terminos'] ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
              <input type="checkbox" checked={!!valores['__terminos']}
                onChange={e => set('__terminos', e.target.checked)}
                className="mt-0.5 w-5 h-5 accent-[#21b9f7] cursor-pointer shrink-0" />
              <span className="text-sm text-slate-700">
                He leído y acepto los <strong>términos y condiciones</strong> del curso Pre-ICFES Grupo 500.
              </span>
            </label>
            {!valores['__terminos'] && (
              <p className="text-xs text-amber-600 font-medium">
                ⚠️ Debes aceptar los términos para poder enviar el formulario.
              </p>
            )}
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

      {/* ── Lightbox T&C ──────────────────────────────────────────────────────── */}
      {tcOpen && (
        <div
          onClick={() => setTcOpen(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm"
          style={{ animation: 'fadeInBg 0.2s ease-out both' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="relative w-full sm:max-w-2xl bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col"
            style={{ height: '90dvh', animation: 'slideUp 0.3s cubic-bezier(0.23,1,0.32,1) both' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#21b9f7]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#1a7de0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className={`${poppins.className} text-slate-800 font-bold text-sm`}>Términos y Condiciones</p>
                  <p className="text-slate-400 text-xs">Pre-ICFES Grupo 500</p>
                </div>
              </div>
              <button
                onClick={() => setTcOpen(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center
                  text-slate-500 hover:text-slate-700 transition-all active:scale-[0.95] cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* PDF */}
            <iframe
              src={`/api/pdf-proxy?url=${encodeURIComponent(terminosUrl)}`}
              className="flex-1 w-full border-0"
              title="Términos y Condiciones"
            />
            {/* Footer — aceptar desde aquí */}
            <div className="px-5 py-4 border-t border-slate-100 bg-white shrink-0">
              <button
                onClick={() => { set('__terminos', true); setTcOpen(false) }}
                className="w-full py-3.5 rounded-2xl bg-[#21b9f7] text-white font-bold text-sm
                  hover:bg-[#1a9fd8] active:scale-[0.98] transition-all cursor-pointer shadow-md"
              >
                ✓ Acepto los términos y condiciones
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInBg { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp  { from { opacity:0; transform:translateY(40px) } to { opacity:1; transform:translateY(0) } }
      `}</style>
    </div>
  )
}
