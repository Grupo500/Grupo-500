'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Poppins } from 'next/font/google'
import {
  ChevronLeft, ChevronRight, Check, Upload, Loader2,
  User, MapPin, Users, BookOpen, CreditCard, Heart,
} from 'lucide-react'
import { DEPARTAMENTOS_MUNICIPIOS, DEPARTAMENTOS } from '@/data/municipios'

const poppins = Poppins({ subsets: ['latin'], weight: ['400', '600', '700', '800'] })

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Curso {
  id: string
  nombre: string
  precioGeneral: number
  preciosPromo: number[]
  fechaInicio?: string
  fechaFin?: string
  calendario: string
}

interface FormData {
  // Paso 1
  nombre: string
  email: string
  telefono: string
  tipoDocumento: string
  documento: string
  // Paso 2
  fechaNacimiento: string
  departamento: string
  ciudad: string
  colegio: string
  grado: string
  // Paso 3
  acudienteNombre: string
  acudienteParentesco: string
  acudienteParentescoOtro: string
  acudienteTelefono: string
  acudienteTipoDocumento: string
  acudienteNumeroDocumento: string
  // Paso 4
  primerIcfes: boolean
  puntajeAnterior: string
  carreraInteres: string
  interesSalud: boolean
  interesPremedico: string
  universidadInteres: string
  universidadOtro: string
  // Paso 5
  cursoId: string
  cuentaPago: string
  montoDeclarado: number
  comprobanteUrl: string
  comprobantePublicId: string
  documentoUrl: string
  // Paso 6
  fuenteContacto: string
  fuenteOtro: string
  aceptaTerminos: boolean
}

const INITIAL: FormData = {
  nombre: '', email: '', telefono: '', tipoDocumento: 'TI', documento: '',
  fechaNacimiento: '', departamento: '', ciudad: '', colegio: '', grado: '',
  acudienteNombre: '', acudienteParentesco: 'Mamá', acudienteParentescoOtro: '',
  acudienteTelefono: '', acudienteTipoDocumento: 'CC', acudienteNumeroDocumento: '',
  primerIcfes: true, puntajeAnterior: '', carreraInteres: '', interesSalud: false,
  interesPremedico: '', universidadInteres: '', universidadOtro: '',
  cursoId: '', cuentaPago: 'Bancolombia - GRUPO 500 EDUCACION S.A.S', montoDeclarado: 0,
  comprobanteUrl: '', comprobantePublicId: '', documentoUrl: '',
  fuenteContacto: '', fuenteOtro: '', aceptaTerminos: false,
}

const PASOS = [
  { icon: User,       label: 'Tus datos'    },
  { icon: MapPin,     label: 'Ubicación'    },
  { icon: Users,      label: 'Acudiente'   },
  { icon: BookOpen,   label: 'Académico'   },
  { icon: CreditCard, label: 'Pago'        },
  { icon: Heart,      label: 'Finalizar'   },
]

const UNIVERSIDADES = [
  'Universidad Industrial de Santander UIS',
  'Universidad Autónoma de Bucaramanga UNAB',
  'Universidad de Pamplona',
  'Universidad Nacional de Colombia UNAL',
  'Universidad Javeriana',
  'Universidad Pontificia Bolivariana',
  'Universidad de Antioquia UDEA',
  'Universidad del Valle UNIVALLE',
  'Universidad Pedagógica y Tecnológica UPTC',
  'Universidad Libre',
  'Universidad de Cartagena',
  'Otra',
]

const FUENTES = [
  'Vi un video con link a WhatsApp en Instagram',
  'Vi un video en Instagram y escribí al perfil o número del video',
  'Vi un video con link a WhatsApp en TikTok',
  'Vi un video en TikTok y escribí al perfil o número del video',
  'Vi un video con link a WhatsApp en Facebook',
  'Vi un video en Facebook y escribí al perfil o número del video',
  'Vi un anuncio de YouTube y le di click',
  'Los encontré en el buscador de Google',
  'Me lo recomendó un amigo / familiar / conocido',
  'Otro',
]

