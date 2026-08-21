'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { formatCOP, cn, montoPagadoPago, hoyColombia } from '@/lib/utils'
import { planDeCuotas } from '@/lib/cuotas'
import {
  ArrowLeft, Pencil, Trash2, Loader2, User, BookOpen,
  Phone, Mail, Users, CreditCard, Award,
  Wallet, CheckCircle, AlertTriangle, Paperclip,
  Save, ChevronDown, ChevronUp, Download, Clock, Receipt, Check, X, Maximize2,
  type LucideIcon,
} from 'lucide-react'
import { VerComprobante } from '@/components/ui/VerComprobante'
import { Select } from '@/components/ui/Select'
import { TIPOS as TIPOS_CERTIFICADO, generarPDF, horasPorNombreCurso, type Certificado, type Firmas } from '@/lib/certificados'
import type { CertificadoData } from '@/components/certificados/CertificadoTemplate'
import { DEPARTAMENTOS, getMunicipios } from '@/lib/colombia'

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Pago {
  id: string; monto: number
  estado: 'PENDIENTE' | 'PAGADO' | 'VENCIDO' | 'CANCELADO'
  metodo: string; fechaVencimiento: string
  // El "HP": el código con el que Hotmart identifica la compra. Null en los
  // pagos registrados a mano, que no pasaron por Hotmart.
  referenciaPago?: string | null
  fechaPago?: string; comprobante?: string
  createdAt: string; notas?: string
  asesor?: { nombre: string }
  enPartes?: boolean; cuotaNumero?: number | null; cuotasTotal?: number | null
}
interface EstudianteDetalle {
  id: string; nombre: string
  tipoDocumento?: string; documento?: string; documentoUrl?: string | null
  email: string; telefono: string; fechaNacimiento: string
  departamento?: string; ciudad?: string
  colegio?: { id: string; nombre: string; ciudad?: string }
  acudiente?: { nombre: string; email: string; telefono: string; relacion: string }
  asesor?: { id: string; nombre: string }
  lineaAutorizada?: number | null
  agregado?: boolean
  nombreGrupo?: string | null
  verificado?: boolean
  verificadoPor?: string | null
  verificadoAt?: string | null
  cursos?: {
    id: string; cursoId: string; descuentoPorcentaje: number; precioAcordado?: number | null
    // El endpoint devuelve el curso entero; estos campos van impresos en el
    // certificado, por eso estan aqui y no solo nombre/precio.
    curso: {
      id: string; nombre: string; precio: number
      duracionHoras?: number; materias?: string[]; simulacros?: number | null
      horarioTexto?: string | null; fechaInicio?: string | null; fechaFin?: string | null
    }
  }[]
  pagos?: Pago[]
  createdAt: string
}

// ── Helpers ────────────────────────────────────────────────────────────────
function esUrlValida(s: string | null | undefined): boolean {
  return !!s && /^https?:\/\//i.test(s.trim())
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

type Tab = 'perfil' | 'financiero' | 'certificados'
const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'perfil',         label: 'Perfil',         icon: User    },
  { key: 'financiero',     label: 'Financiero',     icon: Wallet  },
  { key: 'certificados',   label: 'Certificados',   icon: Award   },
]

const inputCls = 'w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20'
const labelCls = 'block text-xs font-medium text-on-surface-variant mb-1'

