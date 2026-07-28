'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Anima un número desde su valor previo hasta `target` con easing de salida.
 * Ya se usaba en el dashboard del asesor y en Analíticas; vive aquí para que
 * las pantallas nuevas se sientan igual sin duplicar la implementación.
 */
export function useCountUp(target: number, duration = 900) {
  const [v, setV] = useState(0)
  const raf = useRef<number | null>(null)
  const prev = useRef(0)

  useEffect(() => {
    if (target === 0) { setV(0); prev.current = 0; return }
    const start = prev.current
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setV(Math.round(start + (target - start) * e))
      if (p < 1) raf.current = requestAnimationFrame(tick)
      else prev.current = target
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target, duration])

  return v
}
