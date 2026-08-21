'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { getClientToken, apiFetch } from '@/lib/api'
import Link from 'next/link'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { PanelFiltros, GrupoSegmentado, Interruptor } from '@/components/ui/PanelFiltros'
import { formatCOP, montoPagadoPago } from '@/lib/utils'
import { planDeCuotas } from '@/lib/cuotas'
import {
  Users, Search, Plus, ChevronLeft, ChevronRight,
  School, Phone, BookOpen, Loader2, Trash2, AlertTriangle,
  CheckCircle, Clock, ChevronRight as Arrow, Check,
  X, Download, CheckSquare, Square,
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
interface PagoMin  { monto: number; estado: string; fechaVencimiento: string; enPartes?: boolean; cuotaNumero?: number | null; cuotasTotal?: number | null }

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
  cursos?: { id: string; cursoId: string; descuentoPorcentaje: number; precioAcordado?: number | null; curso: { id: string; nombre: string; precio: number } }[]
  pagos?: PagoMin[]
  verificado?: boolean
  createdAt: string
}

interface PaginatedResponse {
  data: Estudiante[]
  pagination: { total: number; page: number; totalPages: number }
}

// ── Calcular resumen financiero ────────────────────────────────────────────
function calcFinanciero(e: Estudiante) {
  const hoy = new Date()

  // Total = precioAcordado (precio real de Hotmart, con descuento) si existe;
  // si no, precio de lista del curso SIN aplicar descuentoPorcentaje.
  const cursoEst     = e.cursos?.[0]
  const totalGeneral = cursoEst
    ? (cursoEst.precioAcordado ?? cursoEst.curso.precio)
    : (e.pagos?.reduce((s, p) => s + p.monto, 0) ?? 0)

  const totalPagado    = e.pagos?.filter(p => p.estado === 'PAGADO').reduce((s, p) => s + montoPagadoPago(p), 0) ?? 0
  const totalPendiente = Math.max(0, totalGeneral - totalPagado)
  const progreso       = totalGeneral > 0 ? Math.min(100, (totalPagado / totalGeneral) * 100) : 0

  // Las cuotas de una compra a plazos que Hotmart aún no ha cobrado no existen
  // como registro: se derivan para que una cuota atrasada no quede invisible.
  const plan        = planDeCuotas(e.pagos ?? [], hoy)
  const moraPagos   = e.pagos?.filter(p => p.estado === 'VENCIDO').reduce((s, p) => s + p.monto, 0) ?? 0
  const totalMora   = moraPagos + plan.mora

  // Si tiene curso pero 0 pagos → pendiente (nunca "sin deuda")
  const tieneCurso  = !!cursoEst
  const estado: 'al-dia' | 'pendiente' | 'mora' | 'sin-deuda' =
    totalMora > 0                       ? 'mora'      :
    totalPendiente > 0                  ? 'pendiente' :
    totalGeneral > 0 || tieneCurso      ? 'al-dia'    :
                                          'sin-deuda'

  // Cuotas de Hotmart (Smart Installment) — cuántas van pagadas del total.
  const cuotaInfo = plan.enPlazos ? { numero: plan.cuotasPagadas, total: plan.cuotasTotal } : null

  return { totalGeneral, totalPagado, totalPendiente, totalMora, progreso, estado, cuotaInfo }
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
  documentoUrl: '',
  cursoId: '', descuentoValor: '0',
  acudienteNombre: '', acudienteEmail: '', acudienteTelefono: '', acudienteRelacion: 'Padre',
  metodoPago: 'TRANSFERENCIA',
  fechaPago: '',
  comprobante: '',
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

// ── Botón Mi enlace (solo VENDEDOR) ───────────────────────────────────────
// ── Página principal ───────────────────────────────────────────────────────
export default function EstudiantesPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [busquedaInput, setBusquedaInput] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo,     setFiltroTipo]     = useState<'todos' | 'nuevo' | 'antiguo'>('todos')
  const [soloMios,       setSoloMios]       = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { setBusqueda(busquedaInput); setPage(1) }, 200)
    return () => clearTimeout(t)
  }, [busquedaInput])

  const [modalCrear, setModalCrear] = useState(false)
  const [pasoCrear, setPasoCrear] = useState(1)
  const [confirmEliminar, setConfirmEliminar] = useState<Estudiante | null>(null)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState(FORM_EMPTY)
  const [subiendoComprobante,  setSubiendoComprobante]  = useState(false)
  const [subiendoDocumento,    setSubiendoDocumento]    = useState(false)

  // ── Selección múltiple ──────────────────────────────────────────────────────
  const [modoSeleccion,    setModoSeleccion]    = useState(false)
  const [seleccionados,    setSeleccionados]    = useState<Set<string>>(new Set())
  const [confirmBulkElim,  setConfirmBulkElim]  = useState(false)

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

