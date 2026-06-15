'use client'

import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { formatCurso } from '@/lib/utils'
import { BookOpen } from 'lucide-react'

interface CursoData {
  id: string
  nombre: string
  precio: number
  _count: { estudiantes: number }
}

interface Burbuja {
  nombre: string
  abrev: string
  vendidos: number
  r: number
  x: number
  y: number
  color: string
}

const COLORS_LIGHT = ['#1a7de0', '#16a34a', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#db2777', '#65a30d', '#b45309', '#0f766e']
const COLORS_DARK  = ['#95daff', '#6ee7b7', '#fbbf24', '#c4b5fd', '#fca5a5', '#67e8f9', '#f9a8d4', '#bef264', '#fcd34d', '#5eead4']

// Empaquetado de burbujas — algoritmo iterativo simple de repulsión
function packBubbles(items: { vendidos: number }[], W: number, H: number): { x: number; y: number; r: number }[] {
  const maxV = Math.max(...items.map(i => i.vendidos), 1)
  const minR = 22
  const maxR = Math.min(W, H) * 0.28
  const nodes = items.map(it => ({
    r: minR + (Math.sqrt(it.vendidos / maxV)) * (maxR - minR),
    x: W / 2 + (Math.random() - 0.5) * W * 0.3,
    y: H / 2 + (Math.random() - 0.5) * H * 0.3,
  }))

  const ITERS = 180
  for (let iter = 0; iter < ITERS; iter++) {
    const alpha = 1 - iter / ITERS
    // Repulsión entre burbujas
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x
        const dy = nodes[j].y - nodes[i].y
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001
        const minDist = nodes[i].r + nodes[j].r + 4
        if (dist < minDist) {
          const push = ((minDist - dist) / dist) * 0.5 * alpha
          nodes[i].x -= dx * push
          nodes[i].y -= dy * push
          nodes[j].x += dx * push
          nodes[j].y += dy * push
        }
      }
      // Atracción al centro
      nodes[i].x += (W / 2 - nodes[i].x) * 0.012 * alpha
      nodes[i].y += (H / 2 - nodes[i].y) * 0.012 * alpha
      // Clamp dentro del canvas con padding
      const pad = nodes[i].r + 6
      nodes[i].x = Math.max(pad, Math.min(W - pad, nodes[i].x))
      nodes[i].y = Math.max(pad, Math.min(H - pad, nodes[i].y))
    }
  }
  return nodes
}

function abreviar(nombre: string): string {
  const s = formatCurso(nombre)
  return s.length > 18 ? s.slice(0, 16) + '…' : s
}

function BubbleChart({ burbujas, W, H }: { burbujas: Burbuja[]; W: number; H: number }) {
  const [visible, setVisible] = useState(false)
  const [scales, setScales] = useState<number[]>(burbujas.map(() => 0))

  useEffect(() => {
    setVisible(false)
    setScales(burbujas.map(() => 0))
    const t1 = setTimeout(() => setVisible(true), 30)
    const timers = burbujas.map((_, i) =>
      setTimeout(() => setScales(prev => { const n = [...prev]; n[i] = 1; return n }), 80 + i * 60)
    )
    return () => { clearTimeout(t1); timers.forEach(clearTimeout) }
  }, [burbujas])

  if (!visible) return null

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow: 'visible' }}>
      {burbujas.map((b, i) => {
        const s = scales[i]
        return (
          <g key={b.nombre} style={{ transform: `translate(${b.x}px, ${b.y}px) scale(${s})`, transformOrigin: '0px 0px', transition: 'transform 500ms cubic-bezier(0.23,1,0.32,1)' }}>
            {/* Sombra suave */}
            <circle r={b.r + 2} fill={b.color} opacity={0.12} />
            {/* Burbuja */}
            <circle r={b.r} fill={b.color} opacity={0.18} />
            <circle r={b.r} fill="none" stroke={b.color} strokeWidth={2} />
            {/* Número */}
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              y={b.r < 36 ? -4 : -8}
              fontSize={Math.max(11, Math.min(b.r * 0.55, 28))}
              fontWeight="700"
              fill={b.color}
            >
              {b.vendidos}
            </text>
            {/* Nombre (solo si la burbuja es grande) */}
            {b.r >= 32 && (
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                y={b.r < 36 ? 10 : 14}
                fontSize={Math.max(9, Math.min(b.r * 0.18, 12))}
                fontWeight="500"
                fill={b.color}
                opacity={0.85}
              >
                {b.abrev}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function CursosVendidosRanked({ desde, hasta }: { desde: string; hasta: string }) {
  const { resolvedTheme: theme } = useTheme()
  const isDark    = theme === 'dark'
  const temaListo = theme !== undefined
  const colors    = isDark ? COLORS_DARK : COLORS_LIGHT
  const containerRef = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(600)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['cursos-vendidos-reportes', desde, hasta],
    queryFn: async () => apiFetch(`/reportes/cursos?desde=${desde}&hasta=${hasta}`) as Promise<{ data: CursoData[] }>,
    staleTime: 30_000,
  })

  const cursos = (!temaListo || isLoading)
    ? []
    : (data?.data ?? [])
        .map(c => ({ nombre: c.nombre, vendidos: c._count.estudiantes }))
        .filter(c => c.vendidos > 0)
        .sort((a, b) => b.vendidos - a.vendidos)

  const total = cursos.reduce((s, c) => s + c.vendidos, 0)

  // Calcular posiciones con W disponible
  const H = Math.max(240, Math.min(W * 0.55, 420))
  const packed = cursos.length > 0 ? packBubbles(cursos, W, H) : []
  const burbujas: Burbuja[] = cursos.map((c, i) => ({
    nombre:   c.nombre,
    abrev:    abreviar(c.nombre),
    vendidos: c.vendidos,
    r:        packed[i]?.r ?? 30,
    x:        packed[i]?.x ?? W / 2,
    y:        packed[i]?.y ?? H / 2,
    color:    colors[i % colors.length],
  }))

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[var(--primary-container)] flex items-center justify-center">
            <BookOpen className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="text-[15px] font-semibold text-on-surface">Cursos más vendidos</h3>
        </div>
        {!isLoading && (
          <span className="text-[11px] text-on-surface-variant tabular-nums">
            {total} venta{total !== 1 ? 's' : ''} totales
          </span>
        )}
      </div>

      <div ref={containerRef}>
        {!temaListo || isLoading ? (
          <div className="flex items-center justify-center" style={{ height: 280 }}>
            <div className="flex gap-3 items-end">
              {[60, 90, 50, 70, 40].map((r, i) => (
                <div key={i} className="rounded-full bg-surface-high animate-pulse"
                  style={{ width: r, height: r, animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
          </div>
        ) : cursos.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant text-center py-8">Sin ventas registradas en este período</p>
        ) : (
          <>
            <BubbleChart burbujas={burbujas} W={W} H={H} />
            {/* Leyenda */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4">
              {burbujas.map((b) => (
                <div key={b.nombre} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: b.color }} />
                  <span className="text-[11px] text-on-surface-variant">{abreviar(b.nombre)}</span>
                  <span className="text-[11px] font-semibold text-on-surface tabular-nums">{b.vendidos}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
