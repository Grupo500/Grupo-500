'use client'

import { useState } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import colombiaGeo from './colombia.geo.json'

interface DeptData { nombre: string; cantidad: number; porcentaje: number }
interface Props { departamentos: DeptData[]; totalDep: number }

// Normalizar nombre del GeoJSON → nombre del backend
const NAME_MAP: Record<string, string> = {
  'ANTIOQUIA':           'Antioquia',
  'ATLANTICO':           'Atlántico',
  'SANTAFE DE BOGOTA D.C': 'Bogotá D.C.',
  'BOLIVAR':             'Bolívar',
  'BOYACA':              'Boyacá',
  'CALDAS':              'Caldas',
  'CAQUETA':             'Caquetá',
  'CAUCA':               'Cauca',
  'CESAR':               'Cesar',
  'CORDOBA':             'Córdoba',
  'CUNDINAMARCA':        'Cundinamarca',
  'CHOCO':               'Chocó',
  'HUILA':               'Huila',
  'LA GUAJIRA':          'La Guajira',
  'MAGDALENA':           'Magdalena',
  'META':                'Meta',
  'NARIÑO':              'Nariño',
  'NORTE DE SANTANDER':  'Norte de Santander',
  'QUINDIO':             'Quindío',
  'RISARALDA':           'Risaralda',
  'SANTANDER':           'Santander',
  'SUCRE':               'Sucre',
  'TOLIMA':              'Tolima',
  'VALLE DEL CAUCA':     'Valle del Cauca',
  'ARAUCA':              'Arauca',
  'CASANARE':            'Casanare',
  'PUTUMAYO':            'Putumayo',
  'AMAZONAS':            'Amazonas',
  'GUAINIA':             'Guainía',
  'GUAVIARE':            'Guaviare',
  'VAUPES':              'Vaupés',
  'VICHADA':             'Vichada',
  'ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA': 'San Andrés',
}

const SAN_ANDRES_RAW = 'ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA'

// FeatureCollection solo con el archipiélago, para el inset con zoom
const sanAndresGeo = {
  type: 'FeatureCollection',
  features: (colombiaGeo as { features: Array<{ properties: { NOMBRE_DPT: string } }> }).features
    .filter(f => f.properties.NOMBRE_DPT === SAN_ANDRES_RAW),
}

