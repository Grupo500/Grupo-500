'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClientToken } from '@/lib/api'
import { Loader2, Save, ImagePlus, X } from 'lucide-react'
import { crearPregunta } from '../../acciones'

const LETRAS = ['A', 'B', 'C', 'D'] as const

export function NuevaPreguntaForm({ materias }: { materias: string[] }) {
  const router = useRouter()
  const [area, setArea] = useState(materias[0])
  const [enunciado, setEnunciado] = useState('')
  const [contexto, setContexto] = useState('')
  const [opciones, setOpciones] = useState({ A: '', B: '', C: '', D: '' })
  const [correcta, setCorrecta] = useState<'A' | 'B' | 'C' | 'D'>('A')
  const [explicacion, setExplicacion] = useState('')
  const [imagenUrl, setImagenUrl] = useState<string | null>(null)
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function handleSubirImagen(file: File) {
    setSubiendoImagen(true)
    setError('')
    try {
      const token = await getClientToken()
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/imagen`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!res.ok) throw new Error('Error al subir la imagen')
      const json = await res.json()
      setImagenUrl(json.data.url as string)
    } catch (e: any) {
      setError(e?.message ?? 'Error al subir la imagen')
    } finally {
      setSubiendoImagen(false)
    }
  }

  async function handleGuardar() {
    setGuardando(true)
    setError('')
    const res = await crearPregunta({
      area,
      enunciado,
      contexto,
      opcionA: opciones.A,
      opcionB: opciones.B,
      opcionC: opciones.C,
      opcionD: opciones.D,
      correcta,
      explicacion,
      imagenUrl,
    })
    setGuardando(false)
    if ('error' in res) {
      setError(res.error!)
      return
    }
    router.push('/brito-admin')
  }

  const campo = 'w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-lowest text-sm text-on-surface outline-none focus:border-primary transition-colors'
  const etiqueta = 'text-xs font-medium text-on-surface-variant block mb-1.5'

  return (
    <div className="card p-5 space-y-4">
      <div>
        <label className={etiqueta}>Materia</label>
        <select value={area} onChange={e => setArea(e.target.value)} className={campo}>
          {materias.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div>
        <label className={etiqueta}>Contexto (opcional — texto o caso que acompaña la pregunta)</label>
        <textarea value={contexto} onChange={e => setContexto(e.target.value)} rows={3} className={campo} />
      </div>

      <div>
        <label className={etiqueta}>Enunciado</label>
        <textarea value={enunciado} onChange={e => setEnunciado(e.target.value)} rows={2} className={campo} />
      </div>

      <div>
        <label className={etiqueta}>Imagen (opcional)</label>
        {imagenUrl ? (
          <div className="relative inline-block">
            <img src={imagenUrl} alt="" className="max-h-40 rounded-lg border border-outline-variant" />
            <button
              onClick={() => setImagenUrl(null)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant text-sm text-on-surface-variant hover:text-on-surface cursor-pointer">
            {subiendoImagen ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            Subir imagen
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={subiendoImagen}
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleSubirImagen(f)
                e.target.value = ''
              }}
            />
          </label>
        )}
      </div>

      <div className="space-y-2.5">
        <label className={etiqueta}>Opciones — marca cuál es la correcta</label>
        {LETRAS.map(letra => (
          <div key={letra} className="flex items-center gap-2">
            <button
              onClick={() => setCorrecta(letra)}
              title="Marcar como correcta"
              className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                correcta === letra ? 'bg-secondary text-white border-secondary' : 'border-outline-variant text-on-surface-variant hover:border-secondary'
              }`}
            >
              {letra}
            </button>
            <input
              value={opciones[letra]}
              onChange={e => setOpciones(o => ({ ...o, [letra]: e.target.value }))}
              placeholder={`Opción ${letra}`}
              className={campo}
            />
          </div>
        ))}
      </div>

      <div>
        <label className={etiqueta}>Explicación (opcional — se muestra tras responder)</label>
        <textarea value={explicacion} onChange={e => setExplicacion(e.target.value)} rows={2} className={campo} />
      </div>

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

      <button
        onClick={handleGuardar}
        disabled={guardando || subiendoImagen || !enunciado.trim() || !opciones.A.trim() || !opciones.B.trim() || !opciones.C.trim() || !opciones.D.trim()}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Guardar pregunta
      </button>
    </div>
  )
}
