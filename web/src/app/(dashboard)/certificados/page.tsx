'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate, cn } from '@/lib/utils'
import { Award, Plus, X, Loader2, Download, CheckCircle, Clock } from 'lucide-react'

interface Certificado {
  id: string
  tipo: 'CURSANDO' | 'COMPLETADO'
  numeroSerie: string
  fechaEmision: string
  archivoUrl: string
  estudiante: { nombre: string; email: string }
}

const TIPOS = {
  CURSANDO: { label: 'Cursando', color: 'text-yellow-400 bg-yellow-400/10', icon: Clock },
  COMPLETADO: { label: 'Completado', color: 'text-secondary bg-secondary/10', icon: CheckCircle },
}

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-lowest border border-outline-variant rounded-xl shadow-float w-full max-w-sm">
        {children}
      </div>
    </div>
  )
}

export default function CertificadosPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [modalGenerar, setModalGenerar] = useState(false)
  const [form, setForm] = useState({ estudianteId: '', tipo: 'CURSANDO' })

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getToken()
    return createClientFetcher(token)<T>(path, opts)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['certificados'],
    queryFn: () => fetcher<any>('/certificados?limit=50'),
  })

  const { data: estudiantesData } = useQuery({
    queryKey: ['estudiantes-select'],
    queryFn: () => fetcher<any>('/estudiantes?limit=100'),
  })

  const generarMutation = useMutation({
    mutationFn: () => fetcher('/certificados', {
      method: 'POST',
      body: JSON.stringify(form),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificados'] })
      setModalGenerar(false)
      setForm({ estudianteId: '', tipo: 'CURSANDO' })
    },
  })

  const certificados: Certificado[] = data?.data?.items ?? []
  const total = data?.data?.total ?? 0
  const estudiantes = estudiantesData?.data?.items ?? []

  const inputCls = 'w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20'
  const labelCls = 'block text-xs font-medium text-on-surface-variant mb-1'

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Certificados"
        subtitle={`${total} certificados emitidos`}
        action={
          <button onClick={() => setModalGenerar(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />Generar certificado
          </button>
        }
      />

      <div className="bg-surface-lowest border border-outline-variant rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
        ) : certificados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
            <Award className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No hay certificados generados</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-low">
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Estudiante</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden md:table-cell">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">Serie</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">Emitido</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {certificados.map(c => {
                const { label, color, icon: Icon } = TIPOS[c.tipo]
                return (
                  <tr key={c.id} className="hover:bg-surface-low/40 transition-colors group">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-on-surface">{c.estudiante.nombre}</p>
                      <p className="text-xs text-on-surface-variant">{c.estudiante.email}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium', color)}>
                        <Icon className="w-3 h-3" />{label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs font-mono text-on-surface-variant">{c.numeroSerie}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-on-surface-variant">{formatDate(c.fechaEmision)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.archivoUrl && (
                        <a
                          href={c.archivoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Download className="w-3 h-3" />Descargar
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalGenerar} onClose={() => setModalGenerar(false)}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-on-surface">Generar certificado</h2>
            <button onClick={() => setModalGenerar(false)} className="p-1.5 text-on-surface-variant hover:text-on-surface"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Estudiante *</label>
              <select className={inputCls} value={form.estudianteId} onChange={e => setForm(f => ({ ...f, estudianteId: e.target.value }))}>
                <option value="">Seleccionar estudiante...</option>
                {estudiantes.map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
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
            <button onClick={() => setModalGenerar(false)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface">Cancelar</button>
            <button
              onClick={() => generarMutation.mutate()}
              disabled={generarMutation.isPending || !form.estudianteId}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {generarMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Generar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
