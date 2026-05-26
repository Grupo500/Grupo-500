'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate, cn } from '@/lib/utils'
import {
  FileBarChart2, Loader2, TrendingUp, TrendingDown, Minus,
  ExternalLink, X, Upload, CheckCircle2, Sparkles, AlertCircle, Search,
  ChevronLeft, ChevronRight, Trash2,
} from 'lucide-react'

interface SimulacroEstudiante {
  id: string
  puntajeTotal: number
  porcentajeAciertos: number
  rendimiento: 'BAJO' | 'MEDIO' | 'ALTO'
  estado?: 'BAJO' | 'MEDIO' | 'ALTO'
  areasDebiles: string[]
  requiereIntensivo: boolean
  fechaAnalisis: string
  estudiante: { nombre: string }
  simulacro: { nombre: string; archivoUrl: string }
}

interface Simulacro {
  id: string
  nombre: string
  archivoUrl: string
  fechaCreacion: string
  estudiantes: SimulacroEstudiante[]
}

const RENDIMIENTO = {
  BAJO: { label: 'Bajo', color: 'text-red-400 bg-red-400/10', icon: TrendingDown },
  MEDIO: { label: 'Medio', color: 'text-yellow-400 bg-yellow-400/10', icon: Minus },
  ALTO: { label: 'Alto', color: 'text-secondary bg-secondary/10', icon: TrendingUp },
}

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

