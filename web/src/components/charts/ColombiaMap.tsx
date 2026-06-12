'use client'

import { useState } from 'react'

interface DeptData { nombre: string; cantidad: number; porcentaje: number }

interface Props {
  departamentos: DeptData[]
  totalDep: number
}

// Paths SVG simplificados de los departamentos de Colombia
// viewBox: 0 0 500 600
const DEPT_PATHS: Array<{ id: string; nombre: string; path: string; labelX: number; labelY: number }> = [
  { id: 'guajira',    nombre: 'La Guajira',         labelX: 258, labelY: 30,
    path: 'M220 15 L290 10 L310 20 L295 50 L265 60 L240 55 L218 40 Z' },
  { id: 'magdalena',  nombre: 'Magdalena',           labelX: 210, labelY: 65,
    path: 'M180 35 L220 15 L240 55 L225 90 L200 100 L175 85 L170 60 Z' },
  { id: 'cesar',      nombre: 'Cesar',               labelX: 258, labelY: 80,
    path: 'M240 55 L295 50 L305 75 L290 110 L260 115 L235 100 L225 90 Z' },
  { id: 'atlantico',  nombre: 'Atlántico',           labelX: 162, labelY: 44,
    path: 'M148 30 L180 35 L170 60 L150 62 L140 48 Z' },
  { id: 'bolivar',    nombre: 'Bolívar',             labelX: 175, labelY: 105,
    path: 'M148 65 L175 85 L200 100 L195 135 L165 150 L140 140 L130 110 L140 80 Z' },
  { id: 'sucre',      nombre: 'Sucre',               labelX: 148, labelY: 82,
    path: 'M130 68 L148 65 L140 80 L130 95 L118 88 Z' },
  { id: 'cordoba',    nombre: 'Córdoba',             labelX: 132, labelY: 110,
    path: 'M105 80 L130 68 L130 95 L140 140 L120 155 L95 140 L90 110 L100 88 Z' },
  { id: 'norte-san',  nombre: 'Norte de Santander',  labelX: 282, labelY: 130,
    path: 'M260 115 L305 75 L330 85 L335 115 L310 145 L275 150 L265 135 Z' },
  { id: 'santander',  nombre: 'Santander',           labelX: 250, labelY: 160,
    path: 'M225 140 L265 135 L275 150 L270 185 L245 200 L220 190 L210 165 Z' },
  { id: 'antioquia',  nombre: 'Antioquia',           labelX: 158, labelY: 175,
    path: 'M105 145 L140 140 L165 150 L180 170 L185 210 L165 235 L130 235 L100 215 L85 185 L90 160 Z' },
  { id: 'choco',      nombre: 'Chocó',               labelX: 98,  labelY: 195,
    path: 'M65 155 L90 160 L85 185 L100 215 L80 245 L60 235 L50 200 L55 168 Z' },
  { id: 'boyaca',     nombre: 'Boyacá',              labelX: 250, labelY: 200,
    path: 'M220 190 L245 200 L255 235 L240 260 L210 255 L200 225 L205 200 Z' },
  { id: 'cundinamarca', nombre: 'Cundinamarca',      labelX: 228, labelY: 248,
    path: 'M205 235 L240 260 L238 285 L215 290 L195 275 L195 250 Z' },
  { id: 'caldas',     nombre: 'Caldas',             labelX: 172, labelY: 232,
    path: 'M165 235 L185 235 L192 250 L178 262 L160 255 L158 240 Z' },
  { id: 'risaralda',  nombre: 'Risaralda',           labelX: 155, labelY: 260,
    path: 'M148 255 L165 255 L168 275 L152 280 L140 270 Z' },
  { id: 'quindio',    nombre: 'Quindío',             labelX: 163, labelY: 277,
    path: 'M155 270 L168 275 L165 288 L152 285 Z' },
  { id: 'tolima',     nombre: 'Tolima',              labelX: 205, labelY: 285,
    path: 'M190 260 L215 265 L225 295 L215 325 L190 330 L170 315 L168 290 L180 270 Z' },
  { id: 'huila',      nombre: 'Huila',               labelX: 210, labelY: 345,
    path: 'M190 330 L215 325 L228 360 L215 390 L195 395 L178 375 L175 345 Z' },
  { id: 'valle',      nombre: 'Valle del Cauca',     labelX: 140, labelY: 295,
    path: 'M110 270 L148 265 L162 285 L168 310 L148 325 L118 320 L100 300 Z' },
  { id: 'cauca',      nombre: 'Cauca',               labelX: 148, labelY: 345,
    path: 'M110 325 L148 325 L162 355 L155 385 L130 395 L105 375 L100 345 Z' },
  { id: 'narino',     nombre: 'Nariño',              labelX: 138, labelY: 400,
    path: 'M100 385 L130 395 L148 415 L138 440 L110 450 L85 435 L82 410 Z' },
  { id: 'putumayo',   nombre: 'Putumayo',            labelX: 200, labelY: 420,
    path: 'M165 395 L210 390 L225 420 L210 445 L180 450 L160 430 Z' },
  { id: 'caqueta',    nombre: 'Caquetá',             labelX: 245, labelY: 390,
    path: 'M225 345 L270 340 L285 380 L275 420 L245 430 L220 415 L215 380 Z' },
  { id: 'meta',       nombre: 'Meta',                labelX: 270, labelY: 305,
    path: 'M240 270 L290 265 L310 295 L305 340 L275 355 L245 345 L230 315 Z' },
  { id: 'casanare',   nombre: 'Casanare',            labelX: 290, labelY: 230,
    path: 'M265 200 L310 195 L330 220 L325 260 L295 268 L268 255 L262 225 Z' },
  { id: 'arauca',     nombre: 'Arauca',              labelX: 290, labelY: 170,
    path: 'M265 150 L320 145 L340 160 L335 190 L310 195 L278 183 Z' },
  { id: 'vichada',    nombre: 'Vichada',             labelX: 355, labelY: 270,
    path: 'M330 220 L390 215 L410 255 L395 310 L360 325 L330 300 L325 260 Z' },
  { id: 'guainia',    nombre: 'Guainía',             labelX: 390, labelY: 350,
    path: 'M385 310 L425 305 L440 345 L420 385 L390 390 L368 360 Z' },
  { id: 'guaviare',   nombre: 'Guaviare',            labelX: 305, labelY: 365,
    path: 'M285 340 L330 335 L348 368 L335 400 L305 408 L280 390 Z' },
  { id: 'vaupes',     nombre: 'Vaupés',              labelX: 350, labelY: 410,
    path: 'M330 385 L375 380 L390 415 L375 450 L345 455 L322 430 Z' },
  { id: 'amazonas',   nombre: 'Amazonas',            labelX: 290, labelY: 470,
    path: 'M245 445 L300 440 L330 465 L320 510 L275 515 L248 490 Z' },
  { id: 'san-andres', nombre: 'San Andrés',          labelX: 55,  labelY: 105,
    path: 'M48 100 L62 100 L62 112 L48 112 Z' },
]