// ── Componentes de campo ──────────────────────────────────────────────────────
function Field({ label, error, children, hint }: {
  label: string; error?: string; children: React.ReactNode; hint?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      {hint && <p className="text-xs text-slate-500 -mt-0.5">{hint}</p>}
      {children}
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  )
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-800 text-sm
        focus:outline-none focus:border-[#21b9f7] transition-colors placeholder:text-slate-400
        disabled:bg-slate-50 disabled:text-slate-400 ${props.className ?? ''}`}
    />
  )
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-800 text-sm
        focus:outline-none focus:border-[#21b9f7] transition-colors cursor-pointer
        disabled:bg-slate-50 ${props.className ?? ''}`}
    >
      {children}
    </select>
  )
}

// ── Toggle Sí/No ──────────────────────────────────────────────────────────────
function Toggle({ value, onChange, labelSi = 'Sí', labelNo = 'No' }: {
  value: boolean; onChange: (v: boolean) => void; labelSi?: string; labelNo?: string
}) {
  return (
    <div className="flex gap-3">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all cursor-pointer
            ${value === v
              ? 'bg-[#21b9f7] border-[#21b9f7] text-white shadow-md'
              : 'bg-white border-slate-200 text-slate-600 hover:border-[#21b9f7]/50'
            }`}
        >
          {v ? labelSi : labelNo}
        </button>
      ))}
    </div>
  )
}

// ── Upload campo ──────────────────────────────────────────────────────────────
function UploadField({ label, hint, endpoint, onSuccess, uploaded }: {
  label: string; hint?: string; endpoint: string
  onSuccess: (url: string, publicId: string) => void
  uploaded: boolean
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch(`${API}/${endpoint}`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al subir')
      onSuccess(json.data.url, json.data.publicId ?? json.data.filename ?? '')
    } catch (err: any) {
      setError(err.message ?? 'Error al subir el archivo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all
        ${uploaded
          ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
          : 'border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:border-[#21b9f7] hover:bg-blue-50'
        }`}>
        {uploading
          ? <Loader2 className="w-5 h-5 animate-spin shrink-0" />
          : uploaded
            ? <Check className="w-5 h-5 shrink-0" />
            : <Upload className="w-5 h-5 shrink-0" />
        }
        <span className="text-sm font-medium">
          {uploading ? 'Subiendo...' : uploaded ? 'Archivo cargado ✓' : 'Toca para seleccionar'}
        </span>
        <input type="file" accept="image/*,application/pdf" onChange={handleFile} className="hidden" disabled={uploading} />
      </label>
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function FormularioPage() {
  const params       = useParams()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const calId        = params.calId as string

  const [paso,    setPaso]    = useState(0)
  const [form,    setForm]    = useState<FormData>({ ...INITIAL, cursoId: calId })
  const [errors,  setErrors]  = useState<Partial<Record<keyof FormData, string>>>({})
  const [curso,   setCurso]   = useState<Curso | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [exito,   setExito]   = useState(false)
  const [errorGlobal, setErrorGlobal] = useState('')
  const [terminosUrl, setTerminosUrl] = useState('https://res.cloudinary.com/dbc1cm3hq/raw/upload/v1780155655/grupo500/documentos/terminos-condiciones-grupo500.pdf')

  // Pre-llenar asesorId desde query param
  useEffect(() => {
    const asesorId = searchParams.get('asesor')
    if (asesorId) setForm(f => ({ ...f, asesorId } as any))
  }, [searchParams])

  // Cargar URL de T&C
  useEffect(() => {
    fetch(`${API}/inscripcion/terminos`)
      .then(r => r.json())
      .then(d => { if (d.success && d.data?.url) setTerminosUrl(d.data.url) })
      .catch(() => {})
  }, [])

  // Cargar datos del curso
  useEffect(() => {
    fetch(`${API}/inscripcion/cursos/${calId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setCurso(d.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [calId])

  const set = useCallback((key: keyof FormData, value: any) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }, [])

  // ── Municipios filtrados ────────────────────────────────────────────────────
  const municipios = form.departamento ? (DEPARTAMENTOS_MUNICIPIOS[form.departamento] ?? []) : []

  // ── Opciones de monto ───────────────────────────────────────────────────────
  const opcionesMontoBase = curso ? [
    { label: `$${curso.precioGeneral.toLocaleString('es-CO')} — Precio general`, value: curso.precioGeneral },
    ...curso.preciosPromo.map(p => ({ label: `$${p.toLocaleString('es-CO')} — Precio promoción`, value: p })),
    { label: `$${Math.round(curso.precioGeneral * 0.5).toLocaleString('es-CO')} — 50% pago inicial`, value: Math.round(curso.precioGeneral * 0.5) },
    ...curso.preciosPromo.map(p => ({ label: `$${Math.round(p * 0.5).toLocaleString('es-CO')} — 50% precio promoción`, value: Math.round(p * 0.5) })),
  ] : []

  // ── Validaciones por paso ───────────────────────────────────────────────────
  function validarPaso(p: number): boolean {
    const e: Partial<Record<keyof FormData, string>> = {}

    if (p === 0) {
      if (!form.nombre.trim())      e.nombre   = 'Nombre requerido'
      if (!form.email.trim())       e.email    = 'Email requerido'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email inválido'
      if (!form.telefono.trim())    e.telefono = 'Celular requerido'
      if (!form.documento.trim())   e.documento = 'Número de documento requerido'
    }
    if (p === 1) {
      if (!form.fechaNacimiento)    e.fechaNacimiento = 'Fecha de nacimiento requerida'
      if (!form.departamento)       e.departamento = 'Selecciona tu departamento'
      if (!form.ciudad)             e.ciudad = 'Selecciona tu municipio'
      if (!form.colegio.trim())     e.colegio = 'Colegio requerido'
      if (!form.grado)              e.grado = 'Selecciona tu grado'
    }
    if (p === 2) {
      if (!form.acudienteNombre.trim())    e.acudienteNombre = 'Nombre del acudiente requerido'
      if (!form.acudienteTelefono.trim())  e.acudienteTelefono = 'Celular del acudiente requerido'
      if (!form.acudienteNumeroDocumento.trim()) e.acudienteNumeroDocumento = 'Documento del acudiente requerido'
    }
    if (p === 3) {
      if (!form.carreraInteres.trim()) e.carreraInteres = 'Escribe la carrera de tu interés'
    }
    if (p === 4) {
      if (form.montoDeclarado <= 0) e.montoDeclarado = 'Selecciona cuánto consignaste'
    }
    if (p === 5) {
      if (!form.fuenteContacto) e.fuenteContacto = '¿Cómo nos conociste?'
      if (!form.aceptaTerminos) e.aceptaTerminos = 'Debes aceptar los términos y condiciones'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  function siguiente() {
    if (validarPaso(paso)) setPaso(p => p + 1)
  }

  function anterior() {
    setPaso(p => Math.max(0, p - 1))
    setErrors({})
  }

  async function enviar() {
    if (!validarPaso(5)) return
    setSubmitting(true)
    setErrorGlobal('')
    try {
      const payload = {
        nombre:          form.nombre.trim(),
        email:           form.email.trim().toLowerCase(),
        telefono:        form.telefono.trim(),
        tipoDocumento:   form.tipoDocumento,
        documento:       form.documento.trim(),
        fechaNacimiento: form.fechaNacimiento,
        departamento:    form.departamento,
        ciudad:          form.ciudad,
        colegio:         form.colegio.trim(),
        grado:           form.grado,
        acudienteNombre:          form.acudienteNombre.trim(),
        acudienteParentesco:      form.acudienteParentesco === 'Otro' ? form.acudienteParentescoOtro : form.acudienteParentesco,
        acudienteTelefono:        form.acudienteTelefono.trim(),
        acudienteTipoDocumento:   form.acudienteTipoDocumento,
        acudienteNumeroDocumento: form.acudienteNumeroDocumento.trim(),
        primerIcfes:       form.primerIcfes,
        puntajeAnterior:   form.primerIcfes ? 'N/A' : form.puntajeAnterior,
        carreraInteres:    form.carreraInteres.trim(),
        interesPremedico:  form.interesPremedico,
        universidadInteres: form.universidadInteres === 'Otra' ? form.universidadOtro : form.universidadInteres,
        cursoId:          form.cursoId || calId,
        cuentaPago:       form.cuentaPago,
        montoDeclarado:   form.montoDeclarado,
        comprobanteUrl:   form.comprobanteUrl || undefined,
        comprobantePublicId: form.comprobantePublicId || undefined,
        documentoUrl:     form.documentoUrl || undefined,
        fuenteContacto:   form.fuenteContacto === 'Otro' ? form.fuenteOtro : form.fuenteContacto,
        aceptaTerminos:   form.aceptaTerminos,
      }

      const res  = await fetch(`${API}/inscripcion/publica`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al procesar tu inscripción')
      setExito(true)
    } catch (err: any) {
      setErrorGlobal(err.message ?? 'Ocurrió un error. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Pantalla de carga ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-[#21b9f7] to-[#1a7de0] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-white animate-spin" />
          <p className="text-white/80 text-sm font-medium">Cargando formulario...</p>
        </div>
      </div>
    )
  }

  // ── Pantalla de éxito ───────────────────────────────────────────────────────
  if (exito) {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-[#21b9f7] to-[#1a7de0] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
            <Check className="w-10 h-10 text-emerald-500" strokeWidth={2.5} />
          </div>
          <h1 className={`${poppins.className} text-2xl font-bold text-slate-800 mb-2`}>
            ¡Ya eres parte de Grupo 500!
          </h1>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            Tu inscripción fue recibida exitosamente. En breve te contactamos para confirmar tu pago y
            agregarte al grupo de WhatsApp.
          </p>
          <div className="bg-[#21b9f7]/10 rounded-2xl p-4 mb-6 text-left space-y-2">
            <p className="text-sm font-semibold text-[#1a7de0]">Próximos pasos:</p>
            <p className="text-sm text-slate-600">1. Envía tu comprobante de pago por WhatsApp</p>
            <p className="text-sm text-slate-600">2. Espera la confirmación de tu asesor</p>
            <p className="text-sm text-slate-600">3. Te agregaremos al grupo de WhatsApp del curso</p>
          </div>
          <a
            href="https://wa.me/573168819037"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 rounded-xl bg-[#25D366] text-white text-sm font-bold text-center cursor-pointer hover:opacity-90 transition-opacity"
          >
            Enviar comprobante por WhatsApp
          </a>
          <button
            onClick={() => router.push('/')}
            className="mt-3 text-sm text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            Volver al inicio
          </button>
        </div>
        <p className="text-white/50 text-xs mt-6">Desarrollado por NexCode97</p>
      </div>
    )
  }

  // ── Formulario ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#21b9f7] to-[#1a7de0] flex flex-col">
      {/* Header */}
      <header className="w-full pt-6 pb-4 px-5 flex items-center gap-3">
        <button onClick={() => router.push('/inscripcion')} className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors cursor-pointer">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <div>
          <p className={`${poppins.className} text-white font-bold text-base leading-tight`}>
            {curso?.nombre ?? 'Formulario de Inscripción'}
          </p>
          <p className="text-white/70 text-xs">Calendario {curso?.calendario ?? ''} · Pre-ICFES Grupo 500</p>
        </div>
      </header>

      {/* Barra de progreso de pasos */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-1">
          {PASOS.map((p, i) => {
            const Icon = p.icon
            const done    = i < paso
            const current = i === paso
            return (
              <div key={i} className="flex items-center flex-1">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all shrink-0
                  ${done    ? 'bg-white text-[#21b9f7]'
                  : current ? 'bg-white text-[#21b9f7] shadow-lg scale-110'
                  :           'bg-white/30 text-white/60'}`}
                >
                  {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                {i < PASOS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 rounded-full transition-all ${i < paso ? 'bg-white' : 'bg-white/30'}`} />
                )}
              </div>
            )
          })}
        </div>
        <p className="text-white/80 text-xs mt-2 font-medium">
          Paso {paso + 1} de {PASOS.length} — {PASOS[paso].label}
        </p>
      </div>

      {/* Card del formulario */}
      <main className="flex-1 px-4 pb-8">
        <div className="bg-white rounded-3xl shadow-2xl p-6 space-y-5">
          {/* ── Paso 1: Datos del estudiante ── */}
          {paso === 0 && (
            <>
              <h2 className={`${poppins.className} text-lg font-bold text-slate-800`}>
                Cuéntanos sobre ti
              </h2>
              <Field label="Nombres y Apellidos completos" error={errors.nombre}>
                <Input value={form.nombre} onChange={e => set('nombre', e.target.value)}
                  placeholder="Ej: María Fernanda González Ruiz" autoComplete="name" />
              </Field>
              <Field label="Correo electrónico de Google (@gmail.com)" error={errors.email}
                hint="Por este correo te daremos acceso a simulacros y clases grabadas">
                <Input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="tucorreo@gmail.com" autoComplete="email" inputMode="email" />
              </Field>
              <Field label="Número de celular" error={errors.telefono}
                hint="Este número será agregado al grupo de WhatsApp. ¡Escríbelo bien!">
                <Input type="tel" value={form.telefono} onChange={e => set('telefono', e.target.value)}
                  placeholder="3XX XXX XXXX" inputMode="tel" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo de documento" error={errors.tipoDocumento}>
                  <Select value={form.tipoDocumento} onChange={e => set('tipoDocumento', e.target.value)}>
                    <option value="TI">Tarjeta de Identidad</option>
                    <option value="CC">Cédula de Ciudadanía</option>
                    <option value="CE">Cédula Extranjería</option>
                    <option value="PA">Pasaporte</option>
                    <option value="Otro">Otro</option>
                  </Select>
                </Field>
                <Field label="Número de documento" error={errors.documento}>
                  <Input value={form.documento} onChange={e => set('documento', e.target.value)}
                    placeholder="Número" inputMode="numeric" />
                </Field>
              </div>
            </>
          )}

          {/* ── Paso 2: Ubicación y colegio ── */}
          {paso === 1 && (
            <>
              <h2 className={`${poppins.className} text-lg font-bold text-slate-800`}>
                ¿Dónde vives?
              </h2>
              <Field label="Fecha de nacimiento" error={errors.fechaNacimiento}>
                <Input type="date" value={form.fechaNacimiento} onChange={e => set('fechaNacimiento', e.target.value)}
                  max={new Date().toISOString().split('T')[0]} />
              </Field>
              <Field label="Departamento" error={errors.departamento}>
                <Select value={form.departamento} onChange={e => {
                  set('departamento', e.target.value)
                  set('ciudad', '')
                }}>
                  <option value="">Selecciona tu departamento</option>
                  {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                </Select>
              </Field>
              <Field label="Municipio" error={errors.ciudad}>
                <Select value={form.ciudad} onChange={e => set('ciudad', e.target.value)}
                  disabled={!form.departamento}>
                  <option value="">
                    {form.departamento ? 'Selecciona tu municipio' : 'Primero selecciona el departamento'}
                  </option>
                  {municipios.map(m => <option key={m} value={m}>{m}</option>)}
                </Select>
              </Field>
              <Field label="¿En qué colegio estudias o estudiaste?" error={errors.colegio}>
                <Input value={form.colegio} onChange={e => set('colegio', e.target.value)}
                  placeholder="Nombre completo del colegio" />
              </Field>
              <Field label="Grado actual" error={errors.grado}>
                <Select value={form.grado} onChange={e => set('grado', e.target.value)}>
                  <option value="">Selecciona tu grado</option>
                  <option value="10°">10°</option>
                  <option value="11°">11°</option>
                  <option value="Egresado">Ya me gradué (egresado)</option>
                </Select>
              </Field>
            </>
          )}

          {/* ── Paso 3: Acudiente ── */}
          {paso === 2 && (
            <>
              <h2 className={`${poppins.className} text-lg font-bold text-slate-800`}>
                Datos del acudiente
              </h2>
              <Field label="Nombre completo del acudiente" error={errors.acudienteNombre}>
                <Input value={form.acudienteNombre} onChange={e => set('acudienteNombre', e.target.value)}
                  placeholder="Nombres y apellidos completos" />
              </Field>
              <Field label="Parentesco" error={errors.acudienteParentesco}>
                <Select value={form.acudienteParentesco} onChange={e => set('acudienteParentesco', e.target.value)}>
                  <option value="Mamá">Mamá</option>
                  <option value="Papá">Papá</option>
                  <option value="Otro">Otro</option>
                </Select>
              </Field>
              {form.acudienteParentesco === 'Otro' && (
                <Field label="Especifica el parentesco">
                  <Input value={form.acudienteParentescoOtro} onChange={e => set('acudienteParentescoOtro', e.target.value)}
                    placeholder="Tío, tutor, hermano..." />
                </Field>
              )}
              <Field label="Celular del acudiente" error={errors.acudienteTelefono}
                hint="Este número NO será agregado al grupo de WhatsApp, es solo de respaldo">
                <Input type="tel" value={form.acudienteTelefono} onChange={e => set('acudienteTelefono', e.target.value)}
                  placeholder="3XX XXX XXXX" inputMode="tel" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo documento acudiente">
                  <Select value={form.acudienteTipoDocumento} onChange={e => set('acudienteTipoDocumento', e.target.value)}>
                    <option value="CC">Cédula Ciudadanía</option>
                    <option value="CE">Cédula Extranjería</option>
                    <option value="PA">Pasaporte</option>
                    <option value="Otro">Otro</option>
                  </Select>
                </Field>
                <Field label="Número documento" error={errors.acudienteNumeroDocumento}>
                  <Input value={form.acudienteNumeroDocumento}
                    onChange={e => set('acudienteNumeroDocumento', e.target.value)}
                    placeholder="Número" inputMode="numeric" />
                </Field>
              </div>
            </>
          )}

          {/* ── Paso 4: Información académica ── */}
          {paso === 3 && (
            <>
              <h2 className={`${poppins.className} text-lg font-bold text-slate-800`}>
                Tu perfil académico
              </h2>
              <Field label="¿Es tu primer ICFES?">
                <Toggle value={form.primerIcfes} onChange={v => set('primerIcfes', v)} />
              </Field>
              {!form.primerIcfes && (
                <Field label="¿Cuánto sacaste en tu última prueba?"
                  hint="Si no recuerdas el puntaje exacto, escribe un aproximado">
                  <Input value={form.puntajeAnterior} onChange={e => set('puntajeAnterior', e.target.value)}
                    placeholder="Ej: 320 puntos" />
                </Field>
              )}
              <Field label="¿A qué carrera quieres ingresar?" error={errors.carreraInteres}
                hint="Si no estás seguro, escribe las dos carreras que más te llaman la atención">
                <Input value={form.carreraInteres} onChange={e => set('carreraInteres', e.target.value)}
                  placeholder="Ej: Medicina, Ingeniería de Sistemas" />
              </Field>
              <Field label="¿Te interesa estudiar alguna carrera de la salud?">
                <Toggle
                  value={form.interesSalud}
                  onChange={v => set('interesSalud', v)}
                  labelSi="Sí, área de la salud"
                  labelNo="No, otra área"
                />
              </Field>
              {form.interesSalud && (
                <Field label="¿Te gustaría inscribirte en nuestro curso Premédico?"
                  hint="Anatomía, Fisiología, Histología, Bioquímica y más. Precio especial por ser parte de Grupo 500">
                  <Select value={form.interesPremedico} onChange={e => set('interesPremedico', e.target.value)}>
                    <option value="">Selecciona una opción</option>
                    <option value="Sí, mándame la información">Sí, mándame la información</option>
                    <option value="Tal vez, si me gusta el preicfes me inscribo">Tal vez, si me gusta el preicfes me inscribo</option>
                    <option value="Tal vez, ahorita no tengo el dinero pero en un futuro miramos">Tal vez, en un futuro miramos</option>
                    <option value="No, mi carrera no necesita esos conocimientos">No, mi carrera no necesita esos conocimientos</option>
                  </Select>
                </Field>
              )}
              <Field label="¿A qué universidad quisieras ingresar?">
                <Select value={form.universidadInteres} onChange={e => set('universidadInteres', e.target.value)}>
                  <option value="">Selecciona tu universidad</option>
                  {UNIVERSIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </Select>
              </Field>
              {form.universidadInteres === 'Otra' && (
                <Field label="¿Cuál universidad?">
                  <Input value={form.universidadOtro} onChange={e => set('universidadOtro', e.target.value)}
                    placeholder="Nombre de la universidad" />
                </Field>
              )}
            </>
          )}

          {/* ── Paso 5: Pago ── */}
          {paso === 4 && (
            <>
              <h2 className={`${poppins.className} text-lg font-bold text-slate-800`}>
                Información de pago
              </h2>
              <Field label="¿A qué cuenta consignaste el dinero?">
                <Select value={form.cuentaPago} onChange={e => set('cuentaPago', e.target.value)}>
                  <option value="Bancolombia - GRUPO 500 EDUCACION S.A.S">
                    Bancolombia — GRUPO 500 EDUCACION S.A.S
                  </option>
                  <option value="Otra">Otra cuenta</option>
                </Select>
              </Field>
              <Field label="¿Cuánto dinero consignaste?" error={errors.montoDeclarado as string}>
                <Select
                  value={form.montoDeclarado || ''}
                  onChange={e => set('montoDeclarado', parseFloat(e.target.value) || 0)}
                >
                  <option value="">Selecciona el valor</option>
                  {opcionesMontoBase.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Field>
              <UploadField
                label="Comprobante de pago"
                hint="Sube la foto o PDF de tu transferencia (opcional pero recomendado)"
                endpoint="inscripcion/upload-comprobante"
                uploaded={!!form.comprobanteUrl}
                onSuccess={(url, publicId) => {
                  set('comprobanteUrl', url)
                  set('comprobantePublicId', publicId)
                }}
              />
              <UploadField
                label="Documento de identidad"
                hint="Foto de tu cédula o tarjeta de identidad (opcional)"
                endpoint="inscripcion/upload-documento"
                uploaded={!!form.documentoUrl}
                onSuccess={(url) => set('documentoUrl', url)}
              />
            </>
          )}

          {/* ── Paso 6: Marketing + T&C ── */}
          {paso === 5 && (
            <>
              <h2 className={`${poppins.className} text-lg font-bold text-slate-800`}>
                Casi listo 🎯
              </h2>
              <Field label="¿Cómo te enteraste de Grupo 500?" error={errors.fuenteContacto as string}>
                <Select value={form.fuenteContacto} onChange={e => set('fuenteContacto', e.target.value)}>
                  <option value="">Selecciona una opción</option>
                  {FUENTES.map(f => <option key={f} value={f}>{f}</option>)}
                </Select>
              </Field>
              {form.fuenteContacto === 'Otro' && (
                <Field label="¿Cómo exactamente?">
                  <Input value={form.fuenteOtro} onChange={e => set('fuenteOtro', e.target.value)}
                    placeholder="Cuéntanos cómo nos conociste" />
                </Field>
              )}
              {/* T&C */}
              <div className="rounded-2xl border-2 border-slate-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-700">Términos y condiciones del curso</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Lee los términos y condiciones antes de inscribirte.{' '}
                  <a
                    href="https://res.cloudinary.com/dbc1cm3hq/raw/upload/v1780155655/grupo500/documentos/terminos-condiciones-grupo500.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1a7de0] underline font-medium"
                  >
                    Ver documento
                  </a>
                </p>
                <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl transition-colors
                  ${form.aceptaTerminos ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50'}`}>
                  <input
                    type="checkbox"
                    checked={form.aceptaTerminos}
                    onChange={e => set('aceptaTerminos', e.target.checked)}
                    className="mt-0.5 w-5 h-5 accent-[#21b9f7] cursor-pointer shrink-0"
                  />
                  <span className="text-sm text-slate-700">
                    He leído y acepto los términos y condiciones del curso. Si soy menor de edad,
                    mi acudiente también los ha aceptado.
                  </span>
                </label>
                {errors.aceptaTerminos && (
                  <p className="text-xs text-red-500 font-medium">{errors.aceptaTerminos}</p>
                )}
              </div>
              {errorGlobal && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                  <p className="text-sm text-red-600 font-medium">{errorGlobal}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Botones de navegación */}
        <div className="flex gap-3 mt-5">
          {paso > 0 && (
            <button
              onClick={anterior}
              className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-white/20 text-white text-sm font-semibold
                hover:bg-white/30 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              Atrás
            </button>
          )}
          {paso < PASOS.length - 1 ? (
            <button
              onClick={siguiente}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white text-[#21b9f7]
                text-sm font-bold shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all cursor-pointer"
            >
              Continuar
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={enviar}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#F97316] text-white
                text-sm font-bold shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all cursor-pointer
                disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                : <><Check className="w-4 h-4" /> ¡Inscribirme ahora!</>
              }
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
