'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth, useUser } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate } from '@/lib/utils'
import {
  Users, Search, Plus, ChevronLeft, ChevronRight,
  School, Phone, Mail, Eye, X, Loader2, Trash2, Pencil,
  Paperclip, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DEPARTAMENTOS, getMunicipios } from '@/lib/colombia'

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
  createdAt: string
}

interface PaginatedResponse {
  data: Estudiante[]
  pagination: { total: number; page: number; totalPages: number }
}

const FORM_EMPTY = {
  nombre: '', tipoDocumento: 'CC', documento: '',
  email: '', telefono: '', fechaNacimiento: '',
  departamento: '', ciudad: '', colegioId: '', asesorId: '',
  cursoId: '', descuentoPorcentaje: '0',
  acudienteNombre: '', acudienteEmail: '', acudienteTelefono: '', acudienteRelacion: 'Padre',
  // Pago integrado
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

export default function EstudiantesPage() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const isAdmin = user?.publicMetadata?.role === 'ADMIN'
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [busquedaInput, setBusquedaInput] = useState('')
  const [busqueda, setBusqueda] = useState('')

  // Debounce: espera 400ms después de que el usuario deje de escribir
  useEffect(() => {
    const t = setTimeout(() => { setBusqueda(busquedaInput); setPage(1) }, 200)
    return () => clearTimeout(t)
  }, [busquedaInput])
  const [modalCrear, setModalCrear] = useState(false)
  const [pasoCrear, setPasoCrear] = useState(1)
  const [modalDetalle, setModalDetalle] = useState<Estudiante | null>(null)
  const [modalEditar, setModalEditar] = useState<Estudiante | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState<Estudiante | null>(null)
  const [formError, setFormError] = useState('')
  const [formEditError, setFormEditError] = useState('')

  const [form, setForm] = useState(FORM_EMPTY)
  const [formEdit, setFormEdit] = useState(FORM_EMPTY)

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getToken()
    return createClientFetcher(token)<T>(path, opts)
  }

  const { data: colegiosData } = useQuery({
    queryKey: ['colegios'],
    queryFn: () => fetcher<any>('/colegios'),
  })
  const colegios: { id: string; nombre: string }[] = colegiosData?.data ?? []

  const { data: asesoresData } = useQuery({
    queryKey: ['asesores-select'],
    queryFn: () => fetcher<any>('/asesores?limit=100'),
    enabled: isAdmin,
  })
  const asesores: { id: string; nombre: string }[] = asesoresData?.data ?? []

  const { data: cursosData } = useQuery({
    queryKey: ['cursos-select'],
    queryFn: () => fetcher<any>('/cursos?limit=100'),
  })
  const cursos: { id: string; nombre: string; precio: number }[] = cursosData?.data ?? []

  const { data, isLoading } = useQuery({
    queryKey: ['estudiantes', page, busqueda],
    queryFn: () => fetcher<PaginatedResponse>(
      `/estudiantes?page=${page}&limit=15${busqueda ? `&nombre=${busqueda}` : ''}`
    ),
  })

  // ── Crear ──────────────────────────────────────────────────────────────
  const crearMutation = useMutation({
    mutationFn: async () => {
      if (!form.nombre || !form.email || !form.telefono || !form.fechaNacimiento)
        throw new Error('Completa todos los campos obligatorios del estudiante')
      if (form.cursoId && form.formaPago === 'CONTADO' && !form.fechaPago)
        throw new Error('Ingresa la fecha del pago')
      if (form.cursoId && form.formaPago === 'FINANCIADO' && !form.fechaPrimeraCuota)
        throw new Error('Ingresa la fecha de la primera cuota')

      const payload: any = {
        nombre: form.nombre.trim(),
        tipoDocumento: form.tipoDocumento,
        ...(form.documento.trim() && { documento: form.documento.trim() }),
        email: form.email.trim(),
        telefono: form.telefono.trim(),
        fechaNacimiento: form.fechaNacimiento,
        ...(form.departamento && { departamento: form.departamento }),
        ...(form.ciudad       && { ciudad:       form.ciudad }),
        ...(form.colegioId    && { colegioId:    form.colegioId }),
        ...(form.cursoId && {
          cursoId:             form.cursoId,
          descuentoPorcentaje: Number(form.descuentoPorcentaje),
          formaPago:           form.formaPago,
          ...(form.formaPago === 'CONTADO' && {
            metodoPago:  form.metodoPago,
            fechaPago:   form.fechaPago,
            ...(form.comprobante && { comprobante: form.comprobante }),
          }),
          ...(form.formaPago === 'FINANCIADO' && {
            numeroCuotas:      Number(form.numeroCuotas),
            fechaPrimeraCuota: form.fechaPrimeraCuota,
          }),
        }),
      }

      const acudienteCompleto = form.acudienteNombre.trim() && form.acudienteEmail.trim() && form.acudienteTelefono.trim()
      if (acudienteCompleto) {
        payload.acudiente = {
          nombre: form.acudienteNombre.trim(),
          email:  form.acudienteEmail.trim(),
          telefono: form.acudienteTelefono.trim(),
          relacion: form.acudienteRelacion,
        }
      }

      return fetcher('/estudiantes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estudiantes'] })
      queryClient.invalidateQueries({ queryKey: ['estudiantes-select'] })
      queryClient.invalidateQueries({ queryKey: ['pagos'] })
      queryClient.invalidateQueries({ queryKey: ['financiamientos'] })
      setModalCrear(false)
      setPasoCrear(1)
      setFormError('')
      setForm(FORM_EMPTY)
    },
    onError: (e: any) => setFormError(e.message ?? 'Error al crear el estudiante'),
  })

  // ── Editar ─────────────────────────────────────────────────────────────
  const editarMutation = useMutation({
    mutationFn: async () => {
      if (!modalEditar) return
      if (!formEdit.nombre || !formEdit.email || !formEdit.telefono || !formEdit.fechaNacimiento)
        throw new Error('Completa todos los campos obligatorios')

      const payload: any = {
        nombre: formEdit.nombre.trim(),
        tipoDocumento: formEdit.tipoDocumento,
        documento: formEdit.documento.trim() || null,
        email: formEdit.email.trim(),
        telefono: formEdit.telefono.trim(),
        fechaNacimiento: formEdit.fechaNacimiento,
        departamento: formEdit.departamento || null,
        ciudad: formEdit.ciudad || null,
        colegioId: formEdit.colegioId || null,
        ...(isAdmin && { asesorId: formEdit.asesorId || null }),
        ...(isAdmin && { cursoId: formEdit.cursoId || null, descuentoPorcentaje: Number(formEdit.descuentoPorcentaje) }),
      }

      return fetcher(`/estudiantes/${modalEditar.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estudiantes'] })
      setModalEditar(null)
      setFormEditError('')
    },
    onError: (e: any) => setFormEditError(e.message ?? 'Error al actualizar el estudiante'),
  })

  // ── Eliminar ───────────────────────────────────────────────────────────
  const [eliminarError, setEliminarError] = useState('')

  const eliminarMutation = useMutation({
    mutationFn: (id: string) => fetcher(`/estudiantes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estudiantes'] })
      queryClient.invalidateQueries({ queryKey: ['estudiantes-select'] })
      setEliminarError('')
      setConfirmEliminar(null)
    },
    onError: (e: any) => {
      setEliminarError(e.message ?? 'Error al eliminar el estudiante')
      setConfirmEliminar(null)
    },
  })

  const abrirEditar = (e: Estudiante) => {
    const cursoActivo = e.cursos?.[0]
    setFormEdit({
      nombre: e.nombre,
      tipoDocumento: e.tipoDocumento ?? 'CC',
      documento: e.documento ?? '',
      email: e.email,
      telefono: e.telefono,
      fechaNacimiento: e.fechaNacimiento ? e.fechaNacimiento.split('T')[0] : '',
      departamento: e.departamento ?? '',
      ciudad: e.ciudad ?? '',
      colegioId: e.colegio?.id ?? '',
      asesorId: e.asesor?.id ?? '',
      cursoId: cursoActivo?.cursoId ?? '',
      descuentoPorcentaje: String(cursoActivo?.descuentoPorcentaje ?? 0),
      acudienteNombre: e.acudiente?.nombre ?? '',
      acudienteEmail: e.acudiente?.email ?? '',
      acudienteTelefono: e.acudiente?.telefono ?? '',
      acudienteRelacion: e.acudiente?.relacion ?? 'Padre',
      formaPago: 'CONTADO',
      metodoPago: 'TRANSFERENCIA',
      fechaPago: '',
      comprobante: '',
      numeroCuotas: '3',
      fechaPrimeraCuota: '',
    })
    setFormEditError('')
    setModalEditar(e)
  }

  const estudiantes = data?.data ?? []
  const total = data?.pagination?.total ?? 0
  const totalPages = data?.pagination?.totalPages ?? 1

  const inputCls = 'w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20'
  const labelCls = 'block text-xs font-medium text-on-surface-variant mb-1'

  const [subiendoComprobante, setSubiendoComprobante] = useState(false)
  const subirComprobante = async (file: File) => {
    setSubiendoComprobante(true)
    try {
      const token = await getToken()
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/imagen`, {
        method: 'POST', headers: { Authorization: `Bearer ${token ?? ''}` }, body: fd,
      })
      const json = await res.json()
      if (!res.ok || !json?.data?.url) throw new Error(json?.error ?? 'Error al subir')
      setForm(p => ({ ...p, comprobante: json.data.url }))
    } catch (e: any) {
      setFormError(e?.message ?? 'Error al subir comprobante')
    } finally {
      setSubiendoComprobante(false)
    }
  }

  // ── Formulario reutilizable ────────────────────────────────────────────
  const renderFormFields = (f: typeof FORM_EMPTY, setF: (fn: (prev: typeof FORM_EMPTY) => typeof FORM_EMPTY) => void) => (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-primary uppercase tracking-wider">Datos del estudiante</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Nombre completo *</label>
          <input className={inputCls} value={f.nombre} onChange={e => setF(p => ({ ...p, nombre: e.target.value }))} placeholder="Juan Pérez" />
        </div>
        <div>
          <label className={labelCls}>Tipo de documento</label>
          <select className={inputCls} value={f.tipoDocumento} onChange={e => setF(p => ({ ...p, tipoDocumento: e.target.value }))}>
            <option value="CC">Cédula de ciudadanía (CC)</option>
            <option value="TI">Tarjeta de identidad (TI)</option>
            <option value="RC">Registro civil (RC)</option>
            <option value="CE">Cédula extranjería (CE)</option>
            <option value="PA">Pasaporte (PA)</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Número de documento</label>
          <input className={inputCls} value={f.documento} onChange={e => setF(p => ({ ...p, documento: e.target.value }))} placeholder="1000123456" />
        </div>
        <div>
          <label className={labelCls}>Email *</label>
          <input className={inputCls} type="email" value={f.email} onChange={e => setF(p => ({ ...p, email: e.target.value }))} placeholder="juan@email.com" />
        </div>
        <div>
          <label className={labelCls}>Teléfono *</label>
          <input className={inputCls} value={f.telefono} onChange={e => setF(p => ({ ...p, telefono: e.target.value }))} placeholder="3001234567" />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls}>Fecha de nacimiento *</label>
          <input
            className={cn(inputCls, 'w-auto min-w-0 max-w-[160px]')}
            type="date"
            value={f.fechaNacimiento}
            onChange={e => setF(p => ({ ...p, fechaNacimiento: e.target.value }))}
          />
        </div>
        <div>
          <label className={labelCls}>Departamento</label>
          <select className={inputCls} value={f.departamento} onChange={e => setF(p => ({ ...p, departamento: e.target.value, ciudad: '' }))}>
            <option value="">Seleccionar departamento</option>
            {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Ciudad / Municipio</label>
          <select className={inputCls} value={f.ciudad} onChange={e => setF(p => ({ ...p, ciudad: e.target.value }))} disabled={!f.departamento}>
            <option value="">{f.departamento ? 'Seleccionar municipio' : 'Primero elige departamento'}</option>
            {getMunicipios(f.departamento).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Colegio</label>
          <select className={inputCls} value={f.colegioId} onChange={e => setF(p => ({ ...p, colegioId: e.target.value }))}>
            <option value="">Sin colegio</option>
            {colegios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      <p className="text-xs font-semibold text-primary uppercase tracking-wider pt-2">Datos del acudiente</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Nombre del acudiente</label>
          <input className={inputCls} value={f.acudienteNombre} onChange={e => setF(p => ({ ...p, acudienteNombre: e.target.value }))} placeholder="María López" />
        </div>
        <div>
          <label className={labelCls}>Email acudiente</label>
          <input className={inputCls} type="email" value={f.acudienteEmail} onChange={e => setF(p => ({ ...p, acudienteEmail: e.target.value }))} placeholder="maria@email.com" />
        </div>
        <div>
          <label className={labelCls}>Teléfono acudiente</label>
          <input className={inputCls} value={f.acudienteTelefono} onChange={e => setF(p => ({ ...p, acudienteTelefono: e.target.value }))} placeholder="3009876543" />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Relación</label>
          <select className={inputCls} value={f.acudienteRelacion} onChange={e => setF(p => ({ ...p, acudienteRelacion: e.target.value }))}>
            <option>Padre</option><option>Madre</option><option>Tutor</option><option>Otro</option>
          </select>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Estudiantes"
        subtitle={`${total} estudiantes registrados`}
        actions={
          <button onClick={() => setModalCrear(true)} className="flex items-center gap-2 px-2.5 py-2.5 sm:px-4 sm:py-2 bg-primary text-on-primary rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">Nuevo estudiante</span>
          </button>
        }
      />

      {/* Búsqueda */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={busquedaInput}
            onChange={e => setBusquedaInput(e.target.value)}
            className="w-full bg-surface-high border border-outline-variant rounded-lg pl-9 pr-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
        </div>
        {busquedaInput && (
          <button type="button" onClick={() => setBusquedaInput('')} className="px-3 py-2 text-on-surface-variant hover:text-on-surface">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Grid mobile (< md) ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 md:hidden"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : estudiantes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant bg-surface-lowest border border-outline-variant rounded-xl md:hidden">
          <Users className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No se encontraron estudiantes</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:hidden">
          {estudiantes.map((e) => (
            <div key={e.id} className="bg-surface-lowest border border-outline-variant rounded-xl p-3 flex flex-col gap-2.5 hover:border-primary/30 transition-colors">
              {/* Avatar + nombre */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary">{e.nombre[0]?.toUpperCase()}</span>
                </div>
                <p className="text-xs font-semibold text-on-surface leading-tight line-clamp-2">{e.nombre}</p>
              </div>
              {/* Info */}
              <div className="space-y-1">
                <p className="flex items-center gap-1 text-[11px] text-on-surface-variant truncate">
                  <Phone className="w-3 h-3 flex-shrink-0" />{e.telefono}
                </p>
                {e.colegio && (
                  <p className="flex items-center gap-1 text-[11px] text-on-surface-variant truncate">
                    <School className="w-3 h-3 flex-shrink-0" />{e.colegio.nombre}
                  </p>
                )}
              </div>
              {/* Acciones */}
              <div className="flex items-center gap-1 pt-1 border-t border-outline-variant/40">
                <button onClick={() => setModalDetalle(e)} className="flex-1 flex items-center justify-center py-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors" title="Ver detalle">
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => abrirEditar(e)} className="flex-1 flex items-center justify-center py-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors" title="Editar">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => setConfirmEliminar(e)} className="flex-1 flex items-center justify-center py-1.5 rounded-lg text-on-surface-variant hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors" title="Eliminar">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginación mobile */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between md:hidden">
          <p className="text-xs text-white/70">Pág. {page} / {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-high disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-high disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* ── Tabla desktop (≥ md) ── */}
      <div className="hidden md:block bg-surface-lowest border border-outline-variant rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
        ) : estudiantes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
            <Users className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No se encontraron estudiantes</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-low">
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Estudiante</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden md:table-cell">Colegio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">Acudiente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden xl:table-cell">Asesor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">Registrado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {estudiantes.map((e) => (
                <tr key={e.id} className="hover:bg-surface-low/40 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">{e.nombre[0]?.toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-on-surface">{e.nombre}</p>
                        <p className="text-xs text-on-surface-variant flex items-center gap-1"><Mail className="w-3 h-3" />{e.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="flex items-center gap-1.5 text-sm text-on-surface-variant">
                      <School className="w-3.5 h-3.5" />
                      {e.colegio?.nombre ?? <span className="italic opacity-40">Sin colegio</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {e.acudiente ? (
                      <div>
                        <p className="text-sm text-on-surface">{e.acudiente.nombre}</p>
                        <p className="text-xs text-on-surface-variant flex items-center gap-1"><Phone className="w-3 h-3" />{e.acudiente.telefono}</p>
                      </div>
                    ) : <span className="text-xs text-on-surface-variant italic opacity-40">Sin acudiente</span>}
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <span className="text-sm text-on-surface-variant">{e.asesor?.nombre ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-on-surface-variant">{formatDate(e.createdAt)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setModalDetalle(e)} className="p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors" title="Ver detalle">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => abrirEditar(e)} className="p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors" title="Editar estudiante">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmEliminar(e)}
                        className="p-1.5 rounded text-on-surface-variant hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors" title="Eliminar estudiante">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant/40">
            <p className="text-xs text-on-surface-variant">Página {page} de {totalPages} · {total} resultados</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-high disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-high disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Error eliminar (fuera de la tabla para que se vea en mobile también) */}
      {eliminarError && (
        <div className="px-4 py-2 text-xs text-[var(--error)] bg-[var(--error-container)]/40 border border-[var(--error)]/20 rounded-xl">
          {eliminarError}
        </div>
      )}

      {/* Modal crear — 3 pasos */}
      <Modal open={modalCrear} onClose={() => { setModalCrear(false); setPasoCrear(1); setFormError(''); setForm(FORM_EMPTY) }}>
        <div className="flex flex-col max-h-[90vh]">
          {/* Header fijo */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
            <div>
              <h2 className="text-base font-semibold text-on-surface">Nuevo estudiante</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">Paso {pasoCrear} de {form.cursoId || pasoCrear >= 2 ? 3 : 2}</p>
            </div>
            <button onClick={() => { setModalCrear(false); setPasoCrear(1); setFormError(''); setForm(FORM_EMPTY) }} className="p-1.5 text-on-surface-variant hover:text-on-surface"><X className="w-4 h-4" /></button>
          </div>

          {/* Indicador de pasos */}
          <div className="flex items-center gap-0 px-6 pb-5 flex-shrink-0">
            {[
              { n: 1, label: 'Estudiante' },
              { n: 2, label: 'Curso' },
              { n: 3, label: 'Pago' },
            ].map(({ n, label }, i) => (
              <div key={n} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors',
                    pasoCrear > n ? 'bg-secondary text-black' :
                    pasoCrear === n ? 'bg-primary text-on-primary' :
                    'bg-surface-high text-on-surface-variant border border-outline-variant'
                  )}>
                    {pasoCrear > n ? '✓' : n}
                  </div>
                  <span className={cn('text-[10px] font-medium', pasoCrear === n ? 'text-primary' : 'text-on-surface-variant')}>{label}</span>
                </div>
                {i < 2 && <div className={cn('h-px flex-1 mb-4 mx-1 transition-colors', pasoCrear > n ? 'bg-secondary' : 'bg-outline-variant')} />}
              </div>
            ))}
          </div>

          {/* Contenido scrollable */}
          <div className="overflow-y-auto flex-1 px-6 pb-2">
            {pasoCrear === 1 && renderFormFields(form, setForm)}

            {pasoCrear === 2 && (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">Curso adquirido</p>
                <div>
                  <label className={labelCls}>Curso</label>
                  <select className={inputCls} value={form.cursoId} onChange={e => setForm(p => ({ ...p, cursoId: e.target.value }))}>
                    <option value="">Sin curso por ahora</option>
                    {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre} — ${c.precio.toLocaleString('es-CO')}</option>)}
                  </select>
                </div>
                {form.cursoId && (
                  <>
                    <div>
                      <label className={labelCls}>Descuento (%)</label>
                      <input className={inputCls} type="number" min="0" max="100" value={form.descuentoPorcentaje}
                        onChange={e => setForm(p => ({ ...p, descuentoPorcentaje: e.target.value }))} placeholder="0" />
                    </div>
                    {(() => {
                      const c = cursos.find(c => c.id === form.cursoId)
                      if (!c) return null
                      const desc = Number(form.descuentoPorcentaje)
                      const final = c.precio * (1 - desc / 100)
                      return (
                        <div className="bg-primary/5 border border-primary/15 rounded-xl p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[11px] text-on-surface-variant">Precio base</p>
                              <p className={cn('text-sm font-medium', desc > 0 && 'line-through text-on-surface-variant')}>${c.precio.toLocaleString('es-CO')}</p>
                            </div>
                            {desc > 0 && (
                              <div className="text-center">
                                <span className="text-xs font-bold bg-secondary/15 text-secondary px-2 py-1 rounded-full">−{desc}%</span>
                              </div>
                            )}
                            <div className="text-right">
                              <p className="text-[11px] text-on-surface-variant">Total a cobrar</p>
                              <p className="text-lg font-bold text-primary">${final.toLocaleString('es-CO')}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </>
                )}
                {!form.cursoId && (
                  <p className="text-xs text-on-surface-variant italic bg-surface-high rounded-lg px-3 py-3">
                    Si no seleccionas un curso, el estudiante quedará registrado sin venta asociada. Podrás asignarlo después.
                  </p>
                )}
              </div>
            )}

            {pasoCrear === 3 && (
              <div className="space-y-4">
                {form.cursoId ? (
                  <>
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider">Forma de pago</p>
                    {/* Selector contado / financiado */}
                    <div className="grid grid-cols-2 gap-3">
                      {(['CONTADO', 'FINANCIADO'] as const).map(op => (
                        <button key={op} onClick={() => setForm(p => ({ ...p, formaPago: op }))}
                          className={cn(
                            'flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 text-sm font-semibold transition-colors',
                            form.formaPago === op
                              ? 'border-primary bg-primary/8 text-primary'
                              : 'border-outline-variant bg-surface-high text-on-surface-variant hover:border-primary/40'
                          )}>
                          <span className="text-xl">{op === 'CONTADO' ? '💳' : '📅'}</span>
                          {op === 'CONTADO' ? 'Contado' : 'Financiado'}
                          <span className="text-[10px] font-normal text-on-surface-variant">
                            {op === 'CONTADO' ? 'Pago único inmediato' : 'Cuotas mensuales'}
                          </span>
                        </button>
                      ))}
                    </div>

                    {form.formaPago === 'CONTADO' && (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className={labelCls}>Método de pago *</label>
                          <select className={inputCls} value={form.metodoPago} onChange={e => setForm(p => ({ ...p, metodoPago: e.target.value }))}>
                            <option value="TRANSFERENCIA">Transferencia</option>
                            <option value="EFECTIVO">Efectivo</option>
                            <option value="TARJETA">Tarjeta</option>
                            <option value="OTRO">Otro</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Fecha del pago *</label>
                          <input className={cn(inputCls, 'max-w-[180px]')} type="date" value={form.fechaPago}
                            onChange={e => setForm(p => ({ ...p, fechaPago: e.target.value }))} />
                        </div>
                        <div>
                          <label className={labelCls}>Comprobante (opcional)</label>
                          <label className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-surface-high border border-outline-variant rounded-lg hover:bg-surface-highest transition-colors">
                            <input type="file" accept="image/*,.pdf" className="hidden" disabled={subiendoComprobante}
                              onChange={e => { const f = e.target.files?.[0]; if (f) subirComprobante(f); e.target.value = '' }} />
                            {subiendoComprobante ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <Paperclip className="w-4 h-4 text-on-surface-variant" />}
                            <span className="text-sm text-on-surface-variant">
                              {subiendoComprobante ? 'Subiendo...' : form.comprobante ? 'Cambiar comprobante' : 'Adjuntar comprobante'}
                            </span>
                          </label>
                          {form.comprobante && (
                            <a href={form.comprobante} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                              <ExternalLink className="w-3 h-3" />Ver comprobante
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {form.formaPago === 'FINANCIADO' && (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className={labelCls}>Número de cuotas *</label>
                          <select className={inputCls} value={form.numeroCuotas} onChange={e => setForm(p => ({ ...p, numeroCuotas: e.target.value }))}>
                            {[2,3,4,5,6,8,10,12].map(n => <option key={n} value={n}>{n} cuotas</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Fecha primera cuota *</label>
                          <input className={cn(inputCls, 'max-w-[180px]')} type="date" value={form.fechaPrimeraCuota}
                            onChange={e => setForm(p => ({ ...p, fechaPrimeraCuota: e.target.value }))} />
                        </div>
                        {form.cursoId && form.numeroCuotas && (() => {
                          const c = cursos.find(c => c.id === form.cursoId)
                          if (!c) return null
                          const total = c.precio * (1 - Number(form.descuentoPorcentaje) / 100)
                          const cuota = total / Number(form.numeroCuotas)
                          return (
                            <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 flex items-center justify-between">
                              <div>
                                <p className="text-[11px] text-on-surface-variant">Total financiado</p>
                                <p className="text-sm font-bold text-on-surface">${total.toLocaleString('es-CO')}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[11px] text-on-surface-variant">Valor por cuota</p>
                                <p className="text-lg font-bold text-primary">${cuota.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</p>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-on-surface-variant">
                    <p className="text-sm">No seleccionaste un curso.</p>
                    <p className="text-xs mt-1">Vuelve al paso anterior para elegir el curso antes de configurar el pago.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer fijo */}
          {formError && <p className="mx-6 mt-2 text-xs text-[var(--error)] bg-[var(--error-container)]/40 border border-[var(--error)]/20 rounded-lg px-3 py-2">{formError}</p>}
          <div className="flex justify-between gap-3 px-6 py-4 border-t border-outline-variant/40 flex-shrink-0">
            <button
              onClick={() => pasoCrear > 1 ? setPasoCrear(p => p - 1) : (setModalCrear(false), setPasoCrear(1), setForm(FORM_EMPTY))}
              className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
              {pasoCrear === 1 ? 'Cancelar' : '← Anterior'}
            </button>
            {pasoCrear < 3 ? (
              <button
                onClick={() => {
                  if (pasoCrear === 1 && (!form.nombre || !form.email || !form.telefono || !form.fechaNacimiento)) {
                    setFormError('Completa nombre, email, teléfono y fecha de nacimiento')
                    return
                  }
                  setFormError('')
                  setPasoCrear(p => p + 1)
                }}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                Siguiente →
              </button>
            ) : (
              <button
                onClick={() => crearMutation.mutate()}
                disabled={crearMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {crearMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Registrar estudiante
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal editar */}
      <Modal open={!!modalEditar} onClose={() => setModalEditar(null)}>
        {modalEditar && (
          <div className="p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-on-surface">Editar estudiante</h2>
              <button onClick={() => setModalEditar(null)} className="p-1.5 text-on-surface-variant hover:text-on-surface"><X className="w-4 h-4" /></button>
            </div>
            {renderFormFields(formEdit, setFormEdit)}

            {/* Asignación — solo admin */}
            {isAdmin && (
              <div className="mt-4 pt-4 border-t border-outline-variant space-y-3">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">Asignación (solo admin)</p>
                <div>
                  <label className={labelCls}>Asesor asignado</label>
                  <select className={inputCls} value={formEdit.asesorId} onChange={e => setFormEdit(p => ({ ...p, asesorId: e.target.value }))}>
                    <option value="">Sin asesor</option>
                    {asesores.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className={labelCls}>Curso adquirido</label>
                    <select className={inputCls} value={formEdit.cursoId} onChange={e => setFormEdit(p => ({ ...p, cursoId: e.target.value }))}>
                      <option value="">Sin curso</option>
                      {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Descuento (%)</label>
                    <input className={cn(inputCls, !formEdit.cursoId && 'opacity-50 cursor-not-allowed')} type="number" min="0" max="100"
                      value={formEdit.descuentoPorcentaje} disabled={!formEdit.cursoId}
                      onChange={e => setFormEdit(p => ({ ...p, descuentoPorcentaje: e.target.value }))} placeholder="0" />
                  </div>
                </div>
              </div>
            )}

            {formEditError && <p className="mt-4 text-xs text-[var(--error)] bg-[var(--error-container)]/40 border border-[var(--error)]/20 rounded-lg px-3 py-2">{formEditError}</p>}
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setModalEditar(null)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors">Cancelar</button>
              <button onClick={() => editarMutation.mutate()} disabled={editarMutation.isPending || !formEdit.nombre || !formEdit.email || !formEdit.telefono || !formEdit.fechaNacimiento}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {editarMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Guardar cambios
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm eliminar */}
      <ConfirmDialog
        open={!!confirmEliminar}
        nombre={confirmEliminar?.nombre ?? ''}
        isPending={eliminarMutation.isPending}
        onConfirm={() => confirmEliminar && eliminarMutation.mutate(confirmEliminar.id)}
        onCancel={() => setConfirmEliminar(null)}
      />

      {/* Modal detalle */}
      <Modal open={!!modalDetalle} onClose={() => setModalDetalle(null)}>
        {modalDetalle && (
          <div className="p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{modalDetalle.nombre[0]?.toUpperCase()}</span>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-on-surface">{modalDetalle.nombre}</h2>
                  <p className="text-xs text-on-surface-variant">Registrado {formatDate(modalDetalle.createdAt)}</p>
                </div>
              </div>
              <button onClick={() => setModalDetalle(null)} className="p-1.5 text-on-surface-variant hover:text-on-surface"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              {/* Curso */}
              {modalDetalle.cursos && modalDetalle.cursos.length > 0 && (() => {
                const ce = modalDetalle.cursos![0]
                const precioFinal = ce.curso.precio * (1 - ce.descuentoPorcentaje / 100)
                return (
                  <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-primary font-semibold uppercase tracking-wider mb-0.5">Curso adquirido</p>
                      <p className="text-sm font-semibold text-on-surface">{ce.curso.nombre}</p>
                    </div>
                    <div className="text-right">
                      {ce.descuentoPorcentaje > 0 && (
                        <p className="text-[11px] text-on-surface-variant line-through">${ce.curso.precio.toLocaleString('es-CO')}</p>
                      )}
                      <p className="text-sm font-bold text-primary">${precioFinal.toLocaleString('es-CO')}</p>
                      {ce.descuentoPorcentaje > 0 && (
                        <span className="inline-block text-[10px] font-semibold bg-secondary/15 text-secondary px-1.5 py-0.5 rounded">{ce.descuentoPorcentaje}% dto.</span>
                      )}
                    </div>
                  </div>
                )
              })()}

              <div className="grid grid-cols-2 gap-3">
                {modalDetalle.documento && (
                  <InfoField label={modalDetalle.tipoDocumento ?? 'Documento'} value={modalDetalle.documento} />
                )}
                <div className="col-span-2"><InfoField label="Email" value={modalDetalle.email} /></div>
                <InfoField label="Teléfono" value={modalDetalle.telefono} />
                <InfoField label="Colegio" value={modalDetalle.colegio?.nombre ?? '—'} />
                <InfoField label="Asesor" value={modalDetalle.asesor?.nombre ?? '—'} />
                <InfoField label="Fecha nacimiento" value={formatDate(modalDetalle.fechaNacimiento)} />
                {modalDetalle.departamento && <InfoField label="Departamento" value={modalDetalle.departamento} />}
                {modalDetalle.ciudad && <InfoField label="Ciudad" value={modalDetalle.ciudad} />}
              </div>
              {modalDetalle.acudiente && (
                <>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider pt-2">Acudiente</p>
                  <div className="grid grid-cols-2 gap-3">
                    <InfoField label="Nombre" value={modalDetalle.acudiente.nombre} />
                    <InfoField label="Relación" value={modalDetalle.acudiente.relacion} />
                    <InfoField label="Teléfono" value={modalDetalle.acudiente.telefono} />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-low rounded-lg p-3">
      <p className="text-[11px] text-on-surface-variant mb-0.5">{label}</p>
      <p className="text-sm text-on-surface font-medium truncate">{value}</p>
    </div>
  )
}
