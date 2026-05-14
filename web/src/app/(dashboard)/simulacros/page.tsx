'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate, cn } from '@/lib/utils'
import { FileBarChart2, Loader2, TrendingUp, TrendingDown, Minus, ExternalLink, Plus, X } from 'lucide-react'

interface SimulacroEstudiante {
  id: string
  puntajeTotal: number
  porcentajeAciertos: number
  estado: 'BAJO' | 'MEDIO' | 'ALTO'
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
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [modalSubir, setModalSubir] = useState(false)
  const [form, setForm] = useState({ nombre: '', archivoUrl: '' })
  const [error, setError] = useState('')

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getToken()
    return createClientFetcher(token)<T>(path, opts)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['simulacros'],
    queryFn: () => fetcher<any>('/simulacros'),
  })

  const subirMutation = useMutation({
    mutationFn: () => fetcher('/simulacros', {
      method: 'POST',
      body: JSON.stringify({ nombre: form.nombre, archivoUrl: form.archivoUrl }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulacros'] })
      setModalSubir(false)
      setForm({ nombre: '', archivoUrl: '' })
      setError('')
    },
    onError: (err: any) => {
      setError(err?.message ?? 'Error al registrar simulacro')
    },
  })

  const handleSubir = () => {
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    setError('')
    subirMutation.mutate()
  }

  const simulacros: Simulacro[] = data?.data ?? []

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
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />Subir simulacro
          </button>
        }
      />

      <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 text-sm text-on-surface-variant">
        <p className="text-primary font-medium mb-1">Análisis automático próximamente</p>
        <p>El análisis inteligente de PDFs para extracción de puntajes y áreas débiles estará disponible en la siguiente fase.</p>
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
                  <p className="text-xs text-on-surface-variant">{formatDate(s.fechaCreacion)} · {s.estudiantes.length} resultados</p>
                </div>
                {s.archivoUrl && (
                  <a href={s.archivoUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-high border border-outline-variant text-xs text-on-surface-variant hover:text-primary hover:border-primary/30 transition-colors">
                    <ExternalLink className="w-3 h-3" />Ver PDF
                  </a>
                )}
              </div>

              {s.estudiantes.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="bg-surface-low">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Estudiante</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden md:table-cell">Puntaje</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden md:table-cell">Rendimiento</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">Áreas débiles</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden xl:table-cell">Intensivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {s.estudiantes.map(r => {
                      const { label, color, icon: Icon } = RENDIMIENTO[r.estado]
                      return (
                        <tr key={r.id} className="hover:bg-surface-low/30 transition-colors">
                          <td className="px-4 py-3 text-sm text-on-surface">{r.estudiante.nombre}</td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-sm font-semibold text-on-surface">{r.puntajeTotal}</span>
                            <span className="text-xs text-on-surface-variant ml-1">({r.porcentajeAciertos.toFixed(0)}%)</span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
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
              ) : (
                <p className="px-5 py-4 text-sm text-on-surface-variant italic">Sin resultados cargados</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={modalSubir} onClose={() => { setModalSubir(false); setError('') }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-on-surface">Subir simulacro</h2>
            <button onClick={() => { setModalSubir(false); setError('') }} className="p-1.5 text-on-surface-variant hover:text-on-surface">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Nombre del simulacro *</label>
              <input
                className={inputCls}
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Simulacro ICFES — Marzo 2025"
              />
            </div>
            <div>
              <label className={labelCls}>URL del archivo (PDF)</label>
              <input
                className={inputCls}
                value={form.archivoUrl}
                onChange={e => setForm(f => ({ ...f, archivoUrl: e.target.value }))}
                placeholder="https://..."
              />
              <p className="text-[11px] text-on-surface-variant mt-1">Opcional. Puedes subir el PDF a Cloudinary y pegar el enlace aquí.</p>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => { setModalSubir(false); setError('') }} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface">Cancelar</button>
            <button
              onClick={handleSubir}
              disabled={subirMutation.isPending || !form.nombre.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {subirMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Registrar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
