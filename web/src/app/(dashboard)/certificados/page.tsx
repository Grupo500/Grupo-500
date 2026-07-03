'use client'

import { useRef, useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate, cn } from '@/lib/utils'
import { Award, Plus, X, Loader2, Download, CheckCircle, Clock, Upload, Pen, Mail, MessageCircle, Search, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'

// ── Tipos ──────────────────────────────────────────────────────────────────
interface CursoEstudiante {
  curso: { nombre: string; duracionHoras: number; calendario: string; fechaInicio?: string | null; fechaFin?: string | null }
}
interface Certificado {
  id: string
  tipo: 'CURSANDO' | 'COMPLETADO'
  numeroSerie: string
  fechaEmision: string
  archivoUrl: string
  estudiante: {
    nombre: string; email: string; telefono?: string
    tipoDocumento?: string; documento?: string; ciudad?: string
    colegio?: { nombre: string; ciudad: string } | null
    cursos?: CursoEstudiante[]
  }
}
interface Firmas { firmaSebastian: string | null; firmaAndres: string | null }

const TIPOS = {
  CURSANDO:   { label: 'Cursando',   color: 'text-yellow-500 bg-yellow-400/10', icon: Clock },
  COMPLETADO: { label: 'Completado', color: 'text-secondary bg-secondary/10',   icon: CheckCircle },
}

// ── Modal genérico ──────────────────────────────────────────────────────────
function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-surface-lowest border border-outline-variant rounded-xl shadow-float w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta de firma ────────────────────────────────────────────────────────
function FirmaCard({ nombre, cargo, url, onUpload, uploading }: {
  nombre: string; cargo: string; url: string | null
  onUpload: (file: File) => void; uploading: boolean
}) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-[var(--primary-container)] flex items-center justify-center flex-shrink-0">
          <Pen className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-on-surface">{nombre}</p>
          <p className="text-[11px] text-on-surface-variant">{cargo}</p>
        </div>
      </div>

      {/* Preview de firma */}
      <div className="h-20 rounded-lg border border-outline-variant bg-[var(--surface-high)] flex items-center justify-center overflow-hidden">
        {url
          ? <img src={url} alt={`Firma ${nombre}`} className="max-h-full max-w-full object-contain p-2" />
          : <p className="text-[11px] text-on-surface-variant">Sin firma cargada</p>
        }
      </div>

      {/* Botón subir */}
      <label className={cn(
        'flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-[12px] font-medium cursor-pointer transition-colors',
        uploading
          ? 'border-outline-variant text-on-surface-variant opacity-60 cursor-not-allowed'
          : 'border-primary/30 text-primary hover:bg-primary/5',
      )}>
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        {url ? 'Reemplazar firma' : 'Cargar firma'}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          disabled={uploading}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) onUpload(f)
            e.target.value = ''
          }}
        />
      </label>
    </div>
  )
}

// Horas por nombre de curso (fallback si el curso tiene 0 horas en BD).
// Misma regla que el backend: calendario 310h, intensivo 40h, combos suman,
// año 500 = 660h, premédico 100h.
function horasPorNombreCurso(nombre: string): number {
  const n = (nombre ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (n.includes('premedico') || n.includes('med500')) return 100
  if (n.includes('ano 500')) return 660
  if (n.includes('+') || n.includes('combo')) {
    let total = 0
    for (const p of n.split('+')) { if (p.includes('intensivo')) total += 40; else if (p.includes('calendario')) total += 310 }
    if (total > 0) return total
  }
  if (n.includes('intensivo')) return 40
  if (n.includes('calendario')) return 310
  return 0
}

// ── Generador de PDF ────────────────────────────────────────────────────────
async function generarPDF(
  cert: Certificado,
  index: number,
  totalCerts: number,
  firmas: Firmas,
) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])
  const React = (await import('react')).default
  const { createRoot } = await import('react-dom/client')
  const { CertificadoTemplate } = await import('@/components/certificados/CertificadoTemplate')

  const e = cert.estudiante
  const cursoData = e.cursos?.[0]?.curso

  const tempDiv = document.createElement('div')
  tempDiv.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;'
  document.body.appendChild(tempDiv)

  const root = createRoot(tempDiv)
  await new Promise<void>(resolve => {
    root.render(React.createElement(CertificadoTemplate, {
      data: {
        nombreEstudiante: e.nombre,
        tipoDocumento:    e.tipoDocumento ?? 'CC',
        documento:        e.documento ?? '',
        colegio:          e.colegio?.nombre ?? '',
        ciudadColegio:    e.colegio?.ciudad ?? e.ciudad ?? '',
        curso:            cursoData?.nombre ?? 'Preicfes',
        duracionHoras:    (cursoData?.duracionHoras && cursoData.duracionHoras > 0)
                            ? cursoData.duracionHoras
                            : horasPorNombreCurso(cursoData?.nombre ?? ''),
        fechaInicioCurso: cursoData?.fechaInicio ?? null,
        fechaFinCurso:    cursoData?.fechaFin    ?? null,
        tipo:             cert.tipo,
        fechaEmision:     cert.fechaEmision,
        numeroCertificado: totalCerts - index,
        firmaAndres:      firmas.firmaAndres    ?? undefined,
      },
    }))
    setTimeout(resolve, 400)
  })

  const canvas = await html2canvas(tempDiv.firstElementChild as HTMLElement, {
    scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
  })

  root.unmount()
  document.body.removeChild(tempDiv)

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297)
  pdf.save(`Certificado-${e.nombre.replace(/\s+/g, '-')}.pdf`)
}