export function ColombiaMap({ departamentos, totalDep }: Props) {
  const [tooltip, setTooltip] = useState<{ nombre: string; cantidad: number; porcentaje: number } | null>(null)
  const [hoveredRaw, setHoveredRaw] = useState<string | null>(null)

  const maxCantidad = Math.max(...departamentos.map(d => d.cantidad), 1)
  const dataMap = Object.fromEntries(departamentos.map(d => [d.nombre, d]))

  function getFill(rawName: string): string {
    const nombre = NAME_MAP[rawName] ?? rawName
    const d = dataMap[nombre]
    if (!d || d.cantidad === 0) return '#dce8f5'
    const ratio = d.cantidad / maxCantidad
    return `rgba(32, 148, 255, ${0.2 + ratio * 0.75})`
  }

  return (
    <div className="relative w-full">
      {/* Tooltip */}
      {tooltip && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none
          bg-surface-lowest border border-outline-variant rounded-xl shadow-float
          px-3 py-2 text-center min-w-[140px]">
          <p className="text-[12px] font-semibold text-on-surface">{tooltip.nombre}</p>
          <p className="text-[11px] text-on-surface-variant mt-0.5">
            {tooltip.cantidad > 0
              ? `${tooltip.cantidad} estudiante${tooltip.cantidad !== 1 ? 's' : ''} · ${tooltip.porcentaje}%`
              : 'Sin estudiantes'}
          </p>
        </div>
      )}

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center: [-74, 4], scale: 1350 }}
        width={400}
        height={460}
        style={{ width: '100%', height: 'auto' }}
      >
        <Geographies geography={colombiaGeo as never}>
          {({ geographies }) => {
            // San Andrés se excluye del mapa principal: se muestra en el inset.
            // El departamento hovereado se dibuja al final para que su borde
            // no quede tapado por los paths vecinos
            const continental = geographies.filter(g => g.properties.NOMBRE_DPT !== SAN_ANDRES_RAW)
            const ordered = hoveredRaw
              ? [...continental].sort((a, b) =>
                  (a.properties.NOMBRE_DPT === hoveredRaw ? 1 : 0) - (b.properties.NOMBRE_DPT === hoveredRaw ? 1 : 0))
              : continental
            return ordered.map((geo) => {
              const rawName  = geo.properties.NOMBRE_DPT as string
              const nombre   = NAME_MAP[rawName] ?? rawName
              const d        = dataMap[nombre]
              const isHovered = hoveredRaw === rawName
              const hasData   = !!(d && d.cantidad > 0)
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={isHovered && !hasData ? '#e2edf7' : getFill(rawName)}
                  stroke={isHovered ? '#2094ff' : '#b0cce8'}
                  strokeWidth={isHovered ? 1.5 : 0.8}
                  tabIndex={-1}
                  style={{
                    default: { outline: 'none', transition: 'fill 150ms', cursor: hasData ? 'pointer' : 'default' },
                    hover:   { outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                  onMouseEnter={() => {
                    setHoveredRaw(rawName)
                    setTooltip({ nombre, cantidad: d?.cantidad ?? 0, porcentaje: d?.porcentaje ?? 0 })
                  }}
                  onMouseLeave={() => {
                    setHoveredRaw(null)
                    setTooltip(null)
                  }}
                />
              )
            })
          }}
        </Geographies>

      </ComposableMap>

      {/* Inset San Andrés — recuadro con zoom a la isla (queda fuera del extent continental) */}
      {(() => {
        const dSA = dataMap['San Andrés']
        const hasSA = !!(dSA && dSA.cantidad > 0)
        const isHoveredSA = hoveredRaw === SAN_ANDRES_RAW
        return (
          <div
            className={`absolute top-2 left-2 rounded-xl border bg-surface-lowest/80 backdrop-blur-sm overflow-hidden transition-colors ${isHoveredSA ? 'border-[#2094ff]' : 'border-[#b0cce8]'}`}
            style={{ cursor: hasSA ? 'pointer' : 'default' }}
            onMouseEnter={() => {
              setHoveredRaw(SAN_ANDRES_RAW)
              setTooltip({ nombre: 'San Andrés', cantidad: dSA?.cantidad ?? 0, porcentaje: dSA?.porcentaje ?? 0 })
            }}
            onMouseLeave={() => {
              setHoveredRaw(null)
              setTooltip(null)
            }}
          >
            {/* San Andrés a la izquierda + Providencia arriba a la derecha,
                cada una con su propio zoom (distancia real comprimida) */}
            <div className="relative" style={{ width: 112, height: 96 }}>
              <ComposableMap
                projection="geoMercator"
                projectionConfig={{ center: [-81.717, 12.55], scale: 41000 }}
                width={58}
                height={96}
                style={{ position: 'absolute', left: 2, top: 0, width: 58, height: 96 }}
              >
                <Geographies geography={sanAndresGeo as never}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={hasSA ? getFill(SAN_ANDRES_RAW) : '#dce8f5'}
                        stroke={isHoveredSA ? '#2094ff' : '#b0cce8'}
                        strokeWidth={isHoveredSA ? 1.2 : 0.8}
                        style={{ default: { outline: 'none', transition: 'fill 150ms', pointerEvents: 'none' } }}
                      />
                    ))
                  }
                </Geographies>
              </ComposableMap>
              <ComposableMap
                projection="geoMercator"
                projectionConfig={{ center: [-81.373, 13.355], scale: 40000 }}
                width={50}
                height={62}
                style={{ position: 'absolute', right: 2, top: 4, width: 50, height: 62 }}
              >
                <Geographies geography={sanAndresGeo as never}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={hasSA ? getFill(SAN_ANDRES_RAW) : '#dce8f5'}
                        stroke={isHoveredSA ? '#2094ff' : '#b0cce8'}
                        strokeWidth={isHoveredSA ? 1.2 : 0.8}
                        style={{ default: { outline: 'none', transition: 'fill 150ms', pointerEvents: 'none' } }}
                      />
                    ))
                  }
                </Geographies>
              </ComposableMap>
            </div>
            <p className="text-[9px] font-semibold text-on-surface-variant text-center pt-1 pb-1.5 px-1.5 leading-tight">San Andrés y Providencia</p>
          </div>
        )
      })()}

      {/* Leyenda escala */}
      {totalDep > 0 && (
        <div className="flex items-center gap-2 mt-1 justify-center">
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
