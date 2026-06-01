'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Poppins } from 'next/font/google'
import { ChevronLeft, Loader2, Check, Upload, ArrowLeft, AlertCircle, Calendar, Clock, BookOpen, Target } from 'lucide-react'
import Link from 'next/link'
import { DEPARTAMENTOS_MUNICIPIOS } from '@/data/municipios'

const poppins = Poppins({ subsets: ['latin'], weight: ['400', '600', '700', '800'] })
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

type TipoCampo = 'texto' | 'textarea' | 'email' | 'telefono' | 'fecha' | 'select' | 'checkbox' | 'archivo' | 'seccion' | 'numero'
  | 'radio' | 'checkbox_multi' | 'si_no' | 'escala' | 'nps' | 'parrafo' | 'header_image'

interface Campo {
  id: string
  tipo: TipoCampo
  label: string
  placeholder?: string
  descripcion?: string
  requerido: boolean
  opciones?: string[]
}

interface FormMeta {
  colorPrimario?:     string
  mensajeBienvenida?: string
  mensajeExito?:      string
  icono?:             'check' | 'star' | 'trophy' | 'heart' | 'rocket'
}

interface Formulario {
  id: string
  nombre: string
  descripcion?: string
  campos: Campo[]
  meta?: FormMeta
  activo: boolean
}

