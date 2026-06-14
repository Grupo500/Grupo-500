'use client'

import React from 'react'

// Ancho por punto cuando la gráfica se vuelve scrolleable
export const POINT_WIDTH      = 46
// A partir de cuántos puntos se activa el scroll horizontal
export const SCROLL_THRESHOLD = 15
// Ancho reservado para el eje Y fijo
export const AXIS_WIDTH       = 48
// Altura reservada para las etiquetas de fecha (eje X)
export const XAXIS_HEIGHT     = 22

/**
 * Calcula un máximo "redondo" y sus marcas para el eje Y, de modo que el eje
 * fijo (izquierda) y el área scrolleable (derecha) compartan exactamente la
 * misma escala y sus líneas coincidan.
 */
export function niceScale(rawMax: number, tickCount = 4): { max: number; ticks: number[] } {
  if (rawMax <= 0) return { max: 1, ticks: [0, 1] }
  const rough = rawMax / tickCount
  const mag   = Math.pow(10, Math.floor(Math.log10(rough)))
  const n     = rough / mag
  const nice  = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  const step  = nice * mag
  const max   = Math.ceil(rawMax / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= max + step / 2; v += step) ticks.push(Math.round(v))
  return { max, ticks }
}

interface Props {
  count:  number
  height: number
  /** Gráfica responsiva completa (cuando NO hay scroll). */
  fullChart: React.ReactNode
  /** Mini-gráfica de solo eje Y, ancho fijo AXIS_WIDTH (cuando SÍ hay scroll). */
  axisChart: React.ReactNode
  /** Gráfica del área de datos, ancho fijo recibido (cuando SÍ hay scroll). */
  plotChart: (width: number) => React.ReactNode
}

/**
 * Marco que decide entre gráfica completa o gráfica con eje Y fijo + scroll
 * horizontal. El eje Y queda quieto a la izquierda; solo el área de datos
 * (líneas/barras + fechas) se desplaza.
 */
export function ScrollableChartFrame({ count, height, fullChart, axisChart, plotChart }: Props) {
  if (count <= SCROLL_THRESHOLD) return <>{fullChart}</>

  return (
    <div className="flex" style={{ height }}>
      <div style={{ width: AXIS_WIDTH, flexShrink: 0 }}>{axisChart}</div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden chart-scroll">
        {plotChart(count * POINT_WIDTH)}
      </div>
    </div>
  )
}