const cursos: { id: string; nombre: string; precio: number }[] = (cursosData?.data ?? []).filter((c: { activo: boolean }) => c.activo)

  const { data, isLoading } = useQuery({
    queryKey: ['estudiantes', page, busqueda, soloMios],
    queryFn: () => fetcher<PaginatedResponse>(`/estudiantes?page=${page}&limit=15${busqueda ? `&nombre=${encodeURIComponent(busqueda)}` : ''}${soloMios ? '&soloMios=true' : ''}`),
  })

  const crearMutation = useMutation({
    mutationFn: async () => {
      if (!form.nombre || !form.email || !form.telefono || !form.fechaNacimiento)
        throw new Error('Completa todos los campos obligatorios del estudiante')
      if (form.cursoId && !form.fechaPago)
        throw new Error('Ingresa la fecha del pago')
      const cursoPrecio = cursos.find(c => c.id === form.cursoId)?.precio ?? 0
      const descuentoValorNum = Number(form.descuentoValor) || 0
      const descuentoPct = cursoPrecio > 0 ? (descuentoValorNum / cursoPrecio) * 100 : 0

      const payload: any = {
        nombre: form.nombre.trim(), tipoDocumento: form.tipoDocumento,
        ...(form.documento.trim()   && { documento:    form.documento.trim() }),
        ...(form.documentoUrl       && { documentoUrl: form.documentoUrl }),
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
          formaPago: 'CONTADO',
          metodoPago: form.metodoPago, fechaPago: form.fechaPago,
          ...(form.comprobante && { comprobante: form.comprobante }),
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
      setModalCrear(false); setPasoCrear(1); setFormError(''); setForm(FORM_EMPTY)
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

  const eliminarBulkMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => fetcher(`/estudiantes/${id}`, { method: 'DELETE' })))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estudiantes'] })
      queryClient.invalidateQueries({ queryKey: ['saldos-pendientes'] })
      queryClient.invalidateQueries({ queryKey: ['reportes-dashboard'] })
      setSeleccionados(new Set())
      setModoSeleccion(false)
      setConfirmBulkElim(false)
    },
    onError: () => setConfirmBulkElim(false),
  })

  const [exportando, setExportando] = useState(false)
  async function exportarEstudiantes() {
    try {
      setExportando(true)
      const token = await getClientToken()
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/estudiantes/exportar`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      })
      if (!res.ok) throw new Error('Error al exportar')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      const fecha = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `estudiantes-grupo500-${fecha}.xlsx`
      // Adjuntar al DOM antes del click y revocar con retraso: si se revoca
      // de inmediato Chrome cancela la descarga y el archivo baja vacío.
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1500)
    } catch {
      alert('No se pudo exportar la base de estudiantes.')
    } finally {
      setExportando(false)
    }
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
    } finally { setSubiendoComprobante(false) }
  }

  const subirDocumento = async (file: File) => {
    setSubiendoDocumento(true)
    try {
      const token = await getClientToken()
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/imagen`, {
        method: 'POST', headers: { Authorization: `Bearer ${token ?? ''}` }, body: fd,
      })
      const json = await res.json()
      if (!res.ok || !json?.data?.url) throw new Error(json?.error ?? 'Error al subir')
      setForm(p => ({ ...p, documentoUrl: json.data.url }))
    } catch (e: any) {
      setFormError(e?.message ?? 'Error al subir documento')
    } finally { setSubiendoDocumento(false) }
  }

  const estudiantes = data?.data ?? []
  const totalPages  = data?.pagination?.totalPages ?? 1
  const totalCount  = data?.pagination?.total ?? 0

  // Filtros cliente
  // El filtro de matrícula (activos/inactivos) se eliminó: ya no se usaba
  // (Hotman, 21-ago).
  const estudiantesFiltrados = estudiantes
    .filter(e => {
      if (filtroTipo === 'nuevo')   return (e.cursos?.length ?? 0) <= 1
      if (filtroTipo === 'antiguo') return (e.cursos?.length ?? 0) > 1
      return true
    })

  const inputCls = 'w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20'
  const labelCls = 'block text-xs font-medium text-on-surface-variant mb-1'

  const cursoPrecioActual = cursos.find(c => c.id === form.cursoId)?.precio ?? 0
  const precioFinal = cursoPrecioActual - (Number(form.descuentoValor) || 0)

  const botonesAccion = (
    <>
      {isAdmin && (
        <button
          onClick={exportarEstudiantes}
          disabled={exportando}
          title="Exportar base de estudiantes a Excel"
          className="flex items-center gap-2 px-4 py-2 bg-surface-high border border-outline-variant text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-lowest transition-colors cursor-pointer disabled:opacity-60"
        >
          {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="hidden sm:inline">{exportando ? 'Exportando…' : 'Exportar'}</span>
        </button>
      )}
      <button
        onClick={() => { setModoSeleccion(m => !m); setSeleccionados(new Set()) }}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer border',
          modoSeleccion
            ? 'bg-primary/10 border-primary/40 text-primary'
            : 'bg-surface-high border-outline-variant text-on-surface hover:bg-surface-lowest',
        )}
      >
        <CheckSquare className="w-4 h-4" />
        <span className="hidden sm:inline">{modoSeleccion ? 'Cancelar' : 'Seleccionar'}</span>
      </button>
      <button onClick={() => { setModalCrear(true); setPasoCrear(1); setForm(FORM_EMPTY); setFormError('') }}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer">
        <Plus className="w-4 h-4" /><span className="hidden sm:inline">Nuevo</span>
      </button>
    </>
  )

  return (
    <div className="space-y-5">
      {/* Los mismos botones en dos sitios: junto al título en celular y en la
          fila del buscador en escritorio (Hotman, 21-ago). Definidos una vez
          para que no se desincronicen. */}
      <PageHeader
        title="Estudiantes"
        subtitle={`${totalCount} estudiante${totalCount !== 1 ? 's' : ''} registrado${totalCount !== 1 ? 's' : ''}`}
        actions={<div className="flex items-center gap-2 md:hidden">{botonesAccion}</div>}
      />

      {/* ── Buscar y filtrar, en un renglón (Hotman, 21-ago) ──
          Los filtros vivían en una tira que se arrastraba de lado y cortaba
          el último por la mitad; el de matrícula ya no se usaba y se fue.
          Ahora van detrás de un botón: hoja desde abajo en celular, panel
          colgado del botón en escritorio. */}
      <div className="flex items-center gap-2.5">
        <div className="relative min-w-0 flex-1 md:max-w-[520px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input type="text" placeholder="Buscar nombre, correo o teléfono" value={busquedaInput}
            onChange={e => setBusquedaInput(e.target.value)}
            className="h-11 w-full rounded-xl border border-outline-variant bg-surface-lowest pl-10 pr-4 text-sm text-on-surface placeholder-on-surface-variant focus:border-primary/50 focus:outline-none" />
          {busquedaInput && (
            <button
              onClick={() => setBusquedaInput('')}
              aria-label="Borrar búsqueda"
              className="absolute right-3 top-1/2 grid w-5 h-5 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-on-surface-variant opacity-60 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 md:ml-auto">
          <div className="hidden items-center gap-2 md:flex">{botonesAccion}</div>
          <PanelFiltros
            activos={(filtroTipo !== 'todos' ? 1 : 0) + (soloMios ? 1 : 0)}
            onLimpiar={() => { setFiltroTipo('todos'); setSoloMios(false); setPage(1) }}
            pie={`Ver ${(filtroTipo === 'todos' ? totalCount : estudiantesFiltrados.length).toLocaleString('es-CO')} estudiante${(filtroTipo === 'todos' ? totalCount : estudiantesFiltrados.length) !== 1 ? 's' : ''}`}
          >
            <GrupoSegmentado
              titulo="Tipo de estudiante"
              valor={filtroTipo}
              onCambio={v => setFiltroTipo(v)}
              opciones={[
                { val: 'todos',   label: 'Todos'   },
                { val: 'nuevo',   label: 'Nuevo'   },
                { val: 'antiguo', label: 'Antiguo' },
              ]}
            />
            <Interruptor
              titulo="Solo míos"
              detalle="Los estudiantes que yo matriculé"
              activo={soloMios}
              onCambio={v => { setSoloMios(v); setPage(1) }}
            />
          </PanelFiltros>
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
          <p className="text-sm">{busqueda ? 'Sin resultados' : 'No hay estudiantes registrados'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {estudiantesFiltrados.map(e => {
            const fin = calcFinanciero(e)
            const badge = BADGE[fin.estado]
            const curso = e.cursos?.[0]?.curso
            const tieneDeuda = fin.totalGeneral > 0
            const estaSeleccionado = seleccionados.has(e.id)

            const toggleSeleccion = () => {
              setSeleccionados(prev => {
                const next = new Set(prev)
                next.has(e.id) ? next.delete(e.id) : next.add(e.id)
                return next
              })
            }

            const CardWrapper = modoSeleccion ? 'div' : Link
            const wrapperProps = modoSeleccion
              ? { onClick: toggleSeleccion }
              : { href: `/estudiantes/${e.id}` }

            return (
              <CardWrapper key={e.id}
                {...(wrapperProps as any)}
                className={cn(
                  'group rounded-2xl border bg-surface-lowest p-4 transition-all duration-200 cursor-pointer flex flex-col gap-3 select-none',
                  modoSeleccion && estaSeleccionado
                    ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30'
                    : modoSeleccion
                    ? 'border-outline-variant hover:border-primary/30 hover:bg-surface-high'
                    : 'border-outline-variant hover:border-primary/40 hover:shadow-md active:scale-[0.98] active:border-primary/60 active:bg-surface-high',
                )}>

                {/* Header: avatar + nombre + badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Checkbox o avatar */}
                    {modoSeleccion ? (
                      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
                        estaSeleccionado ? 'bg-primary text-white' : 'bg-surface-high text-on-surface-variant border-2 border-outline-variant')}>
                        {estaSeleccionado
                          ? <Check className="w-5 h-5" />
                          : <Square className="w-4 h-4 opacity-40" />
                        }
                      </div>
                    ) : (
                    <div className={cn(
                      // El círculo lleva fondo propio y no un 10% del azul: sobre
                      // la tarjeta blanca ese tono casi no se distinguía y la
                      // inicial parecía flotar sola (Hotman, 21-ago).
                      'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold',
                      fin.estado === 'mora' ? 'bg-[#dc2626]/15 text-[#dc2626]' : 'bg-surface-low text-primary')}>
                      {e.nombre[0]?.toUpperCase()}
                    </div>
                    )}
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
                      <span>Pagado{fin.cuotaInfo && ` · Cuota ${fin.cuotaInfo.numero} de ${fin.cuotaInfo.total}`}</span>
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
                {!modoSeleccion && (
                  <div className="flex justify-end -mt-1">
                    <Arrow className="w-3.5 h-3.5 text-on-surface-variant opacity-0 group-hover:opacity-50 transition-opacity" />
                  </div>
                )}
              </CardWrapper>
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
                <p className="text-xs font-semibold text-on-surface-variant">Datos del estudiante</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Nombre completo *</label>
                    <input className={inputCls} value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre completo" />
                  </div>
                  <div>
                    <label className={labelCls}>Tipo doc.</label>
                    <Select className={inputCls} value={form.tipoDocumento} onValueChange={v => setForm(p => ({ ...p, tipoDocumento: v }))}
                      options={['CC','TI','CE','PA','RC'].map(t => ({ value: t, label: t }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Número de documento</label>
                    <input className={inputCls} value={form.documento} onChange={e => setForm(p => ({ ...p, documento: e.target.value }))} placeholder="Opcional" />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Documento de identidad (opcional)</label>
                    <label className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-surface-high border border-outline-variant rounded-lg hover:bg-surface-highest transition-colors">
                      <input type="file" accept="image/*,.pdf" className="hidden" disabled={subiendoDocumento}
                        onChange={e => { const f = e.target.files?.[0]; if (f) subirDocumento(f); e.target.value = '' }} />
                      {subiendoDocumento
                        ? <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        : <span className="text-sm">📄</span>}
                      <span className="text-sm text-on-surface-variant">
                        {subiendoDocumento ? 'Subiendo...' : form.documentoUrl ? '✓ Documento adjunto' : 'Adjuntar foto/PDF del documento'}
                      </span>
                    </label>
                    {form.documentoUrl && (
                      <a href={form.documentoUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1">
                        Ver documento adjunto →
                      </a>
                    )}
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
                    <Select className={inputCls} value={form.colegioId} onValueChange={v => setForm(p => ({ ...p, colegioId: v }))}
                      options={[{ value: '', label: 'Sin colegio' }, ...colegios.map(c => ({ value: c.id, label: c.nombre }))]} />
                  </div>
                  <div>
                    <label className={labelCls}>Departamento</label>
                    <Select className={inputCls} value={form.departamento} onValueChange={v => setForm(p => ({ ...p, departamento: v, ciudad: '' }))}
                      options={[{ value: '', label: 'Seleccionar' }, ...DEPARTAMENTOS.map(d => ({ value: d, label: d }))]} />
                  </div>
                  <div>
                    <label className={labelCls}>Ciudad</label>
                    <Select className={inputCls} value={form.ciudad} onValueChange={v => setForm(p => ({ ...p, ciudad: v }))} disabled={!form.departamento}
                      options={[{ value: '', label: 'Seleccionar' }, ...getMunicipios(form.departamento).map(m => ({ value: m, label: m }))]} />
                  </div>
                  {isAdmin && (
                    <div>
                      <label className={labelCls}>Asesor</label>
                      <Select className={inputCls} value={form.asesorId} onValueChange={v => setForm(p => ({ ...p, asesorId: v }))}
                        options={[{ value: '', label: 'Sin asignar' }, ...asesores.map(a => ({ value: a.id, label: a.nombre }))]} />
                    </div>
                  )}
                  {isAdmin && (
                    <div>
                      <label className={labelCls}>Línea autorizada</label>
                      <Select className={inputCls} value={form.lineaAutorizada} onValueChange={v => setForm(p => ({ ...p, lineaAutorizada: v }))}
                        options={[{ value: '', label: 'Sin asignar' }, ...[1,2,3,4,5,6].map(n => ({ value: String(n), label: `Línea ${n}` }))]} />
                    </div>
                  )}
                </div>

                <p className="text-xs font-semibold text-on-surface-variant mt-4">Acudiente (opcional)</p>
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
                    <Select className={inputCls} value={form.acudienteRelacion} onValueChange={v => setForm(p => ({ ...p, acudienteRelacion: v }))}
                      options={['Padre','Madre','Tutor','Hermano/a','Otro'].map(r => ({ value: r, label: r }))} />
                  </div>
                </div>
              </>
            )}

            {/* ── Paso 2: Curso ── */}
            {pasoCrear === 2 && (
              <>
                <p className="text-xs font-semibold text-on-surface-variant">Curso adquirido</p>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Curso</label>
                    <Select className={inputCls} value={form.cursoId} onValueChange={v => setForm(p => ({ ...p, cursoId: v, descuentoValor: '0' }))} anchoAuto multilinea
                      options={[{ value: '', label: 'Sin curso por ahora' }, ...cursos.map(c => ({ value: c.id, label: `${c.nombre} — ${formatCOP(c.precio)}` }))]} />
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
                        <label className={labelCls}>Método de pago</label>
                        <Select className={inputCls} value={form.metodoPago} onValueChange={v => setForm(p => ({ ...p, metodoPago: v }))}
                          options={['TRANSFERENCIA','TARJETA','EFECTIVO','OTRO'].map(m => ({ value: m, label: m }))} />
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
                </div>
              </>
            )}

            {/* ── Paso 3: Revisión ── */}
            {pasoCrear === 3 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-on-surface-variant">Revisión</p>
                <div className="rounded-xl border border-outline-variant divide-y divide-outline-variant/40">
                  {[
                    ['Nombre', form.nombre],
                    ['Email', form.email],
                    ['Teléfono', form.telefono],
                    ['Documento', form.tipoDocumento + (form.documento ? ` ${form.documento}` : '')],
                    ...(form.cursoId ? [['Curso', cursos.find(c => c.id === form.cursoId)?.nombre ?? '']] : []),
                    ...(form.cursoId && Number(form.descuentoValor) > 0 ? [['Descuento', formatCOP(Number(form.descuentoValor))]] : []),
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


      {/* ── Barra flotante de selección múltiple ── */}
      {modoSeleccion && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md">
          <div className="bg-[var(--surface-lowest)] border border-outline-variant rounded-2xl shadow-float px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {/* Seleccionar todo / ninguno */}
              <button
                onClick={() => {
                  const todosIds = estudiantesFiltrados.map(e => e.id)
                  const todosSeleccionados = todosIds.every(id => seleccionados.has(id))
                  setSeleccionados(todosSeleccionados ? new Set() : new Set(todosIds))
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-high transition-colors cursor-pointer"
                title="Seleccionar / deseleccionar todos"
              >
                {estudiantesFiltrados.length > 0 && estudiantesFiltrados.every(e => seleccionados.has(e.id))
                  ? <CheckSquare className="w-4 h-4 text-primary" />
                  : <Square className="w-4 h-4 text-on-surface-variant" />
                }
              </button>
              <div>
                <p className="text-sm font-semibold text-on-surface">
                  {seleccionados.size === 0 ? 'Selecciona estudiantes' : `${seleccionados.size} seleccionado${seleccionados.size !== 1 ? 's' : ''}`}
                </p>
                {seleccionados.size > 0 && (
                  <p className="text-[10px] text-on-surface-variant">Toca las tarjetas para seleccionar</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {seleccionados.size > 0 && (
                <button
                  onClick={() => setConfirmBulkElim(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--error)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar
                </button>
              )}
              <button
                onClick={() => { setModoSeleccion(false); setSeleccionados(new Set()) }}
                className="p-1.5 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm eliminar en lote */}
      {confirmBulkElim && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmBulkElim(false)} />
          <div className="relative bg-surface-lowest border border-outline-variant rounded-xl shadow-float w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--error-container)' }}>
                <Trash2 className="w-5 h-5" style={{ color: 'var(--error)' }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface">¿Eliminar {seleccionados.size} estudiante{seleccionados.size !== 1 ? 's' : ''}?</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmBulkElim(false)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">Cancelar</button>
              <button onClick={() => eliminarBulkMutation.mutate(Array.from(seleccionados))} disabled={eliminarBulkMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--error)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer">
                {eliminarBulkMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

