'use client'

import { useState } from 'react'
import { COLOMBIA_PATHS } from './colombia-paths'

interface DeptData { nombre: string; cantidad: number; porcentaje: number }

interface Props {
  departamentos: DeptData[]
  totalDep: number
}

export function ColombiaMap({ departamentos, totalDep }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)

  const maxCantidad = Math.max(...departamentos.map(d => d.cantidad), 1)
  const dataMap = Object.fromEntries(departamentos.map(d => [d.nombre, d]))

  function getDeptFill(nombre: string): string {
    const d = dataMap[nombre]
    if (!d || d.cantidad === 0) return 'var(--surface-high)'
    const ratio = d.cantidad / maxCantidad
    return `rgba(32, 148, 255, ${0.15 + ratio * 0.8})`
  }

  const hoveredPath = hovered ? COLOMBIA_PATHS.find(p => p.nombre === hovered) : null
  const hoveredData = hovered ? dataMap[hovered] : null

  return (
    <div className="relative w-full">
      <svg
        viewBox="0 0 500 600"
        className="w-full h-auto"
        style={{ maxHeight: 440 }}
        onMouseLeave={() => setHovered(null)}
      >
        {COLOMBIA_PATHS.map(({ nombre, d }) => {
          const data    = dataMap[nombre]
          const hasData = !!data && data.cantidad > 0
          const isHovered = hovered === nombre
          return (
            <path
              key={nombre}
              d={d}
              fill={getDeptFill(nombre)}
              stroke={isHovered ? '#2094ff' : hasData ? 'rgba(32,148,255,0.6)' : 'var(--outline-variant)'}
              strokeWidth={isHovered ? 2 : 0.8}
              className="cursor-pointer"
              style={{
                transition: 'fill 200ms, stroke 150ms',
                filter: isHovered ? 'drop-shadow(0 2px 6px rgba(32,148,255,0.4))' : 'none',
              }}
              onMouseEnter={() => setHovered(nombre)}
            />
          )
        })}

        {/* Etiqueta del recuadro de San Andrés */}
        <text x={44} y={102} fontSize={8} textAnchor="middle" fill="var(--on-surface-variant)" style={{ fontFamily: 'Inter, sans-serif' }}>
          San Andrés
        </text>

        {/* Tooltip */}
        {hoveredPath && (
          (() => {
            const tx = Math.max(8, Math.min(hoveredPath.cx - 60, 372))
            const ty = Math.max(8, hoveredPath.cy - 56)
            return (
              <g style={{ pointerEvents: 'none' }}>
                <rect x={tx} y={ty} width={128} height={36} rx={6}
                  fill="var(--surface-lowest)" stroke="var(--outline-variant)" strokeWidth={1}
                  style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.18))' }} />
                <text x={tx + 8} y={ty + 15} fontSize={10.5} fontWeight={600}
                  fill="var(--on-surface)" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {hoveredPath.nombre}
                </text>
                <text x={tx + 8} y={ty + 28} fontSize={9.5}
                  fill="var(--on-surface-variant)" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {hoveredData && hoveredData.cantidad > 0
                    ? `${hoveredData.cantidad} estudiante${hoveredData.cantidad !== 1 ? 's' : ''} · ${hoveredData.porcentaje}%`
                    : 'Sin estudiantes'}
                </text>
              </g>
            )
          })()
        )}
      </svg>

      {/* Leyenda de escala */}
      {totalDep > 0 && (
        <div className="flex items-center gap-2 mt-2 justify-center">
          <span className="text-[10px] text-on-surface-variant">Menos</span>
          <div className="flex h-2 w-24 rounded-full overflow-hidden">
            {[0.15, 0.29, 0.43, 0.57, 0.71, 0.85, 0.95].map((o, i) => (
              <div key={i} className="flex-1" style={{ background: `rgba(32,148,255,${o})` }} />
            ))}
          </div>
          <span className="text-[10px] text-on-surface-variant">Más</span>
        </div>
      )}
    </div>
  )
}