export default function SimulacrosPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [busquedaInput, setBusquedaInput] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => { setBusqueda(busquedaInput); setPage(1) }, 200)
    return () => clearTimeout(t)
  }, [busquedaInput])
  const [modalSubir, setModalSubir] = useState(false)
  const [analizando, setAnalizando]   = useState<string | null>(null)
  const [eliminando, setEliminando]   = useState<string | null>(null)
  const [resultadoAnalisis, setResultadoAnalisis] = useState<{ id: string; guardados: number; sinMatch: number; sinMatchNombres: string[] } | null>(null)
  const [nombre, setNombre] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [archivoUrl, setArchivoUrl] = useState('')
  const [error, setError] = useState('')

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getClientToken()
    return createClientFetcher(token ?? '')<T>(path, opts)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['simulacros', page, busqueda],
    queryFn: () => fetcher<any>(`/simulacros?page=${page}&limit=20${busqueda ? `&nombre=${encodeURIComponent(busqueda)}` : ''}`),
  })

  // Subir archivo (PDF o Excel) a Cloudinary vía API
  const handleArchivoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const esExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    const esPdf   = file.type === 'application/pdf'
    if (!esExcel && !esPdf) {
      setError('Solo se permiten archivos PDF o Excel (.xlsx)')
      return
    }
    setArchivo(file)
    setError('')
    setUploadProgress('uploading')

    try {
      const token = await getClientToken()
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/pdf`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Error al subir archivo')
      setArchivoUrl(json.data.url)
      setUploadProgress('done')
    } catch (err: any) {
      setError(err.message ?? 'Error al subir el archivo')
      setUploadProgress('idle')
      setArchivo(null)
    }
  }

  const analizarSimulacro = async (id: string) => {
    setAnalizando(id)
    setResultadoAnalisis(null)
    try {
      const res = await fetcher<any>(`/simulacros/${id}/analizar`, { method: 'POST' })
      setResultadoAnalisis({ id, ...res.data })
      queryClient.invalidateQueries({ queryKey: ['simulacros'] })
    } catch (err: any) {
      alert(err?.message ?? 'Error al analizar el simulacro')
    } finally {
      setAnalizando(null)
    }
  }

  const eliminarSimulacro = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar el simulacro "${nombre}"? Esta acción no se puede deshacer.`)) return
    setEliminando(id)
    try {
      await fetcher(`/simulacros/${id}`, { method: 'DELETE' })
      queryClient.invalidateQueries({ queryKey: ['simulacros'] })
    } catch (err: any) {
      alert(err?.message ?? 'Error al eliminar el simulacro')
    } finally {
      setEliminando(null)
    }
  }

  const registrarMutation = useMutation({
    mutationFn: () => fetcher('/simulacros', {
      method: 'POST',
      body: JSON.stringify({ nombre, archivoUrl }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulacros'] })
      handleClose()
    },
    onError: (err: any) => {
      setError(err?.message ?? 'Error al registrar simulacro')
    },
  })

  const handleClose = () => {
    setModalSubir(false)
    setNombre('')
    setArchivo(null)
    setArchivoUrl('')
    setUploadProgress('idle')
    setError('')
  }

  const handleRegistrar = () => {
    if (!nombre.trim()) { setError('El nombre es requerido'); return }
    setError('')
    registrarMutation.mutate()
  }

  const simulacros: Simulacro[] = data?.data ?? []
  const total = data?.pagination?.total ?? 0
  const totalPages = data?.pagination?.totalPages ?? 1

  const inputCls = 'w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20'
  const labelCls = 'block text-xs font-medium text-on-surface-variant mb-1'

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Simulacros"
        subtitle="Análisis de rendimiento por simulacro"
        actions={
          <button
            onClick={() => setModalSubir(true)}
            className="flex items-center gap-2 px-2.5 py-2.5 sm:px-4 sm:py-2 bg-primary text-on-primary rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Upload className="w-4 h-4" /><span className="hidden sm:inline">Subir simulacro</span>
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

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : simulacros.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant bg-surface-lowest border border-outline-variant rounded-xl">
          <FileBarChart2 className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No hay simulacros registrados</p>
        </div>
      ) : (
        <div className="space-y-4">
          {simulacros.map(s => (
            <div key={s.id} className="bg-surface-lowest border border-outline-variant rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/40">
                <div>
                  <h3 className="text-sm font-semibold text-on-surface">{s.nombre}</h3>
                  <p className="text-xs text-on-surface-variant">{formatDate(s.fechaCreacion)} · {s.estudiantes?.length ?? 0} resultados</p>
                </div>
                <div className="flex items-center gap-2">
                  {s.archivoUrl && (
                    <>
                      <a href={s.archivoUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-high border border-outline-variant text-xs text-on-surface-variant hover:text-primary hover:border-primary/30 transition-colors">
                        <ExternalLink className="w-3 h-3" />Ver PDF
                      </a>
                      <button
                        onClick={() => analizarSimulacro(s.id)}
                        disabled={analizando === s.id || eliminando === s.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                      >
                        {analizando === s.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Sparkles className="w-3 h-3" />
                        }
                        {analizando === s.id ? 'Analizando...' : 'Analizar PDF'}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => eliminarSimulacro(s.id, s.nombre)}
                    disabled={eliminando === s.id || analizando === s.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors dark:bg-red-950/20 dark:border-red-800 dark:text-red-400"
                  >
                    {eliminando === s.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Trash2 className="w-3 h-3" />
                    }
                    {eliminando === s.id ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
              </div>

              {/* Resultado del análisis */}
              {resultadoAnalisis?.id === s.id && (
                <div className="px-5 py-3 bg-secondary/5 border-b border-secondary/10 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-on-surface-variant">
                    <span className="text-secondary font-semibold">Análisis completado. </span>
                    {resultadoAnalisis.guardados} resultados guardados.
                  </div>
                </div>
              )}

              {s.estudiantes?.length > 0 ? (<>
                {/* Mobile: tarjetas */}
                <div className="md:hidden divide-y divide-outline-variant/30">
                  {s.estudiantes.map(r => {
                    const { label, color, icon: Icon } = RENDIMIENTO[r.rendimiento ?? r.estado ?? 'MEDIO']
                    return (
                      <div key={r.id} className="px-4 py-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-on-surface truncate">{r.estudiante.nombre}</p>
                          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold flex-shrink-0', color)}>
                            <Icon className="w-3 h-3" />{label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm font-bold text-on-surface">{r.puntajeTotal} pts</span>
                          <span className="text-xs text-on-surface-variant">{r.porcentajeAciertos.toFixed(0)}% aciertos</span>
                          {r.requiereIntensivo && (
                            <span className="px-2 py-0.5 rounded bg-tertiary/10 text-tertiary text-[10px] font-semibold">Intensivo</span>
                          )}
                        </div>
                        {r.areasDebiles.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {r.areasDebiles.slice(0, 3).map(area => (
                              <span key={area} className="px-1.5 py-0.5 rounded bg-red-400/10 text-red-400 text-[10px] font-medium">{area}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Desktop: tabla */}
                <table className="hidden md:table w-full">
                  <thead>
                    <tr className="bg-surface-low">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Estudiante</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Puntaje</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Rendimiento</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">Áreas débiles</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden xl:table-cell">Intensivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {s.estudiantes.map(r => {
                      const { label, color, icon: Icon } = RENDIMIENTO[r.rendimiento ?? r.estado ?? 'MEDIO']
                      return (
                        <tr key={r.id} className="hover:bg-surface-low/30 transition-colors">
                          <td className="px-4 py-3 text-sm text-on-surface">{r.estudiante.nombre}</td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-semibold text-on-surface">{r.puntajeTotal}</span>
                            <span className="text-xs text-on-surface-variant ml-1">({r.porcentajeAciertos.toFixed(0)}%)</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium', color)}>
                              <Icon className="w-3 h-3" />{label}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {r.areasDebiles.slice(0, 3).map(area => (
                                <span key={area} className="px-1.5 py-0.5 rounded bg-red-400/10 text-red-400 text-[10px] font-medium">{area}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden xl:table-cell">
                            {r.requiereIntensivo
                              ? <span className="px-2 py-0.5 rounded bg-tertiary/10 text-tertiary text-[11px] font-medium">Requerido</span>
                              : <span className="text-xs text-on-surface-variant">—</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </>) : (
                <p className="px-5 py-4 text-sm text-on-surface-variant italic">Sin resultados cargados</p>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-surface-lowest border border-outline-variant rounded-xl">
          <p className="text-xs text-on-surface-variant">Página {page} de {totalPages} · {total} resultados</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-high disabled:opacity-30 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-high disabled:opacity-30 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal subir simulacro */}
      <Modal open={modalSubir} onClose={handleClose}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-on-surface">Subir simulacro</h2>
            <button onClick={handleClose} className="p-1.5 text-on-surface-variant hover:text-on-surface">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Nombre */}
            <div>
              <label className={labelCls}>Nombre del simulacro *</label>
              <input
                className={inputCls}
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Simulacro ICFES — Marzo 2025"
              />
            </div>

            {/* Zona de upload */}
            <div>
              <label className={labelCls}>Archivo (PDF o Excel)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.xlsx,.xls"
                className="hidden"
                onChange={handleArchivoChange}
              />

              {uploadProgress === 'idle' && !archivo && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed border-outline-variant bg-surface-high hover:border-primary/40 hover:bg-primary/5 transition-colors text-on-surface-variant hover:text-primary group"
                >
                  <Upload className="w-7 h-7 transition-transform group-hover:scale-110" />
                  <span className="text-sm font-medium">Seleccionar PDF o Excel</span>
                  <span className="text-xs opacity-60">PDF o .xlsx — Máximo 20 MB</span>
                </button>
              )}

              {uploadProgress === 'uploading' && (
                <div className="flex items-center gap-3 px-4 py-4 rounded-xl border border-outline-variant bg-surface-high">
                  <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">{archivo?.name}</p>
                    <p className="text-xs text-on-surface-variant">Subiendo a Cloudinary...</p>
                  </div>
                </div>
              )}

              {uploadProgress === 'done' && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-secondary/30 bg-secondary/5">
                  <CheckCircle2 className="w-5 h-5 text-secondary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">{archivo?.name}</p>
                    <p className="text-xs text-secondary">Archivo subido correctamente</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setArchivo(null)
                      setArchivoUrl('')
                      setUploadProgress('idle')
                    }}
                    className="p-1 text-on-surface-variant hover:text-on-surface flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button onClick={handleClose} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface">Cancelar</button>
            <button
              onClick={handleRegistrar}
              disabled={registrarMutation.isPending || !nombre.trim() || uploadProgress === 'uploading'}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {registrarMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Registrar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

