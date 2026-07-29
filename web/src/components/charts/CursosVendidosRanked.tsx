'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { apiFetch } from '@/lib/api'
import { BookOpen, ChevronDown } from 'lucide-react'

interface CursoData {
  id: string
  nombre: string
  precio: number
  familia: string | null
  _count: { estudiantes: number }
}

// Un color por línea de producto, no uno por curso: con 23 cursos la paleta se
// agota y dos productos distintos terminan con el mismo tono.
const COLOR_FAMILIA: Record<string, { claro: string; oscuro: string }> = {
  'Intensivo':  { claro: '#1a7de0', oscuro: '#95daff' },
  'Calendario': { claro: '#2e9e6b', oscuro: '#6ee7b7' },
  'Combo':      { claro: '#d97706', oscuro: '#fbbf24' },
  'Año 500':    { claro: '#db2777', oscuro: '#f9a8d4' },
  'Ruta 500':   { claro: '#7c3aed', oscuro: '#c4b5fd' },
  'Premédico':  { claro: '#0891b2', oscuro: '#67e8f9' },
  'Otros':      { claro: '#64748b', oscuro: '#94a3b8' },
}

// Dentro de una familia el nombre repite el prefijo en todas las filas
// ("Combo | Calendario G 2026 + …"). Se recorta para que la diferencia real
// quede al principio.
function nombreCorto(nombre: string, familia: string | null): string {
  let n = nombre.trim()
  if (familia && n.toLowerCase().startsWith(familia.toLowerCase())) {
    n = n.slice(familia.length).replace(/^\s*[|·—-]\s*/, '').trim()
  }
  n = n.replace(/^\|\s*/, '').trim()
  return n || nombre
}

export function CursosVendidosRanked({ desde, hasta }: { desde: string; hasta: string }) {
  const { resolvedTheme: theme } = useTheme()
  const isDark = theme === 'dark'
  const temaListo = theme !== undefined
  const [abierta, setAbierta] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['cursos-vendidos-reportes', desde, hasta],
    queryFn: async () => apiFetch(`/reportes/cursos?desde=${desde}&hasta=${hasta}`) as Promise<{ data: CursoData[] }>,
    staleTime: 30_000,
  })

  if (!temaListo || isLoading) {
    return (
      <div className="card p-5">
        <div className="h-4 w-44 rounded bg-surface-high animate-pulse mb-5" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-6 rounded bg-surface-high animate-pulse" />)}
        </div>
      </div>
    )
  }

  const cursos = (data?.data ?? []).filter(c => c._count.estudiantes > 0)
  const total = cursos.reduce((s, c) => s + c._count.estudiantes, 0)

  // Agrupar por línea de producto
  const familias = new Map<string, { nombre: string; total: number; cursos: { nombre: string; vendidos: number }[] }>()
  for (const c of cursos) {
    const f = c.familia ?? 'Otros'
    const g = familias.get(f) ?? { nombre: f, total: 0, cursos: [] }
    g.total += c._count.estudiantes
    g.cursos.push({ nombre: nombreCorto(c.nombre, c.familia), vendidos: c._count.estudiantes })
    familias.set(f, g)
  }
  const orden = [...familias.values()].sort((a, b) => b.total - a.total)
  orden.forEach(f => f.cursos.sort((a, b) => b.vendidos - a.vendidos))
  const mayor = orden[0]?.total ?? 1

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[var(--primary-container)] flex items-center justify-center">
            <BookOpen className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-[15px] font-semibold text-on-surface">Cursos más vendidos</h3>
        </div>
        <span className="text-[11px] text-on-surface-variant tabular-nums">
          {total} venta{total !== 1 ? 's' : ''} totales
        </span>
      </div>

      {total === 0 ? (
        <p className="text-[13px] text-on-surface-variant text-center py-8">Sin ventas registradas en este período</p>
      ) : (
        <div className="space-y-0.5">
          {orden.map(f => {
            const color = (COLOR_FAMILIA[f.nombre] ?? COLOR_FAMILIA['Otros'])[isDark ? 'oscuro' : 'claro']
            const pct = Math.round((f.total / total) * 100)
            const desplegable = f.cursos.length > 1
            const abiertaEsta = abierta === f.nombre

            return (
              <div key={f.nombre}>
                <button
                  onClick={() => desplegable && setAbierta(abiertaEsta ? null : f.nombre)}
                  disabled={!desplegable}
                  aria-expanded={desplegable ? abiertaEsta : undefined}
                  className={`w-full grid grid-cols-[100px_1fr_74px] sm:grid-cols-[128px_1fr_88px] items-center gap-2.5 sm:gap-3 py-1.5 px-1 rounded-lg text-left transition-colors ${desplegable ? 'cursor-pointer hover:bg-surface-high/60' : 'cursor-default'}`}
                >
                  <span className="flex items-center gap-1 min-w-0">
                    {desplegable ? (
                      <ChevronDown
                        className={`w-3.5 h-3.5 shrink-0 text-on-surface-variant transition-transform ${abiertaEsta ? '' : '-rotate-90'}`}
                      />
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}
                    <span className="text-[12.5px] font-semibold text-on-surface truncate">{f.nombre}</span>
                  </span>

                  <span className="h-[22px] rounded bg-surface-high overflow-hidden block">
                    <span
                      className="block h-full rounded transition-all duration-500"
                      style={{ width: `${Math.max(2, (f.total / mayor) * 100)}%`, background: color }}
                    />
                  </span>

                  <span className="text-[12.5px] text-right tabular-nums text-on-surface">
                    {f.total}
                    <span className="text-on-surface-variant ml-1.5">{pct}%</span>
                  </span>
                </button>

                {abiertaEsta && (
                  <div className="pl-5 sm:pl-8 pr-1 pb-2 animate-fade-in">
                    {f.cursos.map(c => (
                      <div key={c.nombre} className="grid grid-cols-[1fr_46px] gap-3 items-center py-1">
                        <div className="min-w-0">
                          <p className="text-[12px] text-on-surface-variant truncate">{c.nombre}</p>
                          <span className="block h-1.5 rounded-full bg-surface-high overflow-hidden mt-1">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${Math.max(3, (c.vendidos / f.total) * 100)}%`, background: color, opacity: 0.55 }}
                            />
                          </span>
                        </div>
                        <span className="text-[12px] text-right tabular-nums text-on-surface-variant">{c.vendidos}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