// ── Evaluar lógica condicional ─────────────────────────────────────────────────
function evaluarLogica(logica: any, valores: Record<string, any>): boolean {
  if (!logica) return true
  const val = valores[logica.campoId]
  const valStr = Array.isArray(val) ? val.join(',') : String(val ?? '')
  switch (logica.operador) {
    case 'igual':    return valStr === String(logica.valor)
    case 'no_igual': return valStr !== String(logica.valor)
    case 'contiene': return valStr.toLowerCase().includes(String(logica.valor).toLowerCase())
    case 'no_vacio': return val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0)
    default:         return true
  }
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

  // ── Selector de curso con tarjeta info ──────────────────────────────────────
  if (campo.id === 'curso_seleccionado') {
    const cursos: any[] = (valores as any).__cursos ?? []
    const cursoSelec = cursos.find((c: any) => c.id === value)
    const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
    return (
      <div className="space-y-3">
        <select className={`${base} cursor-pointer`} value={value ?? ''}
          onChange={e => onChange(e.target.value)}>
          <option value="">Selecciona tu curso...</option>
          {cursos.map((c: any) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        {cursoSelec && (
          <div className="rounded-2xl border-2 border-[#21b9f7]/30 bg-[#21b9f7]/5 p-4 space-y-2.5"
            style={{ animation: 'slideInUp 0.2s cubic-bezier(0.23,1,0.32,1) both' }}>
            <p className="text-sm font-bold text-slate-700">{cursoSelec.nombre}</p>
            {cursoSelec.descripcion && <p className="text-xs text-slate-500">{cursoSelec.descripcion}</p>}
            <div className="grid grid-cols-2 gap-2">
              {cursoSelec.fechaInicio && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Calendar className="w-3.5 h-3.5 text-[#21b9f7] shrink-0" />
                  <span><strong>Inicio:</strong> {fmt(cursoSelec.fechaInicio)}</span>
                </div>
              )}
              {cursoSelec.fechaIcfes && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Target className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  <span><strong>ICFES:</strong> {fmt(cursoSelec.fechaIcfes)}</span>
                </div>
              )}
              {cursoSelec.duracionHoras && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span><strong>Horas:</strong> {cursoSelec.duracionHoras}h</span>
                </div>
              )}
              {cursoSelec.simulacros && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <BookOpen className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                  <span><strong>Simulacros:</strong> {cursoSelec.simulacros}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Párrafo informativo ──────────────────────────────────────────────────────
  if (campo.tipo === 'parrafo') {
    return <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">{(campo as any).contenido || campo.label}</p>
  }

  // ── Selección única (radio visual) ───────────────────────────────────────────
  if (campo.tipo === 'radio') {
    return (
      <div className="space-y-2">
        {(campo.opciones ?? []).map(op => (
          <label key={op} className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all
            ${value === op ? 'border-[#21b9f7] bg-[#21b9f7]/5' : 'border-slate-200 hover:border-slate-300'}`}>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
              ${value === op ? 'border-[#21b9f7]' : 'border-slate-300'}`}>
              {value === op && <div className="w-2.5 h-2.5 rounded-full bg-[#21b9f7]" />}
            </div>
            <input type="radio" className="hidden" checked={value === op} onChange={() => onChange(op)} />
            <span className="text-sm text-slate-700">{op}</span>
          </label>
        ))}
      </div>
    )
  }

  // ── Selección múltiple (checkbox multi) ──────────────────────────────────────
  if (campo.tipo === 'checkbox_multi') {
    const selected: string[] = Array.isArray(value) ? value : []
    const toggle = (op: string) => {
      const next = selected.includes(op) ? selected.filter(v => v !== op) : [...selected, op]
      onChange(next)
    }
    return (
      <div className="space-y-2">
        {(campo.opciones ?? []).map(op => (
          <label key={op} className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all
            ${selected.includes(op) ? 'border-[#21b9f7] bg-[#21b9f7]/5' : 'border-slate-200 hover:border-slate-300'}`}
            onClick={() => toggle(op)}>
            <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all
              ${selected.includes(op) ? 'border-[#21b9f7] bg-[#21b9f7]' : 'border-slate-300'}`}>
              {selected.includes(op) && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </div>
            <span className="text-sm text-slate-700">{op}</span>
          </label>
        ))}
      </div>
    )
  }

  // ── Sí / No ──────────────────────────────────────────────────────────────────
  if (campo.tipo === 'si_no') {
    return (
      <div className="grid grid-cols-2 gap-3">
        {['Sí', 'No'].map(op => (
          <button key={op} type="button" onClick={() => onChange(op)}
            className={`py-3.5 rounded-xl border-2 text-sm font-bold transition-all active:scale-[0.97] cursor-pointer
              ${value === op
                ? op === 'Sí' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-red-300 bg-red-50 text-red-600'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
            {op === 'Sí' ? '👍  Sí' : '👎  No'}
          </button>
        ))}
      </div>
    )
  }

  // ── Escala de valoración ─────────────────────────────────────────────────────
  if (campo.tipo === 'escala') {
    const max = (campo as any).escalaMax ?? 5
    return (
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={`w-11 h-11 rounded-xl border-2 text-sm font-bold transition-all active:scale-[0.97] cursor-pointer
              ${value === n
                ? 'border-[#21b9f7] bg-[#21b9f7] text-white shadow-md shadow-[#21b9f7]/30'
                : 'border-slate-200 text-slate-600 hover:border-[#21b9f7] hover:text-[#21b9f7]'}`}>
            {n}
          </button>
        ))}
      </div>
    )
  }

  // ── NPS (0-10) ───────────────────────────────────────────────────────────────
  if (campo.tipo === 'nps') {
    return (
      <div>
        <div className="flex gap-1.5 flex-wrap mb-2">
          {Array.from({ length: 11 }, (_, i) => i).map(n => (
            <button key={n} type="button" onClick={() => onChange(n)}
              className={`w-[42px] h-10 rounded-xl border-2 text-xs font-bold transition-all active:scale-[0.97] cursor-pointer
                ${value === n
                  ? 'border-[#21b9f7] bg-[#21b9f7] text-white'
                  : 'border-slate-200 text-slate-600 hover:border-[#21b9f7]'}`}>
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-slate-400 px-1">
          <span>Muy improbable</span>
          <span>Muy probable</span>
        </div>
      </div>
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
    const isImage = value instanceof File
      ? value.type.startsWith('image/')
      : false
    const previewUrl = value instanceof File && isImage
      ? URL.createObjectURL(value)
      : null
    const fileName = value instanceof File ? value.name : null

    if (value) {
      return (
        <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 overflow-hidden">
          {/* Preview si es imagen */}
          {previewUrl && (
            <div className="relative w-full bg-slate-100" style={{ maxHeight: '160px' }}>
              <img src={previewUrl} alt="Vista previa" className="w-full object-contain" style={{ maxHeight: '160px' }} />
            </div>
          )}
          {/* Info + acciones */}
          <div className="flex items-center gap-3 px-4 py-3">
            <Check className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-700 truncate">
                {fileName ?? 'Archivo adjunto'}
              </p>
              <p className="text-xs text-emerald-600">Listo para enviar</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Ver (solo imágenes o si tiene URL) */}
              {previewUrl && (
                <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-semibold text-[#1a7de0]
                    bg-white border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Ver
                </a>
              )}
              {/* Eliminar */}
              <button type="button" onClick={() => onChange(null)}
                className="flex items-center gap-1 text-xs font-semibold text-red-500
                  bg-white border border-red-200 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-all active:scale-[0.97] cursor-pointer">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed
        border-slate-300 bg-slate-50 hover:border-[#21b9f7] hover:bg-blue-50/30
        text-slate-500 cursor-pointer transition-all active:scale-[0.99]">
        <Upload className="w-5 h-5 shrink-0" />
        <div>
          <p className="text-sm font-medium">Toca para seleccionar</p>
          <p className="text-xs text-slate-400 mt-0.5">Imagen o PDF — máx. 10 MB</p>
        </div>
        <input type="file" accept="image/*,.pdf" className="hidden"
          onChange={e => onChange(e.target.files?.[0] ?? null)} />
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
const METODOS_PAGO_INFO: Record<string, { hint: string }> = {
  'Bancolombia':   { hint: 'Ingresa el número de referencia de la transferencia Bancolombia.' },
  'Interbancario': { hint: 'Ingresa el número de referencia del pago interbancario (PSE).' },
  'Nequi':         { hint: 'Ingresa los últimos 10 dígitos del número de confirmación Nequi.' },
  'Bre-B':         { hint: 'Ingresa el código de transacción de tu pago Bre-B.' },
  'Addi':          { hint: 'Ingresa el código de aprobación de crédito que te generó Addi.' },
  'Sistecredito':  { hint: 'Ingresa el número de aprobación de tu crédito Sistecredito.' },
  'Otro':          { hint: 'Ingresa el número o código de tu referencia de pago.' },
}

export default function FormularioDinamico() {
  const { id }       = useParams<{ id: string }>()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const asesorParam  = searchParams.get('asesor')

  const [form,        setForm]      = useState<Formulario | null>(null)
  const [meta,        setMeta]      = useState<FormMeta>({})
  const [terminosUrl, setTerminos]  = useState('https://res.cloudinary.com/dbc1cm3hq/raw/upload/v1780155655/grupo500/documentos/terminos-condiciones-grupo500.pdf')
  const [loading,     setLoading]   = useState(true)
  const [notFound,    setNotFound]  = useState(false)
  const [asesorNombre, setAsesorNombre] = useState<string | null>(null)
  const [asesorError,  setAsesorError]  = useState(false)
  const [cursos,      setCursos]    = useState<any[]>([])
  const [cursoInfo,   setCursoInfo] = useState<any | null>(null)
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
      fetch(`${API}/inscripcion/cursos-activos`).then(r => r.json()),
      asesorParam ? fetch(`${API}/inscripcion/asesor/${asesorParam}`).then(r => r.json()).catch(() => ({ success: false })) : Promise.resolve(null),
    ]).then(([fData, tData, cData, aData]) => {
      if (!fData.success || !fData.data?.activo) { setNotFound(true); return }
      setForm(fData.data)
      if (fData.data.meta) setMeta(fData.data.meta)
      if (tData.success && tData.data?.url) setTerminos(tData.data.url)
      if (cData?.success) {
        setCursos(cData.data)
        setValores(v => ({ ...v, __cursos: cData.data }))
      }
      if (aData !== null) {
        if (aData.success) setAsesorNombre(aData.data.nombre)
        else setAsesorError(true)
      }
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
      if (['seccion', 'parrafo', 'header_image'].includes(c.tipo)) return
      // No validar campos ocultos por lógica condicional
      if (!evaluarLogica((c as any).logica, valores)) return
      if (c.requerido) {
        const val = valores[c.id]
        const vacio = val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)
        if (vacio) errs[c.id] = 'Este campo es requerido'
      }
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
        if (!d.success) throw new Error('No se pudo subir el comprobante. Intenta de nuevo.')
        comprobanteUrl = d.data.url
        comprobantePublicId = d.data.publicId
      } else {
        throw new Error('Debes adjuntar el comprobante de pago para continuar.')
      }
      if (v['doc_identidad'] instanceof File) {
        const fd = new FormData()
        fd.append('file', v['doc_identidad'])
        const r = await fetch(`${API}/inscripcion/upload-documento`, { method: 'POST', body: fd })
        const d = await r.json()
        if (d.success) documentoUrl = d.data.url
      }

      // ── Mapeo de tipos de documento legibles → códigos del backend ──────────
      const mapTipoDoc = (s: string): 'CC' | 'TI' | 'CE' | 'PA' | 'Otro' => {
        const txt = (s ?? '').toLowerCase()
        if (txt.includes('tarjeta'))   return 'TI'
        if (txt.includes('ciudadan'))  return 'CC'
        if (txt.includes('extranj'))   return 'CE'
        if (txt.includes('pasaporte')) return 'PA'
        return 'Otro'
      }

      // ── 2. Construir payload para POST /api/inscripcion/publica ─────────────
      const payload = {
        nombre:          v['nombre']              ?? '',
        email:           v['email']               ?? '',
        telefono:        v['telefono']            ?? '',
        tipoDocumento:   mapTipoDoc(v['tipo_doc']),
        documento:       v['num_doc']             ?? '',
        fechaNacimiento: v['fecha_nac']           ?? '',
        departamento:    v['departamento']        ?? '',
        ciudad:          v['municipio']           ?? '',
        colegio:         v['colegio']             ?? '',
        grado:           v['grado']               ?? '',
        acudienteNombre:          v['nom_acudiente']  ?? '',
        acudienteParentesco:      v['parentesco']     ?? '',
        acudienteTelefono:        v['cel_acudiente']  ?? '',
        acudienteTipoDocumento:   mapTipoDoc(v['tip_doc_acud']),
        acudienteNumeroDocumento: v['num_doc_acud']   ?? '',
        primerIcfes:     v['primer_icfes'] === 'Sí' || v['primer_icfes'] === true,
        puntajeAnterior: v['puntaje_ant']         ?? '',
        cursoId:         v['curso_seleccionado']  ?? '',
        metodoPago:      v['metodo_pago']         ?? '',
        referenciaPago:  v['referencia_pago']     ?? '',
        comprobanteUrl,
        comprobantePublicId,
        documentoUrl,
        fuenteContacto:  v['como_conocio']        ?? '',
        aceptaTerminos:  !!v['__terminos'],
        formularioId:    id,
        asesorId:        asesorParam              ?? undefined,
      }

      const res = await fetch(`${API}/inscripcion/publica`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Error al procesar tu inscripción.')

      // Si el correo ya existía, mostrar mensaje específico
      if (data.data?.yaExistia || data.yaExistia) {
        throw new Error(data.message ?? data.data?.message ?? 'Este correo ya está registrado. Contacta a tu asesor.')
      }

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

  // ── Asesor inválido ──
  if (asesorError) return (
    <div className="min-h-dvh bg-gradient-to-b from-[#21b9f7] to-[#1a7de0] flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-sm w-full">
        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className={`${poppins.className} font-bold text-slate-800 text-lg mb-2`}>
          Enlace no válido
        </h2>
        <p className="text-slate-500 text-sm mb-5">
          Este enlace de inscripción no es válido. Solicita un nuevo enlace a tu asesor.
        </p>
        <a href="https://wa.me/573168819037"
          className="block w-full py-3 rounded-xl bg-[#25D366] text-white font-bold text-sm text-center">
          Contactar a Grupo 500
        </a>
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

  const color    = meta.colorPrimario ?? '#21b9f7'
  const colorDark = meta.colorPrimario ?? '#1a7de0'

  // Iconos de éxito
  const IconoExito = () => {
    const cls = 'w-10 h-10'
    switch (meta.icono) {
      case 'star':   return <svg className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      case 'trophy': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 9H4.5a2.5 2.5 0 010-5H6m12 5h1.5a2.5 2.5 0 000-5H18M6 9a6 6 0 0012 0M6 9V4h12v5M8 21h8m-4-4v4"/></svg>
      case 'heart':  return <svg className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.593c-.524-.247-7.653-4.44-9.538-8.19-2.177-4.265-.563-8.33 2.906-9.54 2.233-.789 4.753-.148 6.632 1.726 1.88-1.874 4.4-2.515 6.633-1.726 3.469 1.21 5.083 5.275 2.906 9.54-1.885 3.75-9.013 7.943-9.539 8.19z"/></svg>
      case 'rocket': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7l-.149-.149c-1.045-1.044-1.36-2.571-.78-3.896m1.36 1.72a3.544 3.544 0 010-5.011"/></svg>
      default:       return <Check className={cls} strokeWidth={2.5} />
    }
  }

  // ── Éxito ──
  if (exito) return (
    <div className="min-h-dvh flex items-center justify-center px-4"
      style={{ background: `linear-gradient(135deg, ${color}, ${colorDark})` }}>
      <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-sm w-full"
        style={{ animation: 'scaleIn 0.4s cubic-bezier(0.23,1,0.32,1) both' }}>
        {/* Círculo icono animado */}
        <div className="relative mx-auto mb-6 w-24 h-24">
          <div className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ background: color }} />
          <div className="relative w-24 h-24 rounded-full flex items-center justify-center"
            style={{ background: `${color}18` }}>
            <div style={{ color }}>
              <IconoExito />
            </div>
          </div>
        </div>
        <h2 className={`${poppins.className} font-extrabold text-slate-800 text-2xl mb-2`}>
          ¡Formulario enviado!
        </h2>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">
          {meta.mensajeExito || 'Tu información fue recibida exitosamente. En breve nos ponemos en contacto contigo.'}
        </p>
        <a href="https://wa.me/573168819037" target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-[#25D366] text-white font-bold text-sm mb-3 hover:bg-[#1ebe5d] transition-all active:scale-[0.98]">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 17.562c-.726.726-1.603 1.12-2.596 1.171-2.082.105-5.144-.967-7.305-3.127-2.161-2.161-3.232-5.223-3.127-7.305.051-.993.445-1.87 1.171-2.596.727-.726 1.604-1.12 2.597-1.17.426-.021.838.058 1.218.231l1.462 2.924c.173.346.13.754-.111 1.058l-.834.975c.37.848.966 1.618 1.755 2.407.789.789 1.559 1.385 2.407 1.755l.975-.834c.304-.241.712-.284 1.058-.111l2.924 1.462c.173.38.252.792.231 1.218-.05.993-.444 1.87-1.17 2.597z"/></svg>
          Escribir por WhatsApp
        </a>
        <button onClick={() => router.push('/')}
          className="text-sm text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
          Volver al inicio
        </button>
      </div>
      <style>{`
        @keyframes scaleIn { from { opacity:0; transform:scale(0.88) translateY(16px); } to { opacity:1; transform:scale(1) translateY(0); } }
      `}</style>
    </div>
  )

  // ── Formulario ──
  return (
    <div className="min-h-dvh flex flex-col"
      style={{ background: `linear-gradient(160deg, ${color} 0%, ${colorDark} 100%)` }}>
      <style>{`
        @keyframes slideInUp  { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn     { from { opacity:0; } to { opacity:1; } }
        @keyframes condShow   { from { opacity:0; transform:translateY(-8px) scaleY(0.95); max-height:0; } to { opacity:1; transform:translateY(0) scaleY(1); max-height:600px; } }
        @keyframes condHide   { from { opacity:1; max-height:600px; } to { opacity:0; max-height:0; margin:0; padding:0; } }
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
          {asesorNombre && (
            <p className="text-white/80 text-xs mt-1 flex items-center gap-1">
              <span className="w-4 h-4 rounded-full bg-white/20 inline-flex items-center justify-center text-[9px] font-bold">{asesorNombre[0]}</span>
              Asesor: <strong>{asesorNombre}</strong>
            </p>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 pb-10">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-xl mx-auto"
          style={{ animation: 'slideInUp 0.35s cubic-bezier(0.23,1,0.32,1) both' }}>

          {/* Mensaje de bienvenida */}
          {meta.mensajeBienvenida && (
            <div className="px-6 py-4 border-b border-slate-100"
              style={{ background: `${color}0d`, borderLeft: `4px solid ${color}` }}>
              <p className="text-sm text-slate-700 leading-relaxed">{meta.mensajeBienvenida}</p>
            </div>
          )}

          <div className="p-6 space-y-5">
          {form.campos.map((campo, i) => {
            const visible = evaluarLogica((campo as any).logica, valores)
            return (
            <div key={campo.id}
              style={{
                animation:      visible ? `slideInUp 0.25s cubic-bezier(0.23,1,0.32,1) ${i * 30}ms both` : undefined,
                overflow:       'hidden',
                maxHeight:      visible ? '800px' : '0',
                opacity:        visible ? 1 : 0,
                marginBottom:   visible ? undefined : '0',
                transition:     'max-height 0.3s cubic-bezier(0.23,1,0.32,1), opacity 0.25s ease-out, margin 0.3s ease',
                pointerEvents:  visible ? 'auto' : 'none',
              }}>
              {!['seccion', 'checkbox', 'header_image', 'parrafo'].includes(campo.tipo as string) && (
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
              {/* Hint dinámico para referencia de pago según método seleccionado */}
              {campo.id === 'referencia_pago' && valores['metodo_pago'] && (
                <p className="text-xs text-[#1a7de0] bg-blue-50 rounded-lg px-3 py-2 mt-1.5 font-medium">
                  💡 {METODOS_PAGO_INFO[valores['metodo_pago']]?.hint ?? 'Ingresa tu referencia de pago.'}
                </p>
              )}
              {errors[campo.id] && (
                <p className="text-xs text-red-500 font-medium mt-1">{errors[campo.id]}</p>
              )}
            </div>
            )
          })}

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
              text-white font-bold text-sm shadow-lg cursor-pointer
              hover:shadow-xl hover:scale-[1.01] transition-all active:scale-[0.99]
              disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
            style={{ background: submitting || !valores['__terminos'] ? '#F97316' : '#F97316' }}>
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
              : <><Check className="w-4 h-4" /> Enviar formulario</>
            }
          </button>
          </div>{/* cierre p-6 */}
        </div>{/* cierre card */}
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
                className="w-full py-3.5 rounded-2xl text-white font-bold text-sm
                  active:scale-[0.98] transition-all cursor-pointer shadow-md"
                style={{ background: color }}
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
