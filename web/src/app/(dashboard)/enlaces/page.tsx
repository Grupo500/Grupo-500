'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { createClientFetcher, getClientToken } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Search, ExternalLink, CheckCircle2, Circle, Users, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MiAfiliacion { id: string; nombre: string; linkAfiliacion: string | null; afiliado: boolean }
interface ResumenAsesor { id: string; nombre: string; afiliados: number; total: number; cursos: boolean[] }
interface Resumen { cursos: { id: string; nombre: string }[]; asesores: ResumenAsesor[] }

export default function EnlacesPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const queryClient = useQueryClient()
  const [busqueda, setBusqueda] = useState('')
  const [verEquipo, setVerEquipo] = useState(false)

  const fetcher = async <T,>(path: string, opts?: RequestInit) => {
    const token = await getClientToken()
    return createClientFetcher(token ?? '')<T>(path, opts)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['mis-afiliaciones'],
    queryFn: () => fetcher<{ data: MiAfiliacion[] }>('/afiliaciones/mis'),
    staleTime: 30_000,
  })
  const cursos = (data?.data ?? []).filter(c => c.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  const { data: resumenData, isLoading: resumenCargando } = useQuery({
    queryKey: ['afiliaciones-resumen'],
    queryFn: () => fetcher<{ data: Resumen }>('/afiliaciones/resumen'),
    enabled: isAdmin && verEquipo,
    staleTime: 30_000,
  })

  const toggle = useMutation({
    mutationFn: ({ cursoId, afiliado }: { cursoId: string; afiliado: boolean }) =>
      fetcher(`/afiliaciones/${cursoId}`, { method: afiliado ? 'DELETE' : 'POST' }),
    onMutate: async ({ cursoId, afiliado }) => {
      await queryClient.cancelQueries({ queryKey: ['mis-afiliaciones'] })
      const previo = queryClient.getQueryData<{ data: MiAfiliacion[] }>(['mis-afiliaciones'])
      queryClient.setQueryData<{ data: MiAfiliacion[] }>(['mis-afiliaciones'], old => old && {
        data: old.data.map(c => c.id === cursoId ? { ...c, afiliado: !afiliado } : c),
      })
      return { previo }
    },
    onError: (_e, _v, ctx) => { if (ctx?.previo) queryClient.setQueryData(['mis-afiliaciones'], ctx.previo) },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['mis-afiliaciones'] })
      queryClient.invalidateQueries({ queryKey: ['afiliaciones-resumen'] })
    },
  })

  const total = data?.data.length ?? 0
  const marcados = data?.data.filter(c => c.afiliado).length ?? 0

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader
          title="Enlaces de afiliación"
          subtitle={isLoading ? 'Cargando…' : `${marcados} de ${total} productos marcados como afiliado`}
        />
        {isAdmin && (
          <button
            onClick={() => setVerEquipo(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold transition-colors cursor-pointer',
              verEquipo ? 'bg-primary text-on-primary' : 'bg-surface-high text-on-surface-variant hover:text-on-surface',
            )}
          >
            <Users className="w-3.5 h-3.5" /> Ver equipo
          </button>
        )}
      </div>

      <p className="text-[12.5px] text-on-surface-variant leading-relaxed">
        Hotmart no permite consultar el estado de afiliación por API — ábrelo en Hotmart, revisa si ya
        apareces como afiliado, y marca aquí tu propio estado.
      </p>

      {verEquipo && isAdmin ? (
        <div className="card overflow-hidden">
          {resumenCargando ? (
            <div className="flex items-center justify-center py-16 text-on-surface-variant"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : !resumenData?.data.asesores.length ? (
            <p className="text-[13px] text-on-surface-variant text-center py-16">Sin asesores registrados.</p>
          ) : (
            <div className="divide-y divide-outline-variant">
              {resumenData.data.asesores.map(a => {
                const faltantes = resumenData.data.cursos.filter((_, i) => !a.cursos[i]).map(c => c.nombre)
                return (
                  <div key={a.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] font-semibold text-on-surface">{a.nombre}</p>
                      <span className={cn(
                        'text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0',
                        a.afiliados === a.total ? 'bg-[#16a34a]/15 text-[#16a34a]' : 'bg-surface-high text-on-surface-variant',
                      )}>
                        {a.afiliados}/{a.total}
                      </span>
                    </div>
                    {faltantes.length > 0 && (
                      <p className="text-[11.5px] text-on-surface-variant mt-1 truncate">
                        Falta: {faltantes.join(', ')}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input
              type="search"
              placeholder="Buscar curso..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              autoComplete="off"
              className="w-full bg-surface-high border border-outline-variant rounded-lg pl-9 pr-3 py-2 text-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
          </div>

          <div className="card overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-on-surface-variant"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : cursos.length === 0 ? (
              <p className="text-[13px] text-on-surface-variant text-center py-16">Sin resultados.</p>
            ) : (
              <div className="divide-y divide-outline-variant">
                {cursos.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-3.5">
                    <button
                      onClick={() => toggle.mutate({ cursoId: c.id, afiliado: c.afiliado })}
                      className="shrink-0 cursor-pointer"
                      aria-label={c.afiliado ? 'Marcar como no afiliado' : 'Marcar como afiliado'}
                    >
                      {c.afiliado
                        ? <CheckCircle2 className="w-5 h-5 text-[#16a34a]" />
                        : <Circle className="w-5 h-5 text-on-surface-variant" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-[13px] font-semibold truncate', c.afiliado ? 'text-on-surface' : 'text-on-surface')}>{c.nombre}</p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">{c.afiliado ? 'Afiliado' : 'Sin registrar'}</p>
                    </div>
                    {c.linkAfiliacion ? (
                      <a
                        href={c.linkAfiliacion}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:underline shrink-0"
                      >
                        Abrir en Hotmart <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-on-surface-variant/60 shrink-0">Sin link configurado</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