const MEDIOS_PAGO = ['Bancolombia', 'Bre-B', 'Nequi', 'Otro']

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

  // Códigos de Hotmart del estudiante, sin repetir y del más reciente al más
  // viejo. 72 estudiantes tienen más de uno porque compraron varias veces: se
  // muestra el último y el resto queda en el tooltip, en vez de esconderlos.
  const hpTodos = [...new Set(
    (e.pagos ?? [])
      .filter(p => p.referenciaPago)
      .sort((a, b) => new Date(b.fechaPago ?? b.createdAt).getTime() - new Date(a.fechaPago ?? a.createdAt).getTime())
      .map(p => p.referenciaPago as string),
  )]
  const hpPrincipal = hpTodos.length === 0
    ? '—'
    : hpTodos.length === 1
      ? hpTodos[0]
      : `${hpTodos[0]}  +${hpTodos.length - 1}`

  if (!editando) return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-on-surface-variant">Datos personales</p>
          <button onClick={() => setEditando(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-colors cursor-pointer">
            <Pencil className="w-3 h-3" />Editar
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: User,       label: 'Nombre',     value: e.nombre },
            { icon: Mail,       label: 'Email',      value: e.email },
            { icon: Phone,      label: 'Teléfono',   value: e.telefono },
            { icon: Users,      label: 'Asesor',     value: e.asesor?.nombre ?? '—' },
            { icon: CreditCard, label: 'Documento',  value: e.documento ? `${e.tipoDocumento} ${e.documento}` : e.tipoDocumento ?? '—' },
            // El HP no se guarda en el estudiante: se lee de sus pagos, que es
            // donde Hotmart lo deja. Copiarlo al estudiante crearía una segunda
            // versión del dato que se quedaría vieja en cuanto vuelva a comprar.
            { icon: Receipt,    label: 'HP (Hotmart)', value: hpPrincipal, hint: hpTodos.join(' · ') },
          ].map(({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint?: string }) => (
            <div key={label} title={hint} className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-high/60">
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
          <p className="text-xs font-semibold text-on-surface-variant">Curso adquirido</p>
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
          <p className="text-xs font-semibold text-on-surface-variant">Acudiente</p>
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
        <p className="text-xs font-semibold text-on-surface-variant">Editando perfil</p>
        <button onClick={() => setEditando(false)} className="text-xs text-on-surface-variant hover:text-on-surface cursor-pointer">Cancelar</button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="col-span-2 lg:col-span-2">
          <label className={labelCls}>Nombre completo *</label>
          <input className={inputCls} value={form.nombre} onChange={e => f('nombre')(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Tipo doc.</label>
          <Select className={inputCls} value={form.tipoDocumento} onValueChange={f('tipoDocumento')}
            options={['CC','TI','CE','PA','RC'].map(t => ({ value: t, label: t }))} />
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
          <Select className={inputCls} value={form.colegioId} onValueChange={f('colegioId')}
            options={[{ value: '', label: 'Sin colegio' }, ...colegios.map(c => ({ value: c.id, label: c.nombre }))]} />
        </div>
        <div>
          <label className={labelCls}>Departamento</label>
          <Select className={inputCls} value={form.departamento} onValueChange={v => { f('departamento')(v); f('ciudad')('') }}
            options={[{ value: '', label: 'Seleccionar' }, ...DEPARTAMENTOS.map(d => ({ value: d, label: d }))]} />
        </div>
        <div>
          <label className={labelCls}>Ciudad</label>
          <Select className={inputCls} value={form.ciudad} onValueChange={f('ciudad')} disabled={!form.departamento}
            options={[{ value: '', label: 'Seleccionar' }, ...getMunicipios(form.departamento).map(m => ({ value: m, label: m }))]} />
        </div>
        {isAdmin && (
          <>
            <div>
              <label className={labelCls}>Asesor</label>
              <Select className={inputCls} value={form.asesorId} onValueChange={f('asesorId')}
                options={[{ value: '', label: 'Sin asignar' }, ...asesores.map(a => ({ value: a.id, label: a.nombre }))]} />
            </div>
            <div>
              <label className={labelCls}>Línea autorizada</label>
              <Select className={inputCls} value={form.lineaAutorizada} onValueChange={f('lineaAutorizada')}
                options={[{ value: '', label: 'Sin asignar' }, ...[1,2,3,4,5,6].map(n => ({ value: String(n), label: `Línea ${n}` }))]} />
            </div>
            <div>
              <label className={labelCls}>Agregado</label>
              <Select className={inputCls} value={form.agregado} onValueChange={f('agregado')}
                options={[{ value: 'no', label: 'No' }, { value: 'si', label: 'Sí' }]} />
            </div>
            {form.agregado === 'si' && (
              <div>
                <label className={labelCls}>Nombre del grupo</label>
                <input className={inputCls} placeholder="Ej: Grupo WhatsApp A" value={form.nombreGrupo} onChange={e => f('nombreGrupo')(e.target.value)} />
              </div>
            )}
            <div>
              <label className={labelCls}>Curso</label>
              <Select className={inputCls} value={form.cursoId} onValueChange={f('cursoId')} anchoAuto multilinea
                options={[{ value: '', label: 'Sin curso' }, ...cursos.map(c => ({ value: c.id, label: c.nombre }))]} />
            </div>
          </>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold text-on-surface-variant mb-3">Acudiente</p>
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
            <Select className={inputCls} value={form.acudienteRelacion} onValueChange={f('acudienteRelacion')}
              options={['Padre','Madre','Tutor','Hermano/a','Otro'].map(r => ({ value: r, label: r }))} />
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
  const hoy = hoyColombia()
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
      <p className="text-xs font-semibold text-on-surface-variant">Registrar pago directo</p>

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
  const [fechaPago,  setFechaPago]  = useState(hoyColombia())
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
      <p className="text-[11px] font-semibold text-primary">Editando pago directo</p>

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
          <p className="text-[11px] font-semibold text-primary">Confirmar pago</p>
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
  const pagos = e.pagos ?? []
  const hoy = new Date()

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
    : pagos.reduce((s, p) => s + p.monto, 0)

  // Compras a plazos: las cuotas que Hotmart aún no ha cobrado no existen como
  // registro, así que se derivan aquí. Se recalcula en cada render, de modo que
  // el atraso siempre corresponde al día de hoy sin depender de ningún proceso.
  const plan = planDeCuotas(pagos)

  const totalPagado    = pagos.filter(p => p.estado === 'PAGADO').reduce((s, p) => s + montoPagadoPago(p), 0)
  // Con plan a plazos lo pendiente es lo que falta por cobrar, que es más fiel
  // que restar del precio del curso: puede haber diferencias de redondeo.
  const totalPendiente = plan.enPlazos ? plan.pendiente : Math.max(0, totalGeneral - totalPagado)
  const progreso       = totalGeneral > 0 ? Math.min(100, (totalPagado / totalGeneral) * 100) : 0
  const totalMora      = plan.mora
    + pagos.filter(p => p.estado === 'VENCIDO').reduce((s, p) => s + p.monto, 0)

  const [nuevoPagoAbierto, setNuevoPagoAbierto] = useState(false)

  // Sin curso ni pagos → realmente vacío
  if (!cursoEst && pagos.length === 0) return (
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
          { label: plan.enPlazos ? `Pagado · ${plan.cuotasPagadas} de ${plan.cuotasTotal} cuotas` : 'Pagado', value: formatCOP(totalPagado), color: 'text-[#16a34a]' },
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

      {/* Cuotas por cobrar. No existen en la base —Hotmart solo registra lo que
          ya cobró— así que se muestran derivadas del plan. */}
      {plan.esperadas.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-on-surface-variant">
            Cuotas por cobrar
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
            {plan.esperadas.map(c => (
              <div
                key={c.numero}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 border',
                  c.vencida
                    ? 'border-[#dc2626]/30 bg-[#dc2626]/[0.06]'
                    : 'border-outline-variant/60 bg-surface-high/40',
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {c.vencida
                    ? <AlertTriangle className="w-4 h-4 shrink-0 text-[#dc2626]" />
                    : <Clock className="w-4 h-4 shrink-0 text-on-surface-variant" />}
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-on-surface">
                      Cuota {c.numero} de {plan.cuotasTotal}
                    </p>
                    <p className={cn('text-[11px]', c.vencida ? 'text-[#dc2626]' : 'text-on-surface-variant')}>
                      {c.vencida
                        ? `Vencida hace ${c.diasAtraso} ${c.diasAtraso === 1 ? 'día' : 'días'} · ${c.fechaEsperada.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}`
                        : `Se cobra el ${c.fechaEsperada.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}`}
                    </p>
                  </div>
                </div>
                <span className={cn('text-[13px] font-bold tabular-nums shrink-0',
                  c.vencida ? 'text-[#dc2626]' : 'text-on-surface')}>
                  {formatCOP(c.monto)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-on-surface-variant">
            Fechas estimadas a partir del último cobro. Hotmart registra la cuota cuando efectivamente la cobra.
          </p>
        </section>
      )}


      {/* Pagos directos */}
      {pagos.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-on-surface-variant">Pagos directos</p>
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

    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// TAB CERTIFICADOS
// ══════════════════════════════════════════════════════════════════════════
// ── Certificados ───────────────────────────────────────────────────────────
// La plantilla del certificado pesa (fuentes, logos, firmas en base64) y solo
// hace falta en esta pestaña: se carga aparte.
const VistaPreviaCertificado = dynamic(
  () => import('@/components/certificados/VistaPreviaCertificado').then(m => m.VistaPreviaCertificado),
  { ssr: false, loading: () => <HojaCargando /> },
)

const ANCHO_PREVIA = 190

function HojaCargando() {
  return (
    <div
      className="grid place-items-center rounded-md border border-outline-variant bg-surface-lowest"
      style={{ width: ANCHO_PREVIA, height: Math.round((1123 / 794) * ANCHO_PREVIA) }}
    >
      <Loader2 className="w-4 h-4 animate-spin text-on-surface-variant opacity-50" />
    </div>
  )
}

/**
 * Una línea de "lo que va impreso".
 *
 * Cada dato dice si está o si falta antes de emitir, porque el certificado es
 * un documento que sale firmado: enterarse de que iba sin documento después de
 * entregarlo obliga a rehacerlo (Hotman, 21-ago).
 */
function DatoImpreso({ ok, etiqueta, children }: {
  ok: boolean
  etiqueta: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[16px_1fr_auto] items-center gap-2.5 border-t border-outline-variant/55 py-2 text-[12.5px] first:border-t-0">
      <span className={cn(
        'grid w-4 h-4 place-items-center rounded-full',
        ok ? 'bg-[#16a34a]/15 text-[#16a34a]' : 'bg-[#d97706]/20 text-[#d97706]',
      )}>
        {ok
          ? <Check className="w-2.5 h-2.5" strokeWidth={3.5} />
          : <AlertTriangle className="w-2.5 h-2.5" />}
      </span>
      <span className="text-on-surface-variant">{etiqueta}</span>
      <span className="min-w-0 truncate text-right font-medium text-on-surface">{children}</span>
    </div>
  )
}

/**
 * El certificado a tamaño de lectura, encima de la pantalla.
 *
 * Es la misma plantilla del PDF, no un visor de PDF: armar el archivo solo
 * para mirarlo obliga a esperar el render a imagen y en el teléfono muchos
 * navegadores ni siquiera lo muestran dentro de la página. Lo que se ve aquí
 * es exactamente lo que sale al descargar (Hotman, 21-ago).
 */
function ModalCertificado({ data, etiqueta, onCerrar, onDescargar, descargando }: {
  data: CertificadoData
  etiqueta: string
  onCerrar: () => void
  onDescargar: () => void
  descargando: boolean
}) {
  // La hoja se agranda hasta donde quepa: limitada por el ancho de la ventana
  // y, sobre todo, por su alto — es una hoja vertical.
  const [ancho, setAncho] = useState(560)
  const [zoom, setZoom]   = useState(1)
  const caja  = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(1)

  useEffect(() => {
    const medir = () => setAncho(Math.max(260, Math.min(
      720,
      window.innerWidth - 48,
      (window.innerHeight - 150) * (794 / 1123),
    )))
    medir()
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onCerrar() }
    window.addEventListener('resize', medir)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('resize', medir)
      window.removeEventListener('keydown', esc)
    }
  }, [onCerrar])

  /**
   * Mientras esta hoja está abierta, el navegador puede acercar con los dedos.
   *
   * La app trae el zoom bloqueado (`maximumScale: 1` en el viewport) y esa
   * regla es una sola para todas las pantallas — no se puede permitir en un
   * elemento y prohibir en el resto. Se levanta al abrir el certificado y se
   * vuelve a poner al cerrarlo, así el pellizco es el del teléfono, con su
   * inercia y su arrastre, y ninguna otra pantalla queda destrabada (Hotman,
   * 21-ago).
   */
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]')
    if (!meta) return
    const original = meta.getAttribute('content') ?? ''
    meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes')
    return () => { meta.setAttribute('content', original) }
  }, [])

  const alto = Math.round(ancho * (1123 / 794))
  const TOPE = 4

  // El doble clic solo donde hay ratón. En pantalla táctil el doble toque ya
  // lo atiende el navegador, y encadenar los dos acercamientos —el suyo y el
  // nuestro— dejaba la hoja en cualquier parte.
  const conRaton = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches

  /**
   * Cambia el acercamiento dejando quieto el punto del papel que estaba bajo
   * el dedo o el cursor. Sin esto, acercar salta a otra parte de la hoja.
   */
  function acercar(nuevo: number, cx: number, cy: number) {
    const cont = caja.current
    if (!cont) return
    const previo = zoomRef.current
    const limitado = Math.min(TOPE, Math.max(1, nuevo))
    const r = cont.getBoundingClientRect()
    const px = (cont.scrollLeft + cx - r.left) / (ancho * previo)
    const py = (cont.scrollTop  + cy - r.top)  / (alto  * previo)
    zoomRef.current = limitado
    setZoom(limitado)
    requestAnimationFrame(() => {
      cont.scrollLeft = px * ancho * limitado - (cx - r.left)
      cont.scrollTop  = py * alto  * limitado - (cy - r.top)
    })
  }


  return (
    <div
      onClick={onCerrar}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-black/70 p-6 backdrop-blur-sm animate-fade-in"
    >
      <div className="flex w-full max-w-[720px] items-center justify-between gap-3" style={{ maxWidth: ancho }}>
        <p className="truncate text-sm font-semibold text-white">Certificado de {etiqueta}</p>
        <button
          onClick={onCerrar}
          aria-label="Cerrar"
          className="grid w-8 h-8 flex-shrink-0 cursor-pointer place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* La hoja se dibuja una sola vez al tamaño que cabe y el acercamiento
          es un `scale` encima: volver a renderizar la plantilla en cada paso
          del pellizco arrastraba el gesto entero. */}
      <div
        ref={caja}
        onClick={ev => ev.stopPropagation()}
        onDoubleClick={conRaton ? (ev => {
          ev.stopPropagation()
          acercar(zoomRef.current > 1 ? 1 : 2, ev.clientX, ev.clientY)
        }) : undefined}
        className="max-w-full overflow-auto overscroll-contain rounded-md"
        style={{
          maxHeight: alto,
          cursor: conRaton ? (zoom > 1 ? 'zoom-out' : 'zoom-in') : undefined,
        }}
      >
        <div style={{ width: ancho * zoom, height: alto * zoom }}>
          <div style={{ width: ancho, height: alto, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            <VistaPreviaCertificado data={data} ancho={ancho} />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-white/55">
        {!conRaton
          ? 'Junta dos dedos para acercar'
          : zoom > 1
            ? `Acercado ${Math.round(zoom * 100)}% · doble clic para volver`
            : 'Doble clic para acercar'}
      </p>

      <button
        onClick={ev => { ev.stopPropagation(); onDescargar() }}
        disabled={descargando}
        className="flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50"
      >
        {descargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Descargar el certificado
      </button>
    </div>
  )
}

function TabCertificados({ e, fetcher, onRefresh }: {
  e: EstudianteDetalle
  fetcher: <T>(path: string, opts?: RequestInit) => Promise<T>
  onRefresh: () => void
}) {
  const estudianteId = e.id
  const queryClient = useQueryClient()
  const [tipoNuevo, setTipoNuevo] = useState<'CURSANDO' | 'COMPLETADO'>('CURSANDO')
  const [descargando, setDescargando] = useState<string | null>(null)
  const [editandoDoc, setEditandoDoc] = useState(false)
  const [previaAbierta, setPreviaAbierta] = useState(false)
  const [tipoDocInput, setTipoDocInput] = useState(e.tipoDocumento || 'CC')
  const [documentoInput, setDocumentoInput] = useState(e.documento ?? '')

  const { data, isLoading } = useQuery({
    queryKey: ['certificados-estudiante', estudianteId],
    queryFn: () => fetcher<{ data: Certificado[] }>(`/certificados/estudiante/${estudianteId}`),
  })
  const { data: firmasData } = useQuery({
    queryKey: ['config-firmas'],
    queryFn: () => fetcher<{ data: Firmas }>('/config/firmas'),
  })

  const guardarDocumentoMutation = useMutation({
    mutationFn: () => fetcher(`/estudiantes/${estudianteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoDocumento: tipoDocInput, documento: documentoInput.trim() }),
    }),
    onSuccess: () => { setEditandoDoc(false); onRefresh() },
    onError: (err: any) => alert(err?.message ?? 'Error al guardar el documento'),
  })

  /**
   * Un solo botón: emite el certificado y baja el PDF.
   *
   * Emitir sin bajar dejaba a medias lo que se venía a hacer — nadie entra a
   * esta pestaña a crear un registro, entra a conseguir el papel. Si el de ese
   * tipo ya existe no se crea otro: se baja el que hay, para no llenar el
   * historial de duplicados (Hotman, 21-ago).
   */
  const descargarMutation = useMutation({
    mutationFn: async () => {
      const existente = certificados.find(c => c.tipo === tipoNuevo)
      if (existente) {
        await generarPDF(existente, certificados.indexOf(existente), certificados.length, firmas)
        return
      }

      const creado = await fetcher<{ data: { id: string } }>('/certificados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estudianteId, tipo: tipoNuevo }),
      })

      // El PDF necesita el colegio y el curso completos, que la respuesta del
      // POST no trae: se relee la lista y se arma con el recién creado.
      const { data: lista } = await fetcher<{ data: Certificado[] }>(`/certificados/estudiante/${estudianteId}`)
      queryClient.setQueryData(['certificados-estudiante', estudianteId], { data: lista })

      const i = lista.findIndex(c => c.id === creado.data.id)
      if (i >= 0) await generarPDF(lista[i], i, lista.length, firmas)
    },
    onError: (e: any) => alert(e?.message ?? 'No se pudo generar el certificado'),
  })

  const certificados  = data?.data ?? []
  const firmas: Firmas = firmasData?.data ?? { firmaAndres: null }
  const tieneDocumento = !!e.documento

  const curso = e.cursos?.[0]?.curso
  // Misma regla que el PDF: si el curso no tiene horas configuradas se deducen
  // del nombre, para que la miniatura no muestre "0 horas" cuando el PDF sí
  // va a imprimir un número.
  const horas = curso?.duracionHoras && curso.duracionHoras > 0
    ? curso.duracionHoras
    : horasPorNombreCurso(curso?.nombre ?? '')

  // Exactamente los datos que recibirá el PDF. La miniatura renderiza la misma
  // plantilla con este objeto, así que no puede enseñar algo distinto de lo
  // que se va a emitir.
  const previa: CertificadoData = {
    nombreEstudiante: e.nombre,
    tipoDocumento:    e.tipoDocumento ?? 'CC',
    documento:        e.documento ?? '',
    colegio:          e.colegio?.nombre ?? '',
    ciudadColegio:    e.colegio?.ciudad ?? e.ciudad ?? '',
    curso:            curso?.nombre ?? 'Preicfes',
    duracionHoras:    horas,
    materias:         curso?.materias ?? [],
    simulacros:       curso?.simulacros ?? null,
    horarioTexto:     curso?.horarioTexto ?? null,
    fechaInicioCurso: curso?.fechaInicio ?? null,
    fechaFinCurso:    curso?.fechaFin ?? null,
    tipo:             tipoNuevo,
    fechaEmision:     new Date().toISOString(),
    numeroCertificado: certificados.length + 1,
    firmaAndres:      firmas.firmaAndres ?? undefined,
  }

  const abrirDocumento = () => {
    setTipoDocInput(e.tipoDocumento || 'CC')
    setDocumentoInput(e.documento ?? '')
    setEditandoDoc(true)
  }

  const handleDescargar = async (cert: Certificado, i: number) => {
    if (descargando) return
    setDescargando(cert.id)
    try {
      await generarPDF(cert, i, certificados.length, firmas)
    } catch (e) {
      console.error(e)
      alert('Error al generar el PDF')
    } finally {
      setDescargando(null)
    }
  }

  if (isLoading) return (
    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-on-surface-variant" /></div>
  )

  const etiquetaTipo = TIPOS_CERTIFICADO[tipoNuevo].label.toLowerCase()

  return (
    <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-lowest">
      <div className="grid md:grid-cols-[236px_1fr]">

        {/* ── La hoja, tal como va a salir ── */}
        <div className="grid place-items-center border-b border-outline-variant bg-surface-low p-5 md:border-b-0 md:border-r">
          <button
            type="button"
            onClick={() => setPreviaAbierta(true)}
            title="Ver el certificado en grande"
            className="group cursor-pointer"
          >
            <span className="block transition-transform group-hover:-translate-y-0.5">
              <VistaPreviaCertificado data={previa} ancho={ANCHO_PREVIA} />
            </span>
            <span className="mt-2.5 flex items-center justify-center gap-1 text-[10.5px] text-on-surface-variant transition-colors group-hover:text-primary">
              Certificado de {etiquetaTipo}
              <Maximize2 className="w-2.5 h-2.5" />
            </span>
          </button>
        </div>

        {/* ── Lo que lleva impreso y el botón de emitir ── */}
        <div className="p-4">
          {!tieneDocumento && !editandoDoc && (
            <div className="mb-3.5 flex items-start gap-2.5 rounded-xl border border-[#d97706]/30 bg-[#d97706]/[0.09] p-3 text-[11.5px] leading-snug text-on-surface">
              <AlertTriangle className="w-3.5 h-3.5 mt-px flex-shrink-0 text-[#d97706]" />
              <span className="flex-1">
                Sin el número de documento el certificado sale sin identificar al estudiante.{' '}
                <button
                  onClick={abrirDocumento}
                  className="cursor-pointer font-semibold text-[#d97706] underline underline-offset-2"
                >
                  Agregarlo
                </button>
              </span>
            </div>
          )}

          <p className="mb-3 text-xs font-semibold text-on-surface-variant">Lo que va impreso</p>

          <div className="mb-4">
            <DatoImpreso ok etiqueta="Nombre">{e.nombre}</DatoImpreso>

            <DatoImpreso ok={tieneDocumento} etiqueta="Documento">
              {tieneDocumento ? (
                <button
                  onClick={abrirDocumento}
                  className="inline-flex cursor-pointer items-center gap-1.5 tabular-nums transition-colors hover:text-primary"
                >
                  {e.tipoDocumento ?? 'CC'} {e.documento}
                  <Pencil className="w-3 h-3 opacity-50" />
                </button>
              ) : (
                <button
                  onClick={abrirDocumento}
                  className="cursor-pointer font-semibold text-[#d97706] hover:underline"
                >
                  falta — agregarlo
                </button>
              )}
            </DatoImpreso>

            <DatoImpreso ok={!!curso} etiqueta="Curso">
              {curso?.nombre ?? 'sin curso asignado'}
            </DatoImpreso>

            <DatoImpreso ok={horas > 0} etiqueta="Intensidad">
              {horas > 0 ? `${horas} horas` : 'sin horas'}
              {(curso?.materias?.length ?? 0) > 0 && ` · ${curso!.materias!.length} materias`}
            </DatoImpreso>

            <DatoImpreso ok={!!firmas.firmaAndres} etiqueta="Firma">
              {firmas.firmaAndres ? 'Andrés Felipe Díaz' : 'sin firma cargada'}
            </DatoImpreso>
          </div>

          {editandoDoc && (
            <div className="mb-4 rounded-xl border border-outline-variant bg-surface-low p-3">
              <p className="mb-2 text-[11px] font-semibold text-on-surface-variant">
                Documento del estudiante
              </p>
              <div className="grid grid-cols-[92px_1fr] gap-2">
                <Select
                  value={tipoDocInput}
                  onValueChange={setTipoDocInput}
                  className="w-auto bg-surface-lowest"
                  options={['CC', 'TI', 'CE', 'PA', 'RC'].map(t => ({ value: t, label: t }))}
                />
                <input
                  type="text"
                  autoFocus
                  placeholder="Número"
                  value={documentoInput}
                  onChange={ev => setDocumentoInput(ev.target.value)}
                  onKeyDown={ev => {
                    if (ev.key === 'Enter' && documentoInput.trim()) guardarDocumentoMutation.mutate()
                    if (ev.key === 'Escape') setEditandoDoc(false)
                  }}
                  className="w-full min-w-0 rounded-lg border border-outline-variant bg-surface-lowest px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => setEditandoDoc(false)}
                  className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-high"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => guardarDocumentoMutation.mutate()}
                  disabled={!documentoInput.trim() || guardarDocumentoMutation.isPending}
                  className="flex cursor-pointer items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                >
                  {guardarDocumentoMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Save className="w-3.5 h-3.5" />}
                  Guardar
                </button>
              </div>
            </div>
          )}

          {/* Elegir cuál de los dos. El visto verde marca el que ya se entregó. */}
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-surface-low p-1">
            {(['CURSANDO', 'COMPLETADO'] as const).map(tipo => {
              const { label, icon: Icon } = TIPOS_CERTIFICADO[tipo]
              const activo  = tipoNuevo === tipo
              const emitido = certificados.some(c => c.tipo === tipo)
              return (
                <button
                  key={tipo}
                  onClick={() => setTipoNuevo(tipo)}
                  aria-pressed={activo}
                  className={cn(
                    'flex cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-semibold transition-colors',
                    activo
                      ? 'bg-surface-lowest text-on-surface shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  {emitido && <Check className="w-3 h-3 text-[#16a34a]" strokeWidth={3} />}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => descargarMutation.mutate()}
            disabled={descargarMutation.isPending || !tieneDocumento}
            title={!tieneDocumento ? 'Registra el número de documento primero' : undefined}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-all hover:bg-primary/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {descargarMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Download className="w-4 h-4" />}
            Descargar el certificado
          </button>
        </div>
      </div>

      {/* ── Los que ya se entregaron ── */}
      <div className="border-t border-outline-variant bg-surface-low px-4 py-3">
        <p className="mb-2 text-[11px] font-semibold text-on-surface-variant">Ya emitidos</p>
        {certificados.length === 0 ? (
          <p className="py-1 text-[11.5px] text-on-surface-variant opacity-80">Ninguno todavía.</p>
        ) : (
          <div className="divide-y divide-outline-variant/55">
            {certificados.map((c, i) => {
              const { label, color, icon: Icon } = TIPOS_CERTIFICADO[c.tipo]
              const cargando = descargando === c.id
              return (
                <div key={c.id} className="flex items-center gap-2.5 py-2">
                  <span className={cn('grid w-7 h-7 flex-shrink-0 place-items-center rounded-lg', color)}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-on-surface">{label}</span>
                    <span className="block text-[10.5px] tabular-nums text-on-surface-variant">
                      {fmtFecha(c.fechaEmision)} · serie {c.numeroSerie}
                    </span>
                  </span>
                  <button
                    onClick={() => handleDescargar(c, i)}
                    disabled={!!descargando}
                    className="flex flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                  >
                    {cargando
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Download className="w-3.5 h-3.5" />}
                    Descargar
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {previaAbierta && (
        <ModalCertificado
          data={previa}
          etiqueta={etiquetaTipo}
          onCerrar={() => setPreviaAbierta(false)}
          onDescargar={() => descargarMutation.mutate()}
          descargando={descargarMutation.isPending}
        />
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
  const cursos:   { id: string; nombre: string; precio: number }[] = (cursosData?.data ?? []).filter((c: { activo: boolean }) => c.activo)

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
  const pagos = e.pagos ?? []

  // ── Cálculo de estado financiero real ──────────────────────────────────
  const cursoEst      = e.cursos?.[0]
  const precioBase    = cursoEst ? (cursoEst.precioAcordado ?? cursoEst.curso.precio) : 0
  const totalGeneral  = cursoEst
    ? precioBase
    : pagos.filter(p => p.estado !== 'CANCELADO').reduce((s, p) => s + p.monto, 0)
  const totalPagado   = pagos.filter(p => p.estado === 'PAGADO').reduce((s, p) => s + montoPagadoPago(p), 0)
  const saldoPend     = Math.max(0, totalGeneral - totalPagado)

  // Hay mora si una cuota del plan a plazos ya debió cobrarse y no llegó,
  // o si hay un pago marcado VENCIDO.
  const planResumen = planDeCuotas(pagos)
  const hasMora = planResumen.mora > 0 || pagos.some(p => p.estado === 'VENCIDO')

  // Pendientes sin mora: cualquier cuota/pago sin pagar, o saldo del curso sin cubrir
  const pagosPend  = pagos.filter(p => p.estado === 'PENDIENTE' || p.estado === 'VENCIDO').length
  const totalPend  = pagosPend + planResumen.esperadas.length

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
        {tab === 'certificados' && (
          <TabCertificados e={e} fetcher={fetcher} onRefresh={handleRefresh} />
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