function interpolateColor(ratio: number, baseHex: string): string {
  // ratio 0 = muy tenue, ratio 1 = color base sólido
  const opacity = 0.15 + ratio * 0.85
  return `${baseHex}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
}

export function ColombiaMap({ departamentos, totalDep }: Props) {
  const [tooltip, setTooltip] = useState<{ nombre: string; cantidad: number; x: number; y: number } | null>(null)

  const maxCantidad = Math.max(...departamentos.map(d => d.cantidad), 1)

  const dataMap = Object.fromEntries(departamentos.map(d => [d.nombre, d]))

  function getDeptColor(nombre: string): string {
    const d = dataMap[nombre]
    if (!d || d.cantidad === 0) return 'var(--surface-high)'
    const ratio = d.cantidad / maxCantidad
    // Azul primario del sistema — interpolado por densidad
    return `rgba(32, 148, 255, ${0.12 + ratio * 0.78})`
  }

  function getDeptStroke(nombre: string): string {
    const d = dataMap[nombre]
    return d && d.cantidad > 0 ? '#2094ff' : 'var(--outline-variant)'
  }

  return (
    <div className="relative w-full">
      <svg
        viewBox="0 0 500 540"
        className="w-full h-auto"
        style={{ maxHeight: 420 }}
        onMouseLeave={() => setTooltip(null)}
      >
        {DEPT_PATHS.map(({ id, nombre, path, labelX, labelY }) => {
          const d = dataMap[nombre]
          const hasData = d && d.cantidad > 0
          return (
            <g key={id}>
              <path
                d={path}
                fill={getDeptColor(nombre)}
                stroke={getDeptStroke(nombre)}
                strokeWidth={hasData ? 1.5 : 1}
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={(e) => {
                  const rect = (e.target as SVGPathElement).closest('svg')?.getBoundingClientRect()
                  if (rect) {
                    setTooltip({ nombre, cantidad: d?.cantidad ?? 0, x: labelX, y: labelY })
                  }
                }}
                style={{
                  filter: hasData ? 'drop-shadow(0 1px 3px rgba(32,148,255,0.25))' : 'none',
                }}
              />
            </g>
          )
        })}

        {/* Tooltip inline en SVG */}
        {tooltip && (
          <g>
            <rect
              x={Math.min(tooltip.x - 40, 400)}
              y={tooltip.y - 32}
              width={110}
              height={28}
              rx={5}
              fill="var(--surface-lowest)"
              stroke="var(--outline-variant)"
              strokeWidth={1}
              style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.15))' }}
            />
            <text
              x={Math.min(tooltip.x - 40, 400) + 6}
              y={tooltip.y - 21}
              fontSize={9}
              fontWeight={600}
              fill="var(--on-surface)"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              {tooltip.nombre}
            </text>
            <text
              x={Math.min(tooltip.x - 40, 400) + 6}
              y={tooltip.y - 10}
              fontSize={8.5}
              fill="var(--on-surface-variant)"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              {tooltip.cantidad > 0 ? `${tooltip.cantidad} estudiante${tooltip.cantidad !== 1 ? 's' : ''}` : 'Sin datos'}
            </text>
          </g>
        )}
      </svg>

      {/* Leyenda de escala */}
      {totalDep > 0 && (
        <div className="flex items-center gap-2 mt-2 justify-center">
          <span className="text-[10px] text-on-surface-variant">Menos</span>
          <div className="flex h-2 w-24 rounded-full overflow-hidden">
            {[0.12, 0.27, 0.42, 0.57, 0.72, 0.87, 1].map((o, i) => (
              <div key={i} className="flex-1" style={{ background: `rgba(32,148,255,${o})` }} />
            ))}
          </div>
          <span className="text-[10px] text-on-surface-variant">Más</span>
        </div>
      )}
    </div>
  )
}
