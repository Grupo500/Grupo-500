'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { X, Heart, Check, XCircle, Loader2 } from 'lucide-react'
import { responderPregunta, finalizarLeccion } from '../../acciones'

interface Opcion { letra: string; texto: string }
interface Pregunta {
  id: string
  contexto: string | null
  enunciado: string
  imagenUrl: string | null
  opciones: Opcion[]
}

export function TomarLeccion({
  leccionId, leccionTitulo, preguntas, corazonesIniciales, plan,
}: {
  leccionId: string
  leccionTitulo: string
  preguntas: Pregunta[]
  corazonesIniciales: number
  plan: 'FREE' | 'PREMIUM'
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [indice, setIndice] = useState(0)
  const [correctas, setCorrectas] = useState(0)
  const [corazones, setCorazones] = useState(corazonesIniciales)
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ correcta: boolean; letraCorrecta: string; explicacion: string | null } | null>(null)
  const [sinCorazones, setSinCorazones] = useState(false)

  const pregunta = preguntas[indice]
  const progreso = ((indice + (feedback ? 1 : 0)) / preguntas.length) * 100

  function elegir(letra: string) {
    if (feedback || pending) return
    setSeleccion(letra)
    startTransition(async () => {
      const res = await responderPregunta(pregunta.id, letra)
      if ('error' in res) {
        if (res.error === 'sin_corazones') setSinCorazones(true)
        return
      }
      if (!res.correcta && plan !== 'PREMIUM') setCorazones(c => Math.max(0, c - 1))
      if (res.correcta) setCorrectas(c => c + 1)
      setFeedback({ correcta: res.correcta, letraCorrecta: res.letraCorrecta, explicacion: res.explicacion })
    })
  }

  function siguiente() {
    if (plan !== 'PREMIUM' && corazones <= 0) {
      setSinCorazones(true)
      return
    }
    if (indice + 1 >= preguntas.length) {
      startTransition(async () => {
        const res = await finalizarLeccion(leccionId, correctas, preguntas.length)
        if ('error' in res) return
        router.push(`/brito/leccion/${leccionId}/resultado?correctas=${correctas}&total=${preguntas.length}&xp=${res.xpGanado}&racha=${res.rachaActual}`)
      })
      return
    }
    setIndice(i => i + 1)
    setSeleccion(null)
    setFeedback(null)
  }

  if (sinCorazones) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center px-4 text-center" style={{ background: 'linear-gradient(180deg, #003060 0%, #0b1f3a 100%)' }}>
        <div className="w-24 h-24 rounded-full bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden mb-4">
          <Image src="/brito/brito-hero.jpg" alt="Brito" width={96} height={96} className="object-cover w-full h-full grayscale" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Te quedaste sin corazones</h1>
        <p className="text-sm text-white/70 mb-6 max-w-xs">Se regeneran 1 cada 4 horas. Vuelve pronto para seguir practicando.</p>
        <Link href="/brito/mapa" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ffb703] to-[#fb8500] text-white font-semibold text-sm">
          Volver al mapa
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-dvh flex flex-col" style={{ background: 'linear-gradient(180deg, #003060 0%, #0b1f3a 100%)' }}>
      {/* Header con progreso */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Link href="/brito/mapa" className="text-white/60 hover:text-white transition-colors shrink-0">
          <X className="w-5 h-5" />
        </Link>
        <div className="flex-1 h-2.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#ffb703] to-[#fb8500] transition-all duration-300" style={{ width: `${progreso}%` }} />
        </div>
        <span className="flex items-center gap-1 text-white text-sm font-semibold shrink-0">
          <Heart className="w-4 h-4 text-red-400" /> {plan === 'PREMIUM' ? '∞' : corazones}
        </span>
      </div>

      <div className="flex-1 max-w-2xl w-full mx-auto px-4 md:px-0 py-8 flex flex-col">
        <p className="text-xs text-white/50 font-medium mb-3">{leccionTitulo} · {indice + 1}/{preguntas.length}</p>

        {pregunta.contexto && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-3 text-sm text-white/80 max-h-40 overflow-y-auto">
            {pregunta.contexto}
          </div>
        )}
        {pregunta.imagenUrl && (
          <div className="mb-3 rounded-xl overflow-hidden border border-white/10">
            <Image src={pregunta.imagenUrl} alt="" width={600} height={400} className="w-full h-auto object-contain bg-white" />
          </div>
        )}

        <h2 className="text-white font-semibold text-xl leading-snug mb-6">{pregunta.enunciado}</h2>

        <div className="space-y-2.5 flex-1">
          {pregunta.opciones.map(op => {
            const esSeleccionada = seleccion === op.letra
            const esCorrectaMostrada = feedback && op.letra === feedback.letraCorrecta
            const esIncorrectaSeleccionada = feedback && esSeleccionada && !feedback.correcta

            let estilo = 'border-white/15 bg-white/5 text-white/90 hover:bg-white/10'
            if (esCorrectaMostrada) estilo = 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
            else if (esIncorrectaSeleccionada) estilo = 'border-red-400 bg-red-500/20 text-red-100'
            else if (feedback && esSeleccionada) estilo = 'border-white/30 bg-white/10 text-white'

            return (
              <button
                key={op.letra}
                disabled={!!feedback || pending}
                onClick={() => elegir(op.letra)}
                className={`w-full text-left px-5 py-4 rounded-xl border text-[15px] font-medium transition-all flex items-center gap-3 ${estilo} disabled:cursor-default`}
              >
                <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs font-bold shrink-0">
                  {op.letra}
                </span>
                <span className="flex-1">{op.texto}</span>
                {esCorrectaMostrada && <Check className="w-4 h-4 shrink-0" />}
                {esIncorrectaSeleccionada && <XCircle className="w-4 h-4 shrink-0" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Barra inferior de feedback */}
      {feedback && (
        <div className={`px-4 py-4 border-t ${feedback.correcta ? 'bg-emerald-950/60 border-emerald-500/30' : 'bg-red-950/60 border-red-500/30'}`}>
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="w-11 h-11 rounded-full overflow-hidden border border-white/20 shrink-0">
              <Image src="/brito/brito-hero.jpg" alt="Brito" width={44} height={44} className="object-cover w-full h-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${feedback.correcta ? 'text-emerald-300' : 'text-red-300'}`}>
                {feedback.correcta ? '¡Correcto!' : 'Incorrecto'}
              </p>
              {feedback.explicacion && (
                <p className="text-xs text-white/60 mt-0.5 line-clamp-2">{feedback.explicacion}</p>
              )}
            </div>
            <button
              onClick={siguiente}
              disabled={pending}
              className="shrink-0 px-4 py-2 rounded-xl bg-white text-[#001d3d] font-semibold text-sm flex items-center gap-2 disabled:opacity-60"
            >
              {pending && <Loader2 className="w-4 h-4 animate-spin" />}
              {indice + 1 >= preguntas.length ? 'Terminar' : 'Continuar'}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
