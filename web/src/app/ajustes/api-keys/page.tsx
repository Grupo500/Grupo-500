'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate, cn } from '@/lib/utils'
import { KeyRound, Plus, Trash2, X, Copy, Check, Loader2, ShieldAlert } from 'lucide-react'

interface ApiKey {
  id: string
  nombre: string
  prefijo: string
  scopes: string[]
  activa: boolean
  ultimoUso: string | null
  createdAt: string
  revocadaAt: string | null
  creadaPor: { nombre: string | null; email: string }
}

export default function AjustesApiKeysPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const isAdmin = session?.user?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [nombreNueva, setNombreNueva] = useState('')
  const [keyCreada, setKeyCreada] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (status === 'authenticated' && !isAdmin) router.replace('/ajustes')
  }, [status, isAdmin, router])

  const fetcher = async <T,>(url: string, opts?: RequestInit): Promise<T> => {
    const token = await getClientToken()
    return createClientFetcher(token ?? '')(url, opts) as Promise<T>
  }

  const { data, isLoading } = useQuery<{ data: ApiKey[] }>({
    queryKey: ['api-keys'],
    queryFn: () => fetcher<{ data: ApiKey[] }>('/apikeys'),
    enabled: isAdmin,
  })

  const crear = useMutation({
    mutationFn: () =>
      fetcher<{ data: ApiKey & { key: string } }>('/apikeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombreNueva.trim(), scopes: [] }),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      setKeyCreada(res.data.key)
      setNombreNueva('')
    },
  })

  const revocar = useMutation({
    mutationFn: (id: string) => fetcher(`/apikeys/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  })

  const keys = data?.data ?? []

  function cerrarModal() {
    setShowModal(false)
    setKeyCreada(null)
    setCopiado(false)
  }

  function copiarKey() {
    if (!keyCreada) return
    navigator.clipboard.writeText(keyCreada)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  if (!isAdmin) return null

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="API Keys"
        subtitle="Accesos de solo lectura para integraciones externas (IA, Zapier, etc.)"
        actions={
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-2.5 py-2.5 sm:px-4 sm:py-2 bg-primary text-on-primary rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Crear API key</span>
          </button>
        }
      />

      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/15">
        <KeyRound className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Estas keys dan acceso de <strong className="text-on-surface">solo lectura</strong> a estudiantes, pagos, cursos y reportes vía <code className="text-[11px]">/api/public/v1/*</code>. No pueden crear, editar ni borrar nada. El secreto solo se muestra una vez al crearla.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--outline-variant)]">
          <p className="text-sm font-semibold text-on-surface">Keys emitidas</p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-on-surface-variant">
            <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Cargando...</span>
          </div>
        )}
        {!isLoading && keys.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <KeyRound className="w-8 h-8 text-on-surface-variant opacity-40" />
            <p className="text-sm text-on-surface-variant">No hay API keys creadas todavía</p>
          </div>
        )}

        {!isLoading && keys.length > 0 && (
          <div className="divide-y divide-outline-variant/40">
            {keys.map(k => (
              <div key={k.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-on-surface truncate">{k.nombre}</p>
                    <span className={cn(
                      'px-1.5 py-0.5 rounded-md text-[9px] font-bold',
                      k.activa ? 'bg-[#16a34a]/15 text-[#16a34a]' : 'bg-[var(--error)]/15 text-[var(--error)]'
                    )}>
                      {k.activa ? 'Activa' : 'Revocada'}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5 font-mono">{k.prefijo}••••••••••••</p>
                  <p className="text-[11px] text-on-surface-variant/70 mt-1">
                    Creada {formatDate(k.createdAt)} por {k.creadaPor.nombre ?? k.creadaPor.email}
                    {k.ultimoUso && ` · Último uso ${formatDate(k.ultimoUso)}`}
                  </p>
                </div>
                {k.activa && (
                  <button
                    onClick={() => { if (confirm(`¿Revocar la key "${k.nombre}"? Dejará de funcionar de inmediato.`)) revocar.mutate(k.id) }}
                    disabled={revocar.isPending}
                    className="p-2 rounded-lg text-on-surface-variant hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors disabled:opacity-40 flex-shrink-0"
                    title="Revocar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative card w-full max-w-md p-6 space-y-5 animate-slide-up">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-on-surface">
                    {keyCreada ? 'Key creada' : 'Crear API key'}
                  </h2>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {keyCreada ? 'Cópiala ahora — no se volverá a mostrar' : 'Solo lectura sobre datos de la app'}
                  </p>
                </div>
                <button onClick={cerrarModal} className="p-1.5 rounded-md text-on-surface-variant hover:bg-[var(--surface-high)]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!keyCreada ? (
                <>
                  <div>
                    <label className="text-xs font-medium text-on-surface-variant block mb-1.5">Nombre</label>
                    <input
                      type="text"
                      value={nombreNueva}
                      onChange={e => setNombreNueva(e.target.value)}
                      placeholder="Ej: GPT de ventas, Zapier..."
                      className="input-base"
                    />
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button onClick={cerrarModal} className="btn-ghost">Cancelar</button>
                    <button
                      onClick={() => crear.mutate()}
                      disabled={!nombreNueva.trim() || crear.isPending}
                      className="btn-primary"
                    >
                      {crear.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Crear
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[var(--error)]/8 border border-[var(--error)]/20">
                    <ShieldAlert className="w-4 h-4 text-[var(--error)] mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-on-surface leading-relaxed">
                      Guárdala en un lugar seguro. Por seguridad, no podrás volver a verla completa.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-surface-high border border-outline-variant rounded-lg px-3 py-2.5">
                    <code className="text-xs font-mono text-on-surface flex-1 truncate">{keyCreada}</code>
                    <button onClick={copiarKey} className="p-1.5 rounded-md text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors flex-shrink-0">
                      {copiado ? <Check className="w-4 h-4 text-[#16a34a]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={cerrarModal} className="btn-primary">Listo</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
