'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { apiFetch } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Search, Plus, FileText, Trash2, Loader2 } from 'lucide-react'

interface Guion {
  id: string
  titulo: string
  contenido: string
  updatedAt: string
  autor: { nombre: string }
}

export default function GuionesPage() {
  const queryClient = useQueryClient()
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState<Guion | 'nuevo' | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['marketing-guiones', busqueda],
    queryFn: () => apiFetch<{ data: Guion[] }>(`/marketing/guiones${busqueda ? `?q=${encodeURIComponent(busqueda)}` : ''}`),
    staleTime: 30_000,
  })
  const guiones = data?.data ?? []

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['marketing-guiones'] })

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader title="Guiones" subtitle="Biblioteca de guiones del equipo" />
        <div className="flex items-center gap-2">
          <Button onClick={() => setSeleccionado('nuevo')}>
            <Plus className="w-4 h-4" /> Nuevo guion
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
        <input
          type="search"
          placeholder="Buscar por título..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          autoComplete="off"
          className="w-full bg-surface-high border border-outline-variant rounded-lg pl-9 pr-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-on-surface-variant">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : guiones.length === 0 ? (
        <p className="text-[13px] text-on-surface-variant text-center py-16">
          {busqueda ? 'Sin resultados.' : 'Todavía no hay guiones guardados.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {guiones.map(g => (
            <button
              key={g.id}
              onClick={() => setSeleccionado(g)}
              className="card p-4 text-left hover:border-primary/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <p className="text-[13.5px] font-semibold text-on-surface truncate">{g.titulo}</p>
              </div>
              <p className="text-[12px] text-on-surface-variant line-clamp-3 whitespace-pre-line">{g.contenido}</p>
              <p className="text-[10.5px] text-on-surface-variant/70 mt-3">
                {g.autor.nombre} · {format(new Date(g.updatedAt), "d 'de' MMMM", { locale: es })}
              </p>
            </button>
          ))}
        </div>
      )}

      {seleccionado && (
        <GuionModal
          guion={seleccionado === 'nuevo' ? undefined : seleccionado}
          onClose={() => setSeleccionado(null)}
          onSaved={() => { invalidar(); setSeleccionado(null) }}
        />
      )}
    </div>
  )
}

function GuionModal({ guion, onClose, onSaved }: { guion?: Guion; onClose: () => void; onSaved: () => void }) {
  const esEdicion = !!guion
  const [titulo, setTitulo] = useState(guion?.titulo ?? '')
  const [contenido, setContenido] = useState(guion?.contenido ?? '')
  const [error, setError] = useState('')

  const guardar = useMutation({
    mutationFn: () => esEdicion
      ? apiFetch(`/marketing/guiones/${guion!.id}`, { method: 'PATCH', body: JSON.stringify({ titulo, contenido }) })
      : apiFetch('/marketing/guiones', { method: 'POST', body: JSON.stringify({ titulo, contenido }) }),
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message || 'Error al guardar'),
  })

  const eliminar = useMutation({
    mutationFn: () => apiFetch(`/marketing/guiones/${guion!.id}`, { method: 'DELETE' }),
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message || 'Error al eliminar'),
  })

  return (
    <Modal abierto onClose={onClose} titulo={esEdicion ? 'Editar guion' : 'Nuevo guion'} subtitulo={guion?.autor.nombre}>
      <div className="space-y-3 pb-2">
        <div>
          <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Título</label>
          <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej. Guion reel comprensión lectora" className="input-base" />
        </div>
        <div>
          <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Contenido</label>
          <textarea
            value={contenido}
            onChange={e => setContenido(e.target.value)}
            rows={10}
            placeholder="Escribe el guion completo..."
            className="input-base resize-y font-mono text-[12.5px]"
          />
        </div>

        {error && <p className="text-xs text-[var(--error)]">{error}</p>}

        <div className="flex items-center justify-between gap-3 pt-2">
          {esEdicion ? (
            <button
              onClick={() => confirm('¿Eliminar este guion?') && eliminar.mutate()}
              disabled={eliminar.isPending}
              className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--error)] hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost">Cancelar</button>
            <Button onClick={() => guardar.mutate()} disabled={!titulo.trim() || !contenido.trim() || guardar.isPending}>
              {guardar.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {esEdicion ? 'Guardar cambios' : 'Crear'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
