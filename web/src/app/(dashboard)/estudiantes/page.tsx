'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { getClientToken } from '@/lib/api'
import Link from 'next/link'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCOP } from '@/lib/utils'
import {
  Users, Search, Plus, ChevronLeft, ChevronRight,
  School, Phone, BookOpen, Loader2, Trash2, AlertTriangle,
  CheckCircle, Clock, ChevronRight as Arrow, Link2, Copy, Check, ExternalLink,
  Upload, FileSpreadsheet, X, AlertCircle, Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { isBefore, parseISO, isToday } from 'date-fns'
import { DEPARTAMENTOS, getMunicipios } from '@/lib/colombia'

// ── Helpers numéricos ──────────────────────────────────────────────────────
function fmtNum(raw: string | number): string {
  const n = typeof raw === 'string' ? raw.replace(/\./g, '') : String(raw)
  const num = Number(n)
  if (isNaN(num) || n === '') return ''
  return num.toLocaleString('es-CO')
}

function NumericInput({ value, onChange, placeholder, className, disabled }: {
  value: string; onChange: (raw: string) => void
  placeholder?: string; className?: string; disabled?: boolean
}) {
  return (
    <input type="text" inputMode="numeric" value={fmtNum(value)} placeholder={placeholder}
      className={className} disabled={disabled}
      onChange={e => onChange(e.target.value.replace(/\./g, '').replace(/[^0-9]/g, ''))} />
  )
}

// ── Tipos ──────────────────────────────────────────────────────────────────
interface CuotaMin { monto: number; pagado: boolean; fechaVencimiento: string }
interface PagoMin  { monto: number; estado: string;  fechaVencimiento: string }

interface Estudiante {
  id: string
  nombre: string
  tipoDocumento?: string
  documento?: string
  email: string
  telefono: string
  fechaNacimiento: string
  departamento?: string
  ciudad?: string
  colegioId?: string
  colegio?: { id: string; nombre: string }
  acudiente?: { nombre: string; email: string; telefono: string; relacion: string }
  asesorId?: string
  asesor?: { id: string; nombre: string }
  cursos?: { id: string; cursoId: string; descuentoPorcentaje: number; curso: { id: string; nombre: string; precio: number } }[]
  pagos?: PagoMin[]
  financiamientos?: { montoTotal: number; estado: string; cuotas: CuotaMin[] }[]
  createdAt: string
}

interface PaginatedResponse {
  data: Estudiante[]
  pagination: { total: number; page: number; totalPages: number }
}

// ── Calcular resumen financiero ────────────────────────────────────────────
function calcFinanciero(e: Estudiante) {
  const hoy = new Date()

  // Total = precio base del curso (SIN aplicar descuento) para evitar
  // que un descuentoPorcentaje erróneo oculte la deuda real.
  // El descuento es informativo; lo que importa es si hay pagos registrados.
  const cursoEst     = e.cursos?.[0]
  const totalGeneral = cursoEst
    ? cursoEst.curso.precio                                                                   // precio sin descuento
    : (e.financiamientos?.reduce((s, f) => s + f.montoTotal, 0) ?? 0)
    + (e.pagos?.reduce((s, p) => s + p.monto, 0) ?? 0)

  const pagadoFin      = e.financiamientos?.flatMap(f => f.cuotas).filter(c => c.pagado).reduce((s, c) => s + c.monto, 0) ?? 0
  const pagadoPagos    = e.pagos?.filter(p => p.estado === 'PAGADO').reduce((s, p) => s + p.monto, 0) ?? 0
  const totalPagado    = pagadoFin + pagadoPagos
  const totalPendiente = Math.max(0, totalGeneral - totalPagado)
  const progreso       = totalGeneral > 0 ? Math.min(100, (totalPagado / totalGeneral) * 100) : 0

  const moraFin     = e.financiamientos?.flatMap(f => f.cuotas).filter(c =>
    !c.pagado && isBefore(parseISO(c.fechaVencimiento), hoy) && !isToday(parseISO(c.fechaVencimiento))
  ).reduce((s, c) => s + c.monto, 0) ?? 0
  const moraPagos   = e.pagos?.filter(p => p.estado === 'VENCIDO').reduce((s, p) => s + p.monto, 0) ?? 0
  const totalMora   = moraFin + moraPagos

  // Si tiene curso pero 0 pagos → pendiente (nunca "sin deuda")
  const tieneCurso  = !!cursoEst
  const estado: 'al-dia' | 'pendiente' | 'mora' | 'sin-deuda' =
    totalMora > 0                       ? 'mora'      :
    totalPendiente > 0                  ? 'pendiente' :
    totalGeneral > 0 || tieneCurso      ? 'al-dia'    :
                                          'sin-deuda'

  return { totalGeneral, totalPagado, totalPendiente, totalMora, progreso, estado }
}

const BADGE: Record<string, { label: string; cls: string }> = {
  'al-dia':   { label: 'Al día',   cls: 'bg-[#16a34a]/12 text-[#16a34a]' },
  'pendiente':{ label: 'Pendiente',cls: 'bg-[#d97706]/12 text-[#d97706]' },
  'mora':     { label: 'En mora',  cls: 'bg-[#dc2626]/12 text-[#dc2626]' },
  'sin-deuda':{ label: 'Sin deuda',cls: 'bg-surface-high text-on-surface-variant' },
}

// ── Formulario crear ───────────────────────────────────────────────────────
const FORM_EMPTY = {
  nombre: '', tipoDocumento: 'CC', documento: '',
  email: '', telefono: '', fechaNacimiento: '',
  departamento: '', ciudad: '', colegioId: '', asesorId: '',
  lineaAutorizada: '',
  cursoId: '', descuentoValor: '0',
  acudienteNombre: '', acudienteEmail: '', acudienteTelefono: '', acudienteRelacion: 'Padre',
  formaPago: 'CONTADO' as 'CONTADO' | 'FINANCIADO',
  metodoPago: 'TRANSFERENCIA',
  fechaPago: '',
  comprobante: '',
  numeroCuotas: '3',
  fechaPrimeraCuota: '',
}

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-surface-lowest border border-outline-variant rounded-xl shadow-float w-full max-w-lg">
          {children}
        </div>
      </div>
    </div>
  )
}

