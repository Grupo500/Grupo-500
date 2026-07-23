'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Minus, Loader2 } from 'lucide-react'
import { buscarPreguntas, agregarPreguntaALeccion, quitarPreguntaDeLeccion } from '../acciones'

interface Pregunta { id: string; area: string | null; numero: number | null; enunciado: string }

export function GestorPreguntas({
  leccionId, materiaDefault, materias, preguntasActuales,
}: {
  leccionId: string
  materiaDefault: string
  materias: string[]
  preguntasActuales: Pregunta[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [area, setArea] = useState(materiaDefault)
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<Pregunta[]>([])
  const [buscando, setBuscando] = useState(false)

  const actualesIds = new Set(preguntasActuales.map(p => p.id))

  async function buscar() {
    setBuscando(true)
    const r = await buscarPreguntas({ area, texto })
    setResultados(r)
    setBuscando(false)
  }

  function agregar(preguntaId: string) {
    startTransition(async () => {
      await agregarPreguntaALeccion(leccionId, preguntaId)
      router.refresh()
    })
  }

  function quitar(preguntaId: string) {
    startTransition(async () => {
      await quitarPreguntaDeLeccion(leccionId, preguntaId)
      router.refresh()
    })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Preguntas ya en la lección */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          En la lección ({preguntasActuales.length})
        </h2>
        {preguntasActuales.length === 0 && (
          <p className="text-sm text-on-surface-variant/70 italic">Sin preguntas todavía — búscalas a la derecha.</p>
        )}
        {preguntasActuales.map(p => (
          <div key={p.id} className="flex items-start gap-2 bg-surface-lowest border border-outline-variant rounded-lg p-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-on-surface-variant mb-0.5">{p.area} {p.numero ? `· #${p.numero}` : ''}</p>
              <p className="text-sm text-on-surface line-clamp-2">{p.enunciado}</p>
            </div>
            <button
              disabled={pending}
              onClick={() => quitar(p.id)}
              className="shrink-0 w-7 h-7 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Buscador del banco */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Banco de preguntas</h2>
        <div className="flex gap-2">
          <select
            value={area}
            onChange={e => setArea(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface-high border border-outline-variant text-sm text-on-surface"
          >
            {materias.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscar()}
            placeholder="Buscar por texto..."
            className="flex-1 px-3 py-2 rounded-lg bg-surface-high border border-outline-variant text-sm text-on-surface"
          />
          <button
            onClick={buscar}
            disabled={buscando}
            className="shrink-0 w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center hover:opacity-90 disabled:opacity-50"
          >
            {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </div>

        <div className="space-y-2 max-h-[520px] overflow-y-auto">
          {resultados.map(p => {
            const yaAgregada = actualesIds.has(p.id)
            return (
              <div key={p.id} className="flex items-start gap-2 bg-surface-lowest border border-outline-variant rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-on-surface-variant mb-0.5">{p.area} {p.numero ? `· #${p.numero}` : ''}</p>
                  <p className="text-sm text-on-surface line-clamp-2">{p.enunciado}</p>
                </div>
                <button
                  disabled={pending || yaAgregada}
                  onClick={() => agregar(p.id)}
                  className="shrink-0 w-7 h-7 rounded-full bg-secondary/10 text-secondary flex items-center justify-center hover:bg-secondary/20 transition-colors disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
