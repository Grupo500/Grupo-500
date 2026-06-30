'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save } from 'lucide-react'
import { editarPregunta } from './acciones'

type Inicial = {
  enunciado: string
  contexto: string
  opcionA: string
  opcionB: string
  opcionC: string
  opcionD: string
  opcionE: string
  opcionF: string
  opcionG: string
  opcionH: string
  correcta: string
  area: string
  explicacion: string
}

const AREAS = ['Lectura Crítica', 'Matemáticas', 'Sociales y Ciudadanas', 'Ciencias Naturales', 'Inglés']

export default function FormEditarPregunta({ preguntaId, inicial }: { preguntaId: string; inicial: Inicial }) {
  const [form, setForm]   = useState(inicial)
  const [error, setError] = useState<string | null>(null)
  const [pending, start]  = useTransition()
  const router = useRouter()

  function set(key: keyof Inicial, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function guardar() {
    if (!form.enunciado.trim()) { setError('El enunciado no puede estar vacío'); return }
    if (!form.correcta.match(/^[A-H]$/i)) { setError('La correcta debe ser A–H'); return }
    setError(null)
    start(async () => {
      const r = await editarPregunta(preguntaId, {
        enunciado:   form.enunciado,
        contexto:    form.contexto    || null,
        opcionA:     form.opcionA     || null,
        opcionB:     form.opcionB     || null,
        opcionC:     form.opcionC     || null,
        opcionD:     form.opcionD     || null,
        opcionE:     form.opcionE     || null,
        opcionF:     form.opcionF     || null,
        opcionG:     form.opcionG     || null,
        opcionH:     form.opcionH     || null,
        correcta:    form.correcta,
        area:        form.area        || null,
        explicacion: form.explicacion || null,
      })
      if (r?.error) { setError(r.error); return }
      if (r?.redirectTo) router.push(r.redirectTo)
    })
  }

  const campo = (label: string, key: keyof Inicial, placeholder = '') => (
    <div>
      <label className="block text-xs font-semibold text-on-surface-variant mb-1">{label}</label>
      <input
        value={form[key]}
        onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-outline-variant bg-surface-lowest px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors"
      />
    </div>
  )

  return (
    <div className="bg-surface-lowest border border-outline-variant rounded-2xl p-6 flex flex-col gap-5">

      {/* Área */}
      <div>
        <label className="block text-xs font-semibold text-on-surface-variant mb-1">Área</label>
        <select
          value={form.area}
          onChange={e => set('area', e.target.value)}
          className="w-full rounded-lg border border-outline-variant bg-surface-lowest px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors"
        >
          <option value="">Sin área</option>
          {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Contexto */}
      <div>
        <label className="block text-xs font-semibold text-on-surface-variant mb-1">Contexto / texto de lectura (opcional)</label>
        <textarea
          value={form.contexto}
          onChange={e => set('contexto', e.target.value)}
          rows={4}
          placeholder="Texto introductorio que aparece antes del enunciado..."
          className="w-full rounded-lg border border-outline-variant bg-surface-lowest px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors resize-y"
        />
      </div>

      {/* Enunciado */}
      <div>
        <label className="block text-xs font-semibold text-on-surface-variant mb-1">Enunciado <span className="text-error">*</span></label>
        <textarea
          value={form.enunciado}
          onChange={e => set('enunciado', e.target.value)}
          rows={4}
          placeholder="Texto de la pregunta..."
          className="w-full rounded-lg border border-outline-variant bg-surface-lowest px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors resize-y"
        />
      </div>

      {/* Opciones A-D */}
      <div className="grid sm:grid-cols-2 gap-3">
        {campo('Opción A', 'opcionA')}
        {campo('Opción B', 'opcionB')}
        {campo('Opción C', 'opcionC')}
        {campo('Opción D', 'opcionD')}
      </div>

      {/* Opciones E-H (solo para preguntas de matching) */}
      <div>
        <label className="block text-xs font-semibold text-on-surface-variant mb-1">
          Opciones E–H <span className="text-on-surface-variant font-normal">(solo para preguntas de matching)</span>
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          {campo('Opción E', 'opcionE')}
          {campo('Opción F', 'opcionF')}
          {campo('Opción G', 'opcionG')}
          {campo('Opción H', 'opcionH')}
        </div>
      </div>

      {/* Correcta */}
      <div>
        <label className="block text-xs font-semibold text-on-surface-variant mb-2">Respuesta correcta <span className="text-error">*</span></label>
        <div className="flex flex-wrap gap-2">
          {['A','B','C','D','E','F','G','H'].map(l => (
            <button
              key={l}
              type="button"
              onClick={() => set('correcta', l)}
              className={`w-10 h-10 rounded-lg font-bold text-sm transition-colors ${
                form.correcta.toUpperCase() === l
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-high text-on-surface-variant hover:text-primary border border-outline-variant'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Explicación */}
      <div>
        <label className="block text-xs font-semibold text-on-surface-variant mb-1">Explicación (opcional)</label>
        <textarea
          value={form.explicacion}
          onChange={e => set('explicacion', e.target.value)}
          rows={3}
          placeholder="Por qué esa es la respuesta correcta..."
          className="w-full rounded-lg border border-outline-variant bg-surface-lowest px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors resize-y"
        />
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        onClick={guardar}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-sm transition-colors hover:opacity-90 active:scale-[0.97] disabled:opacity-60"
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Guardar cambios
      </button>
    </div>
  )
}
