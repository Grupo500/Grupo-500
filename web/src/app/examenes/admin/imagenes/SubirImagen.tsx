'use client'

import { useRef, useState } from 'react'
import { Loader2, Upload, CheckCircle2, ImageOff } from 'lucide-react'
import { getClientToken } from '@/lib/api'
import { guardarImagenPregunta } from './acciones'

type Props = {
  preguntaId: string
  numero: number | null
  area: string
  enunciado: string
  imagenUrlInicial: string | null
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function SubirImagen({ preguntaId, numero, area, enunciado, imagenUrlInicial }: Props) {
  const [url, setUrl]         = useState<string | null>(imagenUrlInicial)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendo(true); setError(null)

    try {
      // 1. Subir la imagen a Cloudinary vía el API (reutiliza /upload/imagen)
      const token = await getClientToken()
      const form = new FormData()
      form.append('file', archivo)
      const res = await fetch(`${API}/upload/imagen`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Error al subir')
      const nuevaUrl = json.data.url as string

      // 2. Guardar la URL en la pregunta
      const r = await guardarImagenPregunta(preguntaId, nuevaUrl)
      if (r?.error) throw new Error(r.error)

      setUrl(nuevaUrl + '?t=' + Date.now())
    } catch (err: any) {
      setError(err.message ?? 'Error al subir la imagen')
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function quitar() {
    setSubiendo(true); setError(null)
    try {
      const r = await guardarImagenPregunta(preguntaId, null)
      if (r?.error) throw new Error(r.error)
      setUrl(null)
    } catch (err: any) {
      setError(err.message ?? 'Error al quitar')
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className={`border rounded-xl p-4 ${url ? 'border-primary/40 bg-primary/5' : 'border-outline-variant bg-surface-lowest'}`}>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="bg-primary text-on-primary font-bold rounded-md px-2 py-0.5 text-sm tabular-nums">{numero ?? '—'}</span>
        <span className="text-xs font-medium text-on-surface-variant">{area}</span>
        {url && (
          <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-secondary bg-primary-container px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Con imagen
          </span>
        )}
      </div>

      <p className="text-sm text-on-surface-variant mb-3 leading-snug">
        {enunciado.length > 120 ? enunciado.slice(0, 120) + '…' : enunciado}
      </p>

      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`Pregunta ${numero}`} className="max-w-full max-h-48 rounded-lg border border-outline-variant mb-3" />
      )}

      <div className="flex items-center gap-2">
        <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border transition-colors ${subiendo ? 'opacity-60 pointer-events-none' : ''} bg-surface-high border-outline-variant text-primary hover:border-primary/40`}>
          {subiendo
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Upload className="w-4 h-4" />}
          {url ? 'Reemplazar' : 'Subir imagen'}
          <input ref={inputRef} type="file" accept="image/*" onChange={handleArchivo} className="hidden" disabled={subiendo} />
        </label>
        {url && (
          <button onClick={quitar} disabled={subiendo} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-on-surface-variant hover:text-error transition-colors">
            <ImageOff className="w-4 h-4" /> Quitar
          </button>
        )}
      </div>

      {error && <p className="text-xs text-error mt-2">{error}</p>}
    </div>
  )
}
