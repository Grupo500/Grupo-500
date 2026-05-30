'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCOP, formatDate } from '@/lib/utils'
import {
  Globe, Eye, EyeOff, Users, Pencil, Check, X,
  Loader2, ExternalLink, Plus, Trash2, Tag,
} from 'lucide-react'

interface Curso {
  id: string
  nombre: string
  descripcion?: string
  precio: number
  duracionHoras: number
  activo: boolean
  calendario: string
  fechaInicio?: string | null
  fechaFin?: string | null
  visibleEnLanding: boolean
  cuposDisponibles?: number | null
  _count?: { estudiantes: number }
}

interface PreciosCurso {
  precioGeneral: number
  preciosPromo: number[]
}

const inputCls = 'w-full bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20'
const labelCls = 'block text-xs font-medium text-on-surface-variant mb-1'

function formatNum(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('es-CO', { maximumFractionDigits: 0 })
}

// ── Modal de precios ──────────────────────────────────────────────────────────
function ModalPrecios({
  curso, onClose,
}: {
  curso: Curso
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [precioGeneral, setPrecioGeneral] = useState('')
  const [preciosPromoStr, setPreciosPromoStr] = useState('')
  const [cupos, setCupos] = useState(String(curso.cuposDisponibles ?? ''))
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')

  // Cargar precios actuales
  useQuery({
    queryKey: ['precios-curso', curso.id],
    queryFn:  () => apiFetch<{ data: PreciosCurso }>(`/inscripcion/cursos/${curso.id}`),
    onSuccess: (d: any) => {
      const data: PreciosCurso = d.data ?? d
      setPrecioGeneral(String(data.precioGeneral ?? curso.precio))
      setPreciosPromoStr(data.preciosPromo?.join(', ') ?? '')
    },
  } as any)

  async function guardar() {
    setGuardando(true)
    setError('')
    try {
      const precioGen = parseInt(precioGeneral.replace(/\D/g, ''), 10)
      if (isNaN(precioGen) || precioGen <= 0) throw new Error('El precio general es requerido')

      await apiFetch('/config/precios', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cursoId:      curso.id,
          precioGeneral: precioGen,
          preciosPromo: preciosPromoStr
            ? preciosPromoStr.split(',').map(p => parseInt(p.trim().replace(/\D/g, ''), 10)).filter(n => !isNaN(n) && n > 0)
            : [],
          cuposDisponibles: cupos ? parseInt(cupos, 10) : null,
        }),
      })
      queryClient.invalidateQueries({ queryKey: ['cursos-admin'] })
      onClose()
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-surface-lowest border border-outline-variant rounded-xl shadow-float w-full max-w-md">
          <div className="flex items-center justify-between p-5 border-b border-outline-variant">
            <h3 className="font-semibold text-on-surface">Precios — {curso.nombre}</h3>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-high cursor-pointer">
              <X className="w-5 h-5 text-on-surface-variant" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className={labelCls}>Precio general (COP)</label>
              <input
                className={inputCls}
                inputMode="numeric"
                placeholder="600.000"
                value={formatNum(precioGeneral)}
                onChange={e => setPrecioGeneral(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div>
              <label className={labelCls}>Precios promoción (separados por coma)</label>
              <input
                className={inputCls}
                placeholder="500000, 540000"
                value={preciosPromoStr}
                onChange={e => setPreciosPromoStr(e.target.value)}
              />
              <p className="text-xs text-on-surface-variant mt-1">
                Ej: 500000, 540000 — se mostrarán como opciones en el formulario
              </p>
            </div>
            <div>
              <label className={labelCls}>Cupos disponibles (dejar vacío = ilimitado)</label>
              <input
                className={inputCls}
                inputMode="numeric"
                placeholder="Sin límite"
                value={cupos}
                onChange={e => setCupos(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
          </div>
          <div className="flex gap-3 p-5 border-t border-outline-variant">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-outline-variant text-on-surface-variant text-sm font-medium hover:bg-surface-high transition-colors cursor-pointer">
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={guardando}
              className="flex-1 py-2.5 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            >
              {guardando ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Guardar precios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function CalendariosPage() {
  const queryClient                   = useQueryClient()
  const [modalPrecios, setModalPrecios] = useState<Curso | null>(null)
  const [togglingId, setTogglingId]   = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['cursos-admin'],
    queryFn:  () => apiFetch<{ data: Curso[] }>('/cursos'),
  })

  const cursos: Curso[] = (data as any)?.data ?? []

  // Mutation para toggle visibleEnLanding
  const toggleVisible = useMutation({
    mutationFn: ({ id, visible }: { id: string; visible: boolean }) =>
      apiFetch(`/cursos/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ visibleEnLanding: visible }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cursos-admin'] }),
    onSettled: () => setTogglingId(null),
  })

  async function handleToggle(curso: Curso) {
    setTogglingId(curso.id)
    toggleVisible.mutate({ id: curso.id, visible: !curso.visibleEnLanding })
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader
        title="Calendarios"
        subtitle="Gestiona la visibilidad y precios de cada calendario en la plataforma pública"
        actions={
          <a
            href="/inscripcion"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-outline-variant text-on-surface-variant text-xs font-medium hover:bg-surface-high transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Ver página pública
          </a>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
          </div>
        )}

        {!isLoading && cursos.length === 0 && (
          <div className="text-center py-16 text-on-surface-variant text-sm">
            No hay cursos creados. Ve a <strong>Cursos</strong> para crear uno.
          </div>
        )}

        {cursos.map((curso) => (
          <div
            key={curso.id}
            className={`bg-surface-lowest border rounded-xl p-5 transition-all ${
              curso.visibleEnLanding
                ? 'border-primary/40 shadow-md'
                : 'border-outline-variant'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    Cal. {curso.calendario}
                  </span>
                  {curso.activo ? (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Activo</span>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Inactivo</span>
                  )}
                  {curso.visibleEnLanding && (
                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Globe className="w-2.5 h-2.5" /> Visible en landing
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-on-surface text-sm mb-1 truncate">{curso.nombre}</h3>
                <div className="flex items-center gap-3 text-xs text-on-surface-variant flex-wrap">
                  <span className="font-semibold text-on-surface">{formatCOP(curso.precio)}</span>
                  {curso.fechaInicio && <span>{formatDate(curso.fechaInicio)}</span>}
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {curso._count?.estudiantes ?? 0} inscritos
                  </span>
                  {curso.cuposDisponibles != null && (
                    <span className="text-amber-600 font-medium">
                      {curso.cuposDisponibles} cupos configurados
                    </span>
                  )}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setModalPrecios(curso)}
                  title="Editar precios"
                  className="p-2 rounded-lg border border-outline-variant hover:bg-surface-high transition-colors cursor-pointer"
                >
                  <Tag className="w-4 h-4 text-on-surface-variant" />
                </button>
                <button
                  onClick={() => handleToggle(curso)}
                  disabled={togglingId === curso.id}
                  title={curso.visibleEnLanding ? 'Ocultar de la landing' : 'Mostrar en la landing'}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 ${
                    curso.visibleEnLanding
                      ? 'bg-primary text-on-primary hover:opacity-90'
                      : 'border border-outline-variant text-on-surface-variant hover:bg-surface-high'
                  }`}
                >
                  {togglingId === curso.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : curso.visibleEnLanding ? (
                    <><Eye className="w-3.5 h-3.5" /> Visible</>
                  ) : (
                    <><EyeOff className="w-3.5 h-3.5" /> Oculto</>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de precios */}
      {modalPrecios && (
        <ModalPrecios
          curso={modalPrecios}
          onClose={() => setModalPrecios(null)}
        />
      )}
    </div>
  )
}
