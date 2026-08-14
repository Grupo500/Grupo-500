'use client'

/**
 * La rúbrica, dibujada con el mouse o con el dedo.
 *
 * Se dibuja sobre un canvas y se sube como PNG a Cloudinary una sola vez: de
 * ahí en adelante el PDF la incrusta sin volver a pedirla. El canvas se
 * dimensiona en píxeles reales (no por CSS) porque de lo contrario el trazo
 * sale desplazado del cursor en pantallas con densidad distinta a 1.
 */

import { useEffect, useRef, useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import { getClientToken } from '@/lib/api'

export function CampoFirma({ valor, onCambio }: {
  valor: string | null
  onCambio: (url: string | null) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dibujando = useRef(false)
  const huboTrazo = useRef(false)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const [redibujando, setRedibujando] = useState(!valor)

  useEffect(() => {
    if (!redibujando) return
    const canvas = canvasRef.current
    if (!canvas) return
    const escala = window.devicePixelRatio || 1
    const caja = canvas.getBoundingClientRect()
    canvas.width  = caja.width  * escala
    canvas.height = caja.height * escala
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(escala, escala)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0f172a'
  }, [redibujando])

  const puntoDe = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const caja = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - caja.left, y: e.clientY - caja.top }
  }

  const empezar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = puntoDe(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    dibujando.current = true
  }

  const trazar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = puntoDe(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    huboTrazo.current = true
  }

  const soltar = () => { dibujando.current = false }

  const limpiar = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    huboTrazo.current = false
    setError('')
  }

  const guardar = async () => {
    const canvas = canvasRef.current
    if (!canvas || !huboTrazo.current) { setError('Dibuja tu firma primero'); return }
    setSubiendo(true)
    setError('')
    try {
      const blob: Blob = await new Promise((ok, mal) =>
        canvas.toBlob(b => (b ? ok(b) : mal(new Error('No se pudo leer la firma'))), 'image/png'),
      )
      const token = await getClientToken()
      const form = new FormData()
      form.append('file', new File([blob], 'firma.png', { type: 'image/png' }))
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/firma`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      if (!res.ok) throw new Error('No se pudo subir la firma')
      const json = await res.json()
      onCambio(json.data.url as string)
      setRedibujando(false)
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo guardar la firma')
    } finally {
      setSubiendo(false)
    }
  }

  if (valor && !redibujando) {
    return (
      <div>
        <div className="flex h-24 items-center justify-center rounded-xl border border-outline-variant bg-surface-lowest">
          <img src={valor} alt="Tu firma" className="max-h-[80%] max-w-[80%] object-contain" />
        </div>
        <button
          type="button"
          onClick={() => { setRedibujando(true); onCambio(null) }}
          className="mt-2 cursor-pointer text-[11px] font-semibold text-primary hover:underline"
        >
          Volver a firmar
        </button>
      </div>
    )
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={empezar}
        onPointerMove={trazar}
        onPointerUp={soltar}
        onPointerLeave={soltar}
        // Sin esto, arrastrar el dedo hace scroll en vez de dibujar.
        style={{ touchAction: 'none' }}
        className="h-24 w-full cursor-crosshair rounded-xl border border-dashed border-outline bg-surface-lowest"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={subiendo}
          className="cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {subiendo ? <Loader2 className="mr-1 inline size-3 animate-spin" /> : null}
          Guardar firma
        </button>
        <button
          type="button"
          onClick={limpiar}
          className="flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-on-surface-variant hover:text-on-surface"
        >
          <RotateCcw className="size-3" /> Borrar
        </button>
        {error && <span className="text-[11px] text-[var(--error)]">{error}</span>}
      </div>
    </div>
  )
}
