'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { createClientFetcher } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate, cn } from '@/lib/utils'
import { FileBarChart2, Loader2, TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react'

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

export default function SimulacrosPage() {
  const { getToken } = useAuth()

  const fetcher = async <T,>(path: string) => {
    const token = await getToken()
    return createClientFetcher(token)<T>(path)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['simulacros'],
    queryFn: () => fetcher<any>('/simulacros'),
  })

  const simulacros: Simulacro[] = data?.data ?? []

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Simulacros"
        subtitle="Análisis de rendimiento por simulacro"
      />

      <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 text-sm text-on-surface-variant">
        <p className="text-primary font-medium mb-1">Importación de simulacros</p>
        <p>La importación y análisis automático de PDFs estará disponible próximamente. Por ahora se muestran los resultados ya cargados en el sistema.</p>
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
    </div>
  )
}