// ── Página ──────────────────────────────────────────────────────────────────
export default function CertificadosPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const queryClient = useQueryClient()

  const [busquedaInput, setBusquedaInput] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [page, setPage] = useState(1)
  const [modalGenerar, setModalGenerar] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { setBusqueda(busquedaInput); setPage(1) }, 200)
    return () => clearTimeout(t)
  }, [busquedaInput])
  const [form, setForm] = useState({ estudianteId: '', tipo: 'CURSANDO' })
  const [descargando, setDescargando] = useState<string | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState<'sebastian' | 'andres' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Certificado | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // Búsqueda de estudiante en modal
  const [busqEst, setBusqEst] = useState('')
  const [busqEstDebounced, setBusqEstDebounced] = useState('')
  const [estSeleccionado, setEstSeleccionado] = useState<{ id: string; nombre: string; documento?: string } | null>(null)
  const [busqDropOpen, setBusqDropOpen] = useState(false)
  const busqRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setBusqEstDebounced(busqEst), 250)
    return () => clearTimeout(t)
  }, [busqEst])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (busqRef.current && !busqRef.current.contains(e.target as Node)) setBusqDropOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getClientToken()
    return createClientFetcher(token ?? '')<T>(path, opts)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['certificados', page, busqueda],
    queryFn: () => fetcher<any>(`/certificados?page=${page}&limit=20${busqueda ? `&nombre=${encodeURIComponent(busqueda)}` : ''}`),
  })
  const { data: estudiantesSearchData, isFetching: buscandoEst } = useQuery({
    queryKey: ['estudiantes-cert-search', busqEstDebounced],
    queryFn: () => fetcher<any>(`/estudiantes?limit=8${busqEstDebounced ? `&nombre=${encodeURIComponent(busqEstDebounced)}` : ''}`),
    enabled: busqDropOpen && busqEstDebounced.length >= 1,
  })
  const { data: firmasData, refetch: refetchFirmas } = useQuery({
    queryKey: ['config-firmas'],
    queryFn: () => fetcher<{ data: Firmas }>('/config/firmas'),
  })

  const firmas: Firmas = firmasData?.data ?? { firmaSebastian: null, firmaAndres: null }
  const resultadosBusq: any[] = estudiantesSearchData?.data ?? []

  const seleccionarEstudiante = (est: any) => {
    setEstSeleccionado({ id: est.id, nombre: est.nombre, documento: est.documento })
    setForm(f => ({ ...f, estudianteId: est.id }))
    setBusqEst(est.nombre)
    setBusqDropOpen(false)
  }

  const limpiarEstudiante = () => {
    setEstSeleccionado(null)
    setForm(f => ({ ...f, estudianteId: '' }))
    setBusqEst('')
    setBusqDropOpen(false)
  }

  const generarMutation = useMutation({
    mutationFn: () => fetcher('/certificados', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificados'] })
      setModalGenerar(false)
      setForm({ estudianteId: '', tipo: 'CURSANDO' })
      limpiarEstudiante()
    },
    onError: (err: any) => alert(err?.message ?? 'Error al generar certificado'),
  })

  const handleSubirFirma = async (quien: 'sebastian' | 'andres', file: File) => {
    setSubiendo(quien)
    try {
      const token = await getClientToken()
      const formData = new FormData()
      formData.append('firma', file)
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/config/firmas/${quien}`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData }
      )
      if (!res.ok) throw new Error('Error al subir firma')
      await refetchFirmas()
    } catch (e: any) {
      alert(e?.message ?? 'Error al subir la firma')
    } finally {
      setSubiendo(null)
    }
  }

  const handleEnviar = async (cert: Certificado, canal: 'whatsapp' | 'correo') => {
    if (enviando) return
    setEnviando(`${cert.id}-${canal}`)
    try {
      const token = await getClientToken()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/certificados/${cert.id}/enviar-${canal}`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      )
      const json = await res.json()
      if (!res.ok) {
        if (json.error === 'WHATSAPP_NOT_CONFIGURED' || json.error === 'EMAIL_NOT_CONFIGURED') {
          alert('Esta integración aún no está configurada. Estará disponible próximamente.')
        } else {
          alert(json.message ?? 'Error al enviar')
        }
      } else {
        alert(json.data?.message ?? 'Enviado correctamente')
      }
    } catch {
      alert('Error de conexión')
    } finally {
      setEnviando(null)
    }
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

  // WhatsApp: abre el chat del estudiante con un mensaje listo y descarga el
  // PDF para adjuntarlo (el certificado se genera local, no se hostea).
  const handleWhatsApp = async (cert: Certificado, i: number) => {
    if (descargando || enviando) return
    const tel = (cert.estudiante.telefono ?? '').replace(/\D/g, '')
    const primerNombre = cert.estudiante.nombre.split(' ')[0]
    const tipoTxt = cert.tipo === 'COMPLETADO' ? 'certificado de finalización' : 'certificado de estudio'
    const msg = encodeURIComponent(
      `Hola ${primerNombre}, te saluda GRUPO 500 EDUCACIÓN S.A.S. 🎓\n\nTe compartimos tu ${tipoTxt} del PREICFES. Lo encontrarás adjunto en este chat.\n\nCualquier duda quedamos atentos.`
    )
    const url = tel ? `https://wa.me/57${tel}?text=${msg}` : `https://wa.me/?text=${msg}`
    // Abrir WhatsApp dentro del gesto del usuario (evita bloqueo de popups)
    window.open(url, '_blank')
    // Descargar el PDF para que quede listo para adjuntar en el chat
    setDescargando(cert.id)
    try {
      await generarPDF(cert, i, certificados.length, firmas)
    } catch (e) {
      console.error(e)
    } finally {
      setDescargando(null)
    }
  }

  const handleEliminar = async () => {
    if (!confirmDelete || eliminando) return
    setEliminando(true)
    try {
      await fetcher(`/certificados/${confirmDelete.id}`, { method: 'DELETE' })
      queryClient.invalidateQueries({ queryKey: ['certificados'] })
      setConfirmDelete(null)
    } catch (e: any) {
      alert(e?.message ?? 'Error al eliminar el certificado')
    } finally {
      setEliminando(false)
    }
  }

  const certificados: Certificado[] = data?.data ?? []
  const total = data?.pagination?.total ?? 0
  const totalPages = data?.pagination?.totalPages ?? 1

  const inputCls = 'w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20'
  const labelCls = 'block text-xs font-medium text-on-surface-variant mb-1'

  return (
    <div className="space-y-6 animate-fade-in">

      <PageHeader
        title="Certificados"
        subtitle={`${total} certificado${total !== 1 ? 's' : ''} emitido${total !== 1 ? 's' : ''}`}
        actions={
          <button
            onClick={() => setModalGenerar(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Generar certificado
          </button>
        }
      />

      {/* ── Sección firmas (solo ADMIN) ── */}
      {isAdmin && (
        <div className="space-y-3">
          <p className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">
            Firma del representante legal
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FirmaCard
              nombre="Andrés Felipe Díaz Rivero"
              cargo="CC: 1005480173 · Bucaramanga · Representante Legal"
              url={firmas.firmaAndres}
              uploading={subiendo === 'andres'}
              onUpload={f => handleSubirFirma('andres', f)}
            />
          </div>
        </div>
      )}

      {/* Búsqueda */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Buscar por estudiante..."
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

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : certificados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant bg-surface-lowest border border-outline-variant rounded-xl">
          <Award className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No hay certificados generados</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {certificados.map((c, i) => {
            const { label, color, icon: Icon } = TIPOS[c.tipo]
            const cargando = descargando === c.id
            return (
              <div key={c.id} className="relative bg-surface-lowest border border-outline-variant rounded-xl p-3 flex flex-col gap-2.5 hover:border-primary/30 transition-colors">
                {isAdmin && (
                  <button
                    onClick={() => setConfirmDelete(c)}
                    disabled={!!descargando || !!enviando}
                    className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-on-surface-variant hover:text-red-500 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                    title="Eliminar certificado"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <div className="flex items-center gap-2 pr-6">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <Award className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-xs font-semibold text-on-surface leading-tight line-clamp-2 flex-1">{c.estudiante.nombre}</p>
                </div>
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium self-start', color)}>
                  <Icon className="w-3 h-3" />{label}
                </span>
                <p className="text-[10px] text-on-surface-variant">{formatDate(c.fechaEmision)}</p>
                <div className="pt-1 border-t border-outline-variant/40 flex items-center gap-1">
                  <button
                    onClick={() => handleDescargar(c, i)}
                    disabled={!!descargando || !!enviando}
                    className="flex-1 flex items-center justify-center py-1.5 rounded-lg text-primary bg-primary/10 hover:bg-primary/20 disabled:opacity-50 transition-colors"
                    title="PDF"
                  >
                    {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleWhatsApp(c, i)}
                    disabled={!!descargando || !!enviando}
                    className="flex-1 flex items-center justify-center py-1.5 rounded-lg text-[#25D366] bg-[#25D366]/10 hover:bg-[#25D366]/20 disabled:opacity-50 transition-colors"
                    title="Enviar por WhatsApp"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleEnviar(c, 'correo')}
                    disabled={!!descargando || !!enviando}
                    className="flex-1 flex items-center justify-center py-1.5 rounded-lg text-orange-500 bg-orange-500/10 hover:bg-orange-500/20 disabled:opacity-50 transition-colors"
                    title="Correo"
                  >
                    {enviando === `${c.id}-correo` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-on-surface-variant">Pág. {page} / {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-high disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-high disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* ── Modal Confirmar eliminación ── */}
      <Modal open={!!confirmDelete} onClose={() => { if (!eliminando) setConfirmDelete(null) }}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-on-surface">Eliminar certificado</h2>
              <p className="text-xs text-on-surface-variant">Esta acción no se puede deshacer.</p>
            </div>
          </div>
          <p className="text-sm text-on-surface-variant mb-6">
            ¿Seguro que deseas eliminar el certificado de{' '}
            <strong className="text-on-surface">{confirmDelete?.estudiante.nombre}</strong>?
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setConfirmDelete(null)}
              disabled={eliminando}
              className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleEliminar}
              disabled={eliminando}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {eliminando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Eliminar
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Generar ── */}
      <Modal open={modalGenerar} onClose={() => { setModalGenerar(false); limpiarEstudiante() }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-on-surface">Generar certificado</h2>
            <button onClick={() => setModalGenerar(false)} className="p-1.5 text-on-surface-variant hover:text-on-surface">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div ref={busqRef} className="relative">
              <label className={labelCls}>Estudiante *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o documento…"
                  value={busqEst}
                  onChange={e => { setBusqEst(e.target.value); setBusqDropOpen(true); if (!e.target.value) limpiarEstudiante() }}
                  onFocus={() => setBusqDropOpen(true)}
                  className={cn(inputCls, 'pl-9 pr-8')}
                  autoComplete="off"
                />
                {busqEst && (
                  <button type="button" onClick={limpiarEstudiante} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Chip de seleccionado */}
              {estSeleccionado && (
                <div className="mt-1.5 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-bold text-primary">{estSeleccionado.nombre.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-on-surface truncate">{estSeleccionado.nombre}</p>
                    {estSeleccionado.documento && <p className="text-[10px] text-on-surface-variant">{estSeleccionado.documento}</p>}
                  </div>
                  <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                </div>
              )}

              {/* Dropdown de resultados */}
              {busqDropOpen && busqEstDebounced.length >= 1 && (
                <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-surface-lowest border border-outline-variant rounded-lg shadow-float overflow-hidden">
                  {buscandoEst ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-on-surface-variant">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando…
                    </div>
                  ) : resultadosBusq.length === 0 ? (
                    <div className="px-3 py-2.5 text-xs text-on-surface-variant">Sin resultados</div>
                  ) : (
                    resultadosBusq.map((est: any) => (
                      <button
                        key={est.id}
                        type="button"
                        onClick={() => seleccionarEstudiante(est)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface-high text-left transition-colors"
                      >
                        <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-primary">{est.nombre.charAt(0)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-on-surface truncate">{est.nombre}</p>
                          <p className="text-[10px] text-on-surface-variant">{est.documento ? `${est.tipoDocumento ?? 'CC'}: ${est.documento}` : est.email}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Tipo de certificado *</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {(['CURSANDO', 'COMPLETADO'] as const).map(tipo => (
                  <button
                    key={tipo}
                    onClick={() => setForm(f => ({ ...f, tipo }))}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors',
                      form.tipo === tipo
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-outline-variant bg-surface-high text-on-surface-variant hover:bg-surface-highest'
                    )}
                  >
                    {tipo === 'CURSANDO' ? <Clock className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    {TIPOS[tipo].label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => { setModalGenerar(false); limpiarEstudiante() }} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface">
              Cancelar
            </button>
            <button
              onClick={() => generarMutation.mutate()}
              disabled={generarMutation.isPending || !form.estudianteId}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {generarMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Generar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

