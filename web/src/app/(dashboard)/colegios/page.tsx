'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { School, Plus, X, Loader2, MapPin, Users } from 'lucide-react'

interface Colegio {
  id: string
  nombre: string
  ciudad: string
  _count?: { estudiantes: number }
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

export default function ColegiosPage() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [modalCrear, setModalCrear] = useState(false)
  const [form, setForm] = useState({ nombre: '', ciudad: '' })

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getToken()
    return createClientFetcher(token)<T>(path, opts)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['colegios'],
    queryFn: () => fetcher<any>('/colegios'),
  })

  const crearMutation = useMutation({
    mutationFn: () => fetcher('/colegios', {
      method: 'POST',
      body: JSON.stringify(form),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colegios'] })
      setModalCrear(false)
      setForm({ nombre: '', ciudad: '' })
    },
  })

  const colegios: Colegio[] = data?.data ?? []
  const inputCls = 'w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20'
  const labelCls = 'block text-xs font-medium text-on-surface-variant mb-1'

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Colegios"
        subtitle={`${colegios.length} colegios registrados`}
        actions={
          <button onClick={() => setModalCrear(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />Nuevo colegio
          </button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : colegios.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant bg-surface-lowest border border-outline-variant rounded-xl">
          <School className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No hay colegios registrados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {colegios.map(c => (
            <div key={c.id} className="bg-surface-lowest border border-outline-variant rounded-xl p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <School className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">{c.nombre}</p>
                  <p className="flex items-center gap-1 text-xs text-on-surface-variant">
                    <MapPin className="w-3 h-3" />{c.ciudad}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                <Users className="w-3.5 h-3.5" />
                <span>{c._count?.estudiantes ?? 0} estudiantes</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalCrear} onClose={() => setModalCrear(false)}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-on-surface">Nuevo colegio</h2>
            <button onClick={() => setModalCrear(false)} className="p-1.5 text-on-surface-variant hover:text-on-surface"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Nombre del colegio *</label>
              <input className={inputCls} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Colegio La Salle" />
            </div>
            <div>
              <label className={labelCls}>Ciudad *</label>
              <input className={inputCls} value={form.ciudad} onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))} placeholder="Bogotá" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setModalCrear(false)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface">Cancelar</button>
            <button
              onClick={() => crearMutation.mutate()}
              disabled={crearMutation.isPending || !form.nombre || !form.ciudad}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {crearMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Crear
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
