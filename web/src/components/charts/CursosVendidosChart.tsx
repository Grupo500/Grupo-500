'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { formatCurso } from '@/lib/utils'
import { BookOpen, ChevronRight } from 'lucide-react'

interface CursoData {
  id: string
  nombre: string
  precio: number
  _count: { estudiantes: number }
}

function Skeleton() {
  return (
    <div className="card p-5 h-72 animate-pulse">
      <div className="h-4 w-44 bg-[var(--surface-high)] rounded-md mb-5" />
      <div className="flex justify-center">
        <div className="w-32 h-32 rounded-full bg-[var(--surface-high)]" />
      </div>
    </div>
  )
}

const COLORS_LIGHT = ['#1a7de0', '#2e9e6b', '#d97706', '#7c3aed', '#dc2626', '#0891b2']
const COLORS_DARK  = ['#95daff', '#6ee7b7', '#fbbf24', '#c4b5fd', '#fca5a5', '#67e8f9']

export function CursosVendidosChart({ desde, hasta }: { desde: string; hasta: string }) {
  const { resolvedTheme: theme } = useTheme()
  const isDark    = theme === 'dark'
  const temaListo = theme !== undefined

  const colors = isDark ? COLORS_DARK : COLORS_LIGHT

  const { data, isLoading, isError } = useQuery({
    queryKey: ['cursos-vendidos', desde, hasta],
    queryFn: async () => apiFetch(`/reportes/cursos?desde=${desde}&hasta=${hasta}`) as Promise<{ data: CursoData[] }>,
    staleTime: 30_000,
  })

  if (!temaListo || isLoading) return <Skeleton />

  const todos = (data?.data ?? [])
    .map(c => ({ nombre: c.nombre, vendidos: c._count.estudiantes }))
    .filter(c => c.vendidos > 0)

  const total  = todos.reduce((s, c) => s + c.vendidos, 0)   // total REAL (todos)
  const cursos = todos.slice(0, 5)                            // top 5 para la leyenda
  const otros  = total - cursos.reduce((s, c) => s + c.vendidos, 0)
  const grisOtros = isDark ? '#3a4d6e' : '#c2d4ef'

  // Rebanadas de la dona: top 5 + "Otros" (gris) para que el anillo sea 100%
  const slices = otros > 0
    ? [...cursos, { nombre: 'Otros', vendidos: otros }]
    : cursos

  return (
    <div className="card p-5 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-md bg-[var(--primary-container)] flex items-center justify-center">
          <BookOpen className="w-3.5 h-3.5 text-primary" />
        </div>
        <h3 className="text-[15px] font-semibold text-on-surface">Cursos más vendidos</h3>
      </div>

      {isError || cursos.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-[13px] text-on-surface-variant">
          Sin datos disponibles
        </div>
      ) : (
        <>
          {/* Dona delgada con puntas redondeadas y total al centro */}
          <div className="relative mx-auto" style={{ width: 124, height: 124 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="vendidos"
                  nameKey="nombre"
                  innerRadius="82%"
                  outerRadius="100%"
                  paddingAngle={3}
                  cornerRadius={10}
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                >
                  {slices.map((s, i) => <Cell key={i} fill={s.nombre === 'Otros' ? grisOtros : colors[i % colors.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[24px] font-bold text-on-surface tabular-nums leading-none">{total}</span>
              <span className="text-[11px] text-on-surface-variant mt-0.5">ventas</span>
            </div>
          </div>

          {/* Leyenda debajo — top 5 + Otros, nombre completo */}
          <div className="space-y-1.5 mt-3">
            {slices.map((c, i) => {
              const esOtros = c.nombre === 'Otros'
              return (
                <div key={c.nombre} className="flex items-start gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-[3px]" style={{ background: esOtros ? grisOtros : colors[i % colors.length] }} />
                  <span className={`text-[12px] flex-1 leading-snug ${esOtros ? 'text-on-surface-variant' : 'text-on-surface'}`}>{esOtros ? 'Otros' : formatCurso(c.nombre)}</span>
                  <span className={`text-[12px] font-bold tabular-nums flex-shrink-0 ${esOtros ? 'text-on-surface-variant' : 'text-on-surface'}`}>{c.vendidos}</span>
                </div>
              )
            })}
          </div>

          {/* Ver todo */}
          <Link href="/cursos" className="mt-3 flex items-center justify-center gap-1 text-[12px] font-semibold text-primary hover:underline">
            Ver todo <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </>
      )}
    </div>
  )
}