function ConfirmDialog({ open, nombre, onConfirm, onCancel, isPending }: {
  open: boolean; nombre: string; onConfirm: () => void; onCancel: () => void; isPending: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-surface-lowest border border-outline-variant rounded-xl shadow-float w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--error-container)' }}>
            <Trash2 className="w-5 h-5" style={{ color: 'var(--error)' }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-on-surface">¿Eliminar estudiante?</p>
            <p className="text-xs text-on-surface-variant mt-0.5">Se eliminará a <strong>{nombre}</strong> permanentemente.</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors">Cancelar</button>
          <button onClick={onConfirm} disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--error)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function EstudiantesPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [busquedaInput, setBusquedaInput] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'mora' | 'pendiente' | 'al-dia'>('todos')

  useEffect(() => {
    const t = setTimeout(() => { setBusqueda(busquedaInput); setPage(1) }, 200)
    return () => clearTimeout(t)
  }, [busquedaInput])

  const [modalCrear, setModalCrear] = useState(false)
  const [pasoCrear, setPasoCrear] = useState(1)
  const [confirmEliminar, setConfirmEliminar] = useState<Estudiante | null>(null)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState(FORM_EMPTY)
  const [cuotasDetalle, setCuotasDetalle] = useState<{ monto: string; fecha: string }[]>([])
  const [subiendoComprobante, setSubiendoComprobante] = useState(false)
  const [modalTypeform, setModalTypeform]     = useState(false)
  const [typeformUrl, setTypeformUrl]         = useState<string | null>(null)
  const [typeformCopiado, setTypeformCopiado] = useState(false)
  const [confirmarReset, setConfirmarReset]   = useState(false)
  const [modalImport, setModalImport]         = useState(false)
  const [importFile, setImportFile]           = useState<File | null>(null)
  const [importResult, setImportResult]       = useState<any | null>(null)

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getClientToken()
    return createClientFetcher(token ?? '')<T>(path, opts)
  }

  const { data: colegiosData } = useQuery({ queryKey: ['colegios'], queryFn: () => fetcher<any>('/colegios'), staleTime: 5 * 60_000 })
  const colegios: { id: string; nombre: string }[] = colegiosData?.data ?? []

  const { data: asesoresData } = useQuery({
    queryKey: ['asesores-select'],
    queryFn: () => fetcher<any>('/asesores?limit=100'),
    enabled: isAdmin,
    staleTime: 5 * 60_000,
  })
  const asesores: { id: string; nombre: string }[] = asesoresData?.data ?? []

  const { data: cursosData } = useQuery({ queryKey: ['cursos-select'], queryFn: () => fetcher<any>('/cursos?limit=100'), staleTime: 5 * 60_000 })

  // ── Formulario Typeform activo ─────────────────────────────────────────────
  const { data: formActivoData, refetch: refetchFormActivo } = useQuery({
    queryKey: ['typeform-activo'],
    queryFn:  () => fetcher<{ data: { url: string | null } }>('/typeform/formulario-activo'),
    staleTime: 5 * 60_000, // 5 min — la URL del form no cambia seguido
  })
  const formActivoUrl = formActivoData?.data?.url ?? null
  const cursos: { id: string; nombre: string; precio: number }[] = cursosData?.data ?? []

  const { data, isLoading } = useQuery({
    queryKey: ['estudiantes', page, busqueda],
    queryFn: () => fetcher<PaginatedResponse>(`/estudiantes?page=${page}&limit=15${busqueda ? `&nombre=${busqueda}` : ''}`),
  })

  const crearMutation = useMutation({
    mutationFn: async () => {
      if (!form.nombre || !form.email || !form.telefono || !form.fechaNacimiento)
        throw new Error('Completa todos los campos obligatorios del estudiante')
      if (form.cursoId && form.formaPago === 'CONTADO' && !form.fechaPago)
        throw new Error('Ingresa la fecha del pago')
      if (form.cursoId && form.formaPago === 'FINANCIADO') {
        if (cuotasDetalle.length === 0) throw new Error('Configura las cuotas del financiamiento')
        if (cuotasDetalle.some(c => !c.fecha || !c.monto || Number(c.monto) <= 0))
          throw new Error('Completa el monto y la fecha de cada cuota')
        const sumaCuotas = cuotasDetalle.reduce((s, c) => s + Number(c.monto), 0)
        const pf = Math.max(0, precioFinal)
        if (sumaCuotas > pf + 1)
          throw new Error(`La suma de cuotas (${formatCOP(sumaCuotas)}) supera el precio del curso (${formatCOP(pf)})`)
      }
      const cursoPrecio = cursos.find(c => c.id === form.cursoId)?.precio ?? 0
      const descuentoValorNum = Number(form.descuentoValor) || 0
      const descuentoPct = cursoPrecio > 0 ? (descuentoValorNum / cursoPrecio) * 100 : 0

      const payload: any = {
        nombre: form.nombre.trim(), tipoDocumento: form.tipoDocumento,
        ...(form.documento.trim() && { documento: form.documento.trim() }),
        email: form.email.trim(), telefono: form.telefono.trim(),
        fechaNacimiento: form.fechaNacimiento,
        ...(form.departamento && { departamento: form.departamento }),
        ...(form.ciudad       && { ciudad: form.ciudad }),
        ...(form.colegioId    && { colegioId: form.colegioId }),
        // Admin puede reasignar a otro asesor; vendedor se asigna automáticamente en el backend
        ...(isAdmin && form.asesorId && { asesorId: form.asesorId }),
        ...(isAdmin && form.lineaAutorizada && { lineaAutorizada: Number(form.lineaAutorizada) }),
        ...(form.cursoId && {
          cursoId: form.cursoId, descuentoPorcentaje: descuentoPct,
          formaPago: form.formaPago,
          ...(form.formaPago === 'CONTADO' && {
            metodoPago: form.metodoPago, fechaPago: form.fechaPago,
            ...(form.comprobante && { comprobante: form.comprobante }),
          }),
          ...(form.formaPago === 'FINANCIADO' && {
            cuotas: cuotasDetalle.map(c => ({ monto: Number(c.monto), fechaVencimiento: c.fecha })),
          }),
        }),
      }
      const acudienteCompleto = form.acudienteNombre.trim() && form.acudienteEmail.trim() && form.acudienteTelefono.trim()
      if (acudienteCompleto) {
        payload.acudiente = {
          nombre: form.acudienteNombre.trim(), email: form.acudienteEmail.trim(),
          telefono: form.acudienteTelefono.trim(), relacion: form.acudienteRelacion,
        }
      }
      return fetcher('/estudiantes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estudiantes'] })
      queryClient.invalidateQueries({ queryKey: ['saldos-pendientes'] })
      queryClient.invalidateQueries({ queryKey: ['reportes-dashboard'] })
      setModalCrear(false); setPasoCrear(1); setFormError(''); setForm(FORM_EMPTY); setCuotasDetalle([])
    },
    onError: (e: any) => setFormError(e.message ?? 'Error al crear el estudiante'),
  })

  const eliminarMutation = useMutation({
    mutationFn: (id: string) => fetcher(`/estudiantes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estudiantes'] })
      queryClient.invalidateQueries({ queryKey: ['saldos-pendientes'] })
      queryClient.invalidateQueries({ queryKey: ['reportes-dashboard'] })
      setConfirmEliminar(null)
    },
    onError: () => setConfirmEliminar(null),
  })

  const crearTypeform = useMutation({
    mutationFn: () => fetcher<{ data: { url: string } }>('/typeform/crear-formulario', { method: 'POST' }),
    onSuccess: (res: any) => {
      const url = res.data?.url ?? res.url
      setTypeformUrl(url)
      setModalTypeform(true)
      refetchFormActivo()  // actualiza el estado del botón inmediatamente
    },
    onError: () => alert('Error al crear el formulario. Intenta de nuevo.'),
  })

  const resetFormActivo = useMutation({
    mutationFn: () => fetcher('/typeform/formulario-activo', { method: 'DELETE' }),
    onSuccess: () => { setConfirmarReset(false); refetchFormActivo() },
    onError:   () => alert('Error al eliminar el formulario activo.'),
  })

  const activarWebhook = useMutation({
    mutationFn: () => fetcher<{ data: { mensaje: string } }>('/typeform/webhook/activar', { method: 'POST' }),
    onSuccess: (data) => alert(`✅ ${data?.data?.mensaje ?? 'Webhook activado correctamente'}`),
    onError:   () => alert('❌ Error al activar el webhook. Revisa los logs de Railway.'),
  })

  const procesarRespuestas = useMutation({
    mutationFn: () => fetcher<{ data: { total: number; procesados: number; omitidos: number } }>('/typeform/procesar-respuestas', { method: 'POST' }),
    onSuccess: (data) => {
      const d = data?.data
      alert(`✅ Listo:\n• ${d?.procesados ?? 0} estudiante(s) nuevos creados\n• ${d?.omitidos ?? 0} ya existían`)
      queryClient.invalidateQueries({ queryKey: ['estudiantes'] })
    },
    onError: () => alert('❌ Error al procesar respuestas.'),
  })

  async function descargarPlantilla() {
    const token = await getClientToken()
    const res   = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/estudiantes/plantilla`, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    })
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'plantilla-importacion-grupo500.xlsx'; a.click()
    URL.revokeObjectURL(url)
  }

  const importarMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = await getClientToken()
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/estudiantes/import`, {
        method: 'POST', headers: { Authorization: `Bearer ${token ?? ''}` }, body: fd,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Error al importar')
      return json.data
    },
    onSuccess: (data) => {
      setImportResult(data)
      setImportFile(null)
      queryClient.invalidateQueries({ queryKey: ['estudiantes'] })
      queryClient.invalidateQueries({ queryKey: ['saldos-pendientes'] })
      queryClient.invalidateQueries({ queryKey: ['reportes-dashboard'] })
    },
    onError: (e: any) => setImportResult({ error: e.message ?? 'Error al importar' }),
  })

  const copiarLink = async () => {
    if (!typeformUrl) return
    await navigator.clipboard.writeText(typeformUrl)
    setTypeformCopiado(true)
    setTimeout(() => setTypeformCopiado(false), 2000)
  }

  const subirComprobante = async (file: File) => {
    setSubiendoComprobante(true)
    try {
      const token = await getClientToken()
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/imagen`, {
        method: 'POST', headers: { Authorization: `Bearer ${token ?? ''}` }, body: fd,
      })
      const json = await res.json()
      if (!res.ok || !json?.data?.url) throw new Error(json?.error ?? 'Error al subir')
      setForm(p => ({ ...p, comprobante: json.data.url }))
    } catch (e: any) {
      setFormError(e?.message ?? 'Error al subir comprobante')
    } finally {
      setSubiendoComprobante(false) }
  }

  const estudiantes = data?.data ?? []
  const totalPages  = data?.pagination?.totalPages ?? 1
  const totalCount  = data?.pagination?.total ?? 0

  // Filtro cliente por estado financiero
  const estudiantesFiltrados = filtroEstado === 'todos'
    ? estudiantes
    : estudiantes.filter(e => calcFinanciero(e).estado === filtroEstado)

  const inputCls = 'w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20'
  const labelCls = 'block text-xs font-medium text-on-surface-variant mb-1'

  const cursoPrecioActual = cursos.find(c => c.id === form.cursoId)?.precio ?? 0
  const precioFinal = cursoPrecioActual - (Number(form.descuentoValor) || 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Estudiantes"
        subtitle={`${totalCount} estudiante${totalCount !== 1 ? 's' : ''} registrado${totalCount !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            {formActivoUrl ? (
              /* Ya existe un formulario activo → Ver enlace */
              <button
                onClick={() => { setTypeformUrl(formActivoUrl); setModalTypeform(true) }}
                title="Ver enlace del formulario activo"
                className="flex items-center gap-2 px-4 py-2 bg-[#16a34a]/10 border border-[#16a34a]/30 text-[#16a34a] rounded-xl text-sm font-semibold hover:bg-[#16a34a]/20 transition-colors cursor-pointer"
              >
                <Link2 className="w-4 h-4" />
                <span className="hidden sm:inline">Ver enlace</span>
              </button>
            ) : (
              /* Sin formulario activo → Generar */
              <button
                onClick={() => crearTypeform.mutate()}
                disabled={crearTypeform.isPending}
                title="Generar formulario de inscripción"
                className="flex items-center gap-2 px-4 py-2 bg-surface-high border border-outline-variant text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-lowest transition-colors cursor-pointer disabled:opacity-50"
              >
                {crearTypeform.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Link2 className="w-4 h-4" />}
                <span className="hidden sm:inline">
                  {crearTypeform.isPending ? 'Generando...' : 'Formulario'}
                </span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => { setModalImport(true); setImportFile(null); setImportResult(null) }}
                title="Importar estudiantes desde Excel"
                className="flex items-center gap-2 px-4 py-2 bg-surface-high border border-outline-variant text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-lowest transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Importar</span>
              </button>
            )}
            <button onClick={() => { setModalCrear(true); setPasoCrear(1); setForm(FORM_EMPTY); setCuotasDetalle([]); setFormError('') }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer">
              <Plus className="w-4 h-4" /><span className="hidden sm:inline">Nuevo</span>
            </button>
          </div>
        }
      />

      {/* ── Filtros ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input type="text" placeholder="Buscar por nombre..." value={busquedaInput}
            onChange={e => setBusquedaInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-surface-lowest border border-outline-variant rounded-xl text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50" />
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-surface-high border border-outline-variant/40">
          {(['todos', 'mora', 'pendiente', 'al-dia'] as const).map(f => (
            <button key={f} onClick={() => setFiltroEstado(f)}
              className={cn('px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 cursor-pointer',
                filtroEstado === f ? 'bg-surface-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface')}>
              {f === 'todos' ? 'Todos' : f === 'mora' ? 'En mora' : f === 'pendiente' ? 'Pendiente' : 'Al día'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid de cards ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-outline-variant bg-surface-lowest p-4 animate-pulse space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-high flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 rounded bg-surface-high" />
                  <div className="h-2.5 w-20 rounded bg-surface-high" />
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-high" />
              <div className="flex justify-between">
                <div className="h-3 w-20 rounded bg-surface-high" />
                <div className="h-3 w-24 rounded bg-surface-high" />
              </div>
            </div>
          ))}
        </div>
      ) : estudiantesFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
          <Users className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">{busqueda ? 'Sin resultados' : filtroEstado !== 'todos' ? 'Sin estudiantes en este estado' : 'No hay estudiantes registrados'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {estudiantesFiltrados.map(e => {
            const fin = calcFinanciero(e)
            const badge = BADGE[fin.estado]
            const curso = e.cursos?.[0]?.curso
            const tieneDeuda = fin.totalGeneral > 0

            return (
              <Link key={e.id}
                href={`/estudiantes/${e.id}`}
                className="group rounded-2xl border border-outline-variant bg-surface-lowest p-4 hover:border-primary/40 hover:shadow-md active:scale-[0.98] active:border-primary/60 active:bg-surface-high transition-all duration-200 cursor-pointer flex flex-col gap-3 select-none">

                {/* Header: avatar + nombre + badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold',
                      fin.estado === 'mora' ? 'bg-[#dc2626]/15 text-[#dc2626]' : 'bg-primary/10 text-primary')}>
                      {e.nombre[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-on-surface truncate">{e.nombre}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-on-surface-variant flex-shrink-0" />
                        <p className="text-[11px] text-on-surface-variant truncate">{e.telefono}</p>
                      </div>
                    </div>
                  </div>
                  <span className={cn('flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full', badge.cls)}>
                    {badge.label}
                  </span>
                </div>

                {/* Curso */}
                {curso && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-high">
                    <BookOpen className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <p className="text-[12px] text-on-surface truncate">{curso.nombre}</p>
                  </div>
                )}

                {/* Barra de progreso */}
                {tieneDeuda && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-on-surface-variant">
                      <span>Pagado</span>
                      <span>{Math.round(fin.progreso)}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-surface-high overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all duration-500',
                        fin.progreso >= 100 ? 'bg-[#16a34a]' : fin.estado === 'mora' ? 'bg-[#dc2626]' : 'bg-primary')}
                        style={{ width: `${fin.progreso}%` }} />
                    </div>
                  </div>
                )}

                {/* Montos */}
                {tieneDeuda ? (
                  <div className="flex items-center justify-between pt-1 border-t border-outline-variant/40">
                    <div>
                      <p className="text-[10px] text-on-surface-variant">Saldo pendiente</p>
                      <p className={cn('text-sm font-bold tabular-nums',
                        fin.estado === 'mora' ? 'text-[#dc2626]' : fin.totalPendiente > 0 ? 'text-[#d97706]' : 'text-[#16a34a]')}>
                        {formatCOP(fin.totalPendiente)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-on-surface-variant">Total</p>
                      <p className="text-sm font-semibold text-on-surface tabular-nums">{formatCOP(fin.totalGeneral)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 pt-1 border-t border-outline-variant/40">
                    {e.colegio ? (
                      <>
                        <School className="w-3.5 h-3.5 text-on-surface-variant" />
                        <p className="text-[11px] text-on-surface-variant truncate">{e.colegio.nombre}</p>
                      </>
                    ) : (
                      <p className="text-[11px] text-on-surface-variant">Sin deuda registrada</p>
                    )}
                  </div>
                )}

                {/* Arrow indicator */}
                <div className="flex justify-end -mt-1">
                  <Arrow className="w-3.5 h-3.5 text-on-surface-variant opacity-0 group-hover:opacity-50 transition-opacity" />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* ── Paginación ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-on-surface-variant">Página {page} de {totalPages}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-2 rounded-lg border border-outline-variant hover:bg-surface-high disabled:opacity-40 transition-colors cursor-pointer">
              <ChevronLeft className="w-4 h-4 text-on-surface-variant" />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-2 rounded-lg border border-outline-variant hover:bg-surface-high disabled:opacity-40 transition-colors cursor-pointer">
              <ChevronRight className="w-4 h-4 text-on-surface-variant" />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════ MODAL CREAR ══════════════════ */}
      <Modal open={modalCrear} onClose={() => { setModalCrear(false); setPasoCrear(1); setFormError('') }}>
        <div className="flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-outline-variant/40 flex-shrink-0">
            <div>
              <h2 className="text-base font-bold text-on-surface">Nuevo estudiante</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">Paso {pasoCrear} de 3</p>
            </div>
            <button onClick={() => { setModalCrear(false); setPasoCrear(1); setFormError('') }}
              className="p-1.5 text-on-surface-variant hover:text-on-surface cursor-pointer">
              <Loader2 className="w-4 h-4 opacity-0" />✕
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
            {/* ── Paso 1: Datos personales ── */}
            {pasoCrear === 1 && (
              <>
                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Datos del estudiante</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Nombre completo *</label>
                    <input className={inputCls} value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre completo" />
                  </div>
                  <div>
                    <label className={labelCls}>Tipo doc.</label>
                    <select className={inputCls} value={form.tipoDocumento} onChange={e => setForm(p => ({ ...p, tipoDocumento: e.target.value }))}>
                      {['CC','TI','CE','PA','RC'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Número de documento</label>
                    <input className={inputCls} value={form.documento} onChange={e => setForm(p => ({ ...p, documento: e.target.value }))} placeholder="Opcional" />
                  </div>
                  <div>
                    <label className={labelCls}>Email *</label>
                    <input type="email" className={inputCls} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Teléfono *</label>
                    <input className={inputCls} value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Fecha de nacimiento *</label>
                    <input type="date" className={inputCls} value={form.fechaNacimiento} onChange={e => setForm(p => ({ ...p, fechaNacimiento: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Colegio</label>
                    <select className={inputCls} value={form.colegioId} onChange={e => setForm(p => ({ ...p, colegioId: e.target.value }))}>
                      <option value="">Sin colegio</option>
                      {colegios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Departamento</label>
                    <select className={inputCls} value={form.departamento} onChange={e => setForm(p => ({ ...p, departamento: e.target.value, ciudad: '' }))}>
                      <option value="">Seleccionar</option>
                      {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Ciudad</label>
                    <select className={inputCls} value={form.ciudad} onChange={e => setForm(p => ({ ...p, ciudad: e.target.value }))} disabled={!form.departamento}>
                      <option value="">Seleccionar</option>
                      {getMunicipios(form.departamento).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  {isAdmin && (
                    <div>
                      <label className={labelCls}>Asesor</label>
                      <select className={inputCls} value={form.asesorId} onChange={e => setForm(p => ({ ...p, asesorId: e.target.value }))}>
                        <option value="">Sin asignar</option>
                        {asesores.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                      </select>
                    </div>
                  )}
                  {isAdmin && (
                    <div>
                      <label className={labelCls}>Línea autorizada</label>
                      <select className={inputCls} value={form.lineaAutorizada} onChange={e => setForm(p => ({ ...p, lineaAutorizada: e.target.value }))}>
                        <option value="">Sin asignar</option>
                        {[1,2,3,4,5,6].map(n => <option key={n} value={n}>Línea {n}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mt-4">Acudiente (opcional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Nombre del acudiente</label>
                    <input className={inputCls} value={form.acudienteNombre} onChange={e => setForm(p => ({ ...p, acudienteNombre: e.target.value }))} placeholder="Nombre completo" />
                  </div>
                  <div>
                    <label className={labelCls}>Email</label>
                    <input type="email" className={inputCls} value={form.acudienteEmail} onChange={e => setForm(p => ({ ...p, acudienteEmail: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Teléfono</label>
                    <input className={inputCls} value={form.acudienteTelefono} onChange={e => setForm(p => ({ ...p, acudienteTelefono: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Relación</label>
                    <select className={inputCls} value={form.acudienteRelacion} onChange={e => setForm(p => ({ ...p, acudienteRelacion: e.target.value }))}>
                      {['Padre','Madre','Tutor','Hermano/a','Otro'].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* ── Paso 2: Curso ── */}
            {pasoCrear === 2 && (
              <>
                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Curso adquirido</p>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Curso</label>
                    <select className={inputCls} value={form.cursoId} onChange={e => setForm(p => ({ ...p, cursoId: e.target.value, descuentoValor: '0' }))}>
                      <option value="">Sin curso por ahora</option>
                      {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre} — {formatCOP(c.precio)}</option>)}
                    </select>
                  </div>
                  {form.cursoId && (
                    <>
                      <div>
                        <label className={labelCls}>Descuento en pesos (opcional)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">$</span>
                          <NumericInput value={form.descuentoValor} onChange={v => setForm(p => ({ ...p, descuentoValor: v }))}
                            placeholder="0" className={cn(inputCls, 'pl-6')} />
                        </div>
                        {cursoPrecioActual > 0 && (
                          <p className="text-[11px] text-on-surface-variant mt-1">
                            Precio final: <strong className="text-on-surface">{formatCOP(Math.max(0, precioFinal))}</strong>
                          </p>
                        )}
                      </div>
                      <div>
                        <label className={labelCls}>Forma de pago *</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['CONTADO', 'FINANCIADO'] as const).map(f => (
                            <button key={f} type="button" onClick={() => setForm(p => ({ ...p, formaPago: f }))}
                              className={cn('py-2 rounded-lg border-2 text-sm font-medium transition-all cursor-pointer',
                                form.formaPago === f ? 'border-primary bg-primary/8 text-primary' : 'border-outline-variant text-on-surface-variant hover:border-outline-variant/80')}>
                              {f === 'CONTADO' ? 'Contado' : 'Financiado'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {form.formaPago === 'CONTADO' && (
                        <>
                          <div>
                            <label className={labelCls}>Método de pago</label>
                            <select className={inputCls} value={form.metodoPago} onChange={e => setForm(p => ({ ...p, metodoPago: e.target.value }))}>
                              {['TRANSFERENCIA','TARJETA','EFECTIVO','OTRO'].map(m => <option key={m}>{m}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>Fecha del pago *</label>
                            <input type="date" className={inputCls} value={form.fechaPago} onChange={e => setForm(p => ({ ...p, fechaPago: e.target.value }))} />
                          </div>
                          <div>
                            <label className={labelCls}>Comprobante (opcional)</label>
                            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-surface-high border border-outline-variant rounded-lg hover:bg-surface-highest transition-colors">
                              <input type="file" accept="image/*,.pdf" className="hidden" disabled={subiendoComprobante}
                                onChange={e => { const f = e.target.files?.[0]; if (f) subirComprobante(f); e.target.value = '' }} />
                              {subiendoComprobante ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <span className="text-sm text-on-surface-variant">📎</span>}
                              <span className="text-sm text-on-surface-variant">{subiendoComprobante ? 'Subiendo...' : form.comprobante ? '✓ Comprobante adjunto' : 'Adjuntar comprobante'}</span>
                            </label>
                          </div>
                        </>
                      )}

                      {form.formaPago === 'FINANCIADO' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={labelCls}>Número de cuotas</label>
                              <input type="number" min={1} max={24} className={inputCls} value={form.numeroCuotas}
                                onChange={e => { setForm(p => ({ ...p, numeroCuotas: e.target.value })); setCuotasDetalle([]) }} />
                            </div>
                            <div>
                              <label className={labelCls}>Primera cuota</label>
                              <input type="date" className={inputCls} value={form.fechaPrimeraCuota}
                                onChange={e => { setForm(p => ({ ...p, fechaPrimeraCuota: e.target.value })); setCuotasDetalle([]) }} />
                            </div>
                          </div>
                          <button type="button" onClick={() => {
                            const n = Number(form.numeroCuotas)
                            const montoBase = Math.max(0, precioFinal)
                            const montoCuota = n > 0 ? String(Math.round(montoBase / n)) : '0'
                            const base = new Date(form.fechaPrimeraCuota)
                            const cuotas = Array.from({ length: n }, (_, i) => {
                              const d = new Date(base); d.setMonth(d.getMonth() + i)
                              return { monto: montoCuota, fecha: d.toISOString().split('T')[0] }
                            })
                            setCuotasDetalle(cuotas)
                          }}
                            disabled={!form.numeroCuotas || !form.fechaPrimeraCuota}
                            className="w-full py-2 rounded-lg border-2 border-dashed border-primary/50 text-sm text-primary font-medium hover:bg-primary/5 disabled:opacity-40 transition-colors cursor-pointer">
                            Generar cuotas automáticamente
                          </button>
                          {cuotasDetalle.map((c, i) => (
                            <div key={i} className="grid grid-cols-2 gap-2 items-end">
                              <div>
                                <label className={labelCls}>Cuota #{i + 1} — Monto</label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">$</span>
                                  <NumericInput value={c.monto} onChange={v => setCuotasDetalle(prev => prev.map((x, j) => j === i ? { ...x, monto: v } : x))}
                                    placeholder="0" className={cn(inputCls, 'pl-6')} />
                                </div>
                              </div>
                              <div>
                                <label className={labelCls}>Vencimiento</label>
                                <input type="date" className={inputCls} value={c.fecha}
                                  onChange={e => setCuotasDetalle(prev => prev.map((x, j) => j === i ? { ...x, fecha: e.target.value } : x))} />
                              </div>
                            </div>
                          ))}
                          {cuotasDetalle.length > 0 && (() => {
                            const suma = cuotasDetalle.reduce((s, c) => s + Number(c.monto), 0)
                            const pf   = Math.max(0, precioFinal)
                            const ok   = suma <= pf + 1
                            return (
                              <div className={cn('flex items-center justify-between text-[11px] px-3 py-2 rounded-lg', ok ? 'bg-[#16a34a]/8 text-[#16a34a]' : 'bg-[#dc2626]/8 text-[#dc2626]')}>
                                <span>Suma de cuotas: <strong>{formatCOP(suma)}</strong></span>
                                <span>Precio final: <strong>{formatCOP(pf)}</strong></span>
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            {/* ── Paso 3: Revisión ── */}
            {pasoCrear === 3 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Revisión</p>
                <div className="rounded-xl border border-outline-variant divide-y divide-outline-variant/40">
                  {[
                    ['Nombre', form.nombre],
                    ['Email', form.email],
                    ['Teléfono', form.telefono],
                    ['Documento', form.tipoDocumento + (form.documento ? ` ${form.documento}` : '')],
                    ...(form.cursoId ? [['Curso', cursos.find(c => c.id === form.cursoId)?.nombre ?? '']] : []),
                    ...(form.cursoId && Number(form.descuentoValor) > 0 ? [['Descuento', formatCOP(Number(form.descuentoValor))]] : []),
                    ...(form.cursoId ? [['Forma de pago', form.formaPago]] : []),
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between px-3 py-2">
                      <span className="text-xs text-on-surface-variant">{k}</span>
                      <span className="text-xs font-medium text-on-surface">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {formError && (
              <p className="text-xs text-[var(--error)] bg-[var(--error-container)]/40 border border-[var(--error)]/20 rounded-lg px-3 py-2">{formError}</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between gap-3 px-5 py-4 border-t border-outline-variant/40 flex-shrink-0">
            {pasoCrear > 1
              ? <button onClick={() => setPasoCrear(p => p - 1)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface cursor-pointer">← Atrás</button>
              : <div />
            }
            {pasoCrear < 3
              ? <button onClick={() => { setFormError(''); setPasoCrear(p => p + 1) }}
                  className="px-5 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer">
                  Siguiente →
                </button>
              : <button onClick={() => crearMutation.mutate()} disabled={crearMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer">
                  {crearMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Crear estudiante
                </button>
            }
          </div>
        </div>
      </Modal>

      {/* Confirmar eliminar */}
      <ConfirmDialog
        open={!!confirmEliminar}
        nombre={confirmEliminar?.nombre ?? ''}
        onConfirm={() => confirmEliminar && eliminarMutation.mutate(confirmEliminar.id)}
        onCancel={() => setConfirmEliminar(null)}
        isPending={eliminarMutation.isPending}
      />

      {/* Modal formulario Typeform */}
      {modalTypeform && typeformUrl && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalTypeform(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-surface-lowest border border-outline-variant rounded-xl shadow-float w-full max-w-md p-6 space-y-5">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Link2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-on-surface">Enlace del formulario</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Comparte este enlace con tus estudiantes</p>
                </div>
              </div>

              {/* Link */}
              <div className="flex items-center gap-2 bg-surface-high border border-outline-variant rounded-lg px-3 py-2.5">
                <p className="flex-1 text-xs text-on-surface truncate font-mono">{typeformUrl}</p>
                <button
                  onClick={copiarLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors flex-shrink-0"
                >
                  {typeformCopiado
                    ? <><Check className="w-3.5 h-3.5" /> Copiado</>
                    : <><Copy className="w-3.5 h-3.5" /> Copiar</>
                  }
                </button>
              </div>

              {/* Solo admins ven el botón de ver formulario y el texto informativo */}
              {isAdmin && (
                <>
                  <a
                    href={typeformUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 border border-outline-variant rounded-xl text-sm font-medium text-on-surface hover:bg-surface-high transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ver formulario
                  </a>
                  <p className="text-xs text-on-surface-variant text-center leading-relaxed">
                    Cuando un estudiante complete el formulario, sus datos se guardarán automáticamente.
                  </p>
                </>
              )}

              <button
                onClick={() => setModalTypeform(false)}
                className="w-full px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Cerrar
              </button>

              {/* Solo admins pueden regenerar el formulario */}
              {isAdmin && (
                <div className="pt-2 border-t border-outline-variant/30">
                  {!confirmarReset ? (
                    <button
                      onClick={() => setConfirmarReset(true)}
                      className="w-full text-xs text-on-surface-variant/50 hover:text-[#dc2626] transition-colors py-1 cursor-pointer"
                    >
                      Regenerar formulario (crea uno nuevo)
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] text-center text-[#dc2626] font-medium">
                        ¿Seguro? Se eliminará el enlace actual y se generará uno nuevo.
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmarReset(false)}
                          className="flex-1 py-1.5 text-xs text-on-surface-variant border border-outline-variant rounded-lg hover:bg-surface-high transition-colors cursor-pointer">
                          Cancelar
                        </button>
                        <button
                          onClick={() => resetFormActivo.mutate()}
                          disabled={resetFormActivo.isPending}
                          className="flex-1 py-1.5 text-xs text-white bg-[#dc2626] rounded-lg hover:bg-[#b91c1c] disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          {resetFormActivo.isPending ? 'Eliminando...' : 'Sí, regenerar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Importar Excel ── */}
      {modalImport && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (!importarMutation.isPending) setModalImport(false) }} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-surface-lowest border border-outline-variant rounded-xl shadow-float w-full max-w-lg">

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/40">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileSpreadsheet className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">Importar desde Excel</p>
                    <p className="text-xs text-on-surface-variant">Sube el archivo de cobros de Grupo 500</p>
                  </div>
                </div>
                <button onClick={() => setModalImport(false)} disabled={importarMutation.isPending}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-high transition-colors cursor-pointer disabled:opacity-40">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">

                {/* Resultado exitoso */}
                {importResult && !importResult.error ? (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-[#16a34a]/8 border border-[#16a34a]/20 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-[#16a34a] font-semibold text-sm">
                        <CheckCircle className="w-4 h-4" /> Importación completada
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-on-surface-variant mt-2">
                        <div className="bg-surface-lowest rounded-lg p-2.5 text-center">
                          <p className="text-lg font-bold text-on-surface">{importResult.resumen.estudiantesCreados}</p>
                          <p>Nuevos</p>
                        </div>
                        <div className="bg-surface-lowest rounded-lg p-2.5 text-center">
                          <p className="text-lg font-bold text-on-surface">{importResult.resumen.estudiantesExistentes}</p>
                          <p>Ya existían</p>
                        </div>
                        <div className="bg-surface-lowest rounded-lg p-2.5 text-center">
                          <p className="text-lg font-bold text-on-surface">{importResult.resumen.pagosCreados}</p>
                          <p>Pagos creados</p>
                        </div>
                        <div className={cn('rounded-lg p-2.5 text-center', importResult.resumen.errores > 0 ? 'bg-[#dc2626]/8' : 'bg-surface-lowest')}>
                          <p className={cn('text-lg font-bold', importResult.resumen.errores > 0 ? 'text-[#dc2626]' : 'text-on-surface')}>{importResult.resumen.errores}</p>
                          <p>Errores</p>
                        </div>
                      </div>
                    </div>
                    {importResult.resumen.errores > 0 && (
                      <div className="max-h-36 overflow-y-auto rounded-xl bg-[#dc2626]/6 border border-[#dc2626]/20 p-3 space-y-1">
                        {importResult.detalles.filter((d: any) => d.error).map((d: any, i: number) => (
                          <div key={i} className="text-xs text-[#dc2626] flex gap-2">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span><strong>{d.nombre}:</strong> {d.error}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={() => { setModalImport(false); setImportResult(null) }}
                      className="w-full py-2.5 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer">
                      Cerrar
                    </button>
                  </div>

                ) : importResult?.error ? (
                  /* Error de importación */
                  <div className="space-y-4">
                    <div className="rounded-xl bg-[#dc2626]/8 border border-[#dc2626]/20 p-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-[#dc2626] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-[#dc2626]">Error al importar</p>
                        <p className="text-xs text-on-surface-variant mt-1">{importResult.error}</p>
                      </div>
                    </div>
                    <button onClick={() => setImportResult(null)}
                      className="w-full py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">
                      Intentar de nuevo
                    </button>
                  </div>

                ) : (
                  /* Subir archivo */
                  <>
                    <label
                      htmlFor="excel-import"
                      className={cn(
                        'flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors',
                        importFile ? 'border-primary/50 bg-primary/5' : 'border-outline-variant hover:border-primary/40 hover:bg-surface-high',
                      )}
                    >
                      <div className="w-12 h-12 rounded-2xl bg-surface-high flex items-center justify-center">
                        {importFile
                          ? <CheckCircle className="w-6 h-6 text-primary" />
                          : <Upload className="w-6 h-6 text-on-surface-variant" />
                        }
                      </div>
                      {importFile ? (
                        <div className="text-center">
                          <p className="text-sm font-semibold text-on-surface">{importFile.name}</p>
                          <p className="text-xs text-on-surface-variant mt-0.5">{(importFile.size / 1024).toFixed(0)} KB — listo para importar</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-sm font-semibold text-on-surface">Selecciona el archivo Excel</p>
                          <p className="text-xs text-on-surface-variant mt-0.5">.xlsx o .xls • máx. 10 MB</p>
                        </div>
                      )}
                      <input id="excel-import" type="file" accept=".xlsx,.xls" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) { setImportFile(f); setImportResult(null) } }} />
                    </label>

                    <div className="rounded-xl bg-surface-high border border-outline-variant/40 p-3 space-y-2.5">
                      <div className="flex gap-2.5 text-xs text-on-surface-variant">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#d97706]" />
                        <span>Columnas: <strong>Nombre Alumno, Número, Curso, Asesor, Línea, Abono, Valor Curso, Método Pago, Fecha Pago</strong>. Estudiantes con el mismo teléfono solo reciben pagos nuevos.</span>
                      </div>
                      <button
                        onClick={descargarPlantilla}
                        className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface-variant hover:bg-surface-lowest hover:text-on-surface transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Descargar plantilla de ejemplo (.csv)
                      </button>
                    </div>

                    <button
                      onClick={() => importFile && importarMutation.mutate(importFile)}
                      disabled={!importFile || importarMutation.isPending}
                      className="w-full py-2.5 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      {importarMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                      {importarMutation.isPending ? 'Importando...' : 'Importar estudiantes'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

