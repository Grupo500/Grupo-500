'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { X, Check, XCircle, Loader2 } from 'lucide-react'
import { materiaInfo } from '@/lib/britoMaterias'
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
  leccionId, leccionTitulo, leccionMateria, preguntas, corazonesIniciales, plan,
}: {
  leccionId: string
  leccionTitulo: string
  leccionMateria: string
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

  const materia = materiaInfo(leccionMateria)
  const pregunta = preguntas[indice]
  const progreso = ((indice + (feedback ? 1 : 0)) / preguntas.length) * 100
  // Con un contexto largo la lectura se parte en dos columnas en escritorio,
  // así el texto no empuja las opciones fuera de la pantalla.
  const dosColumnas = !!pregunta.contexto && pregunta.contexto.length > 320

  function elegir(letra: string) {
    if (feedback || pending) return
    setSeleccion(letra)
  }

  function confirmar() {
    if (!seleccion || feedback || pending) return
    startTransition(async () => {
      const res = await responderPregunta(pregunta.id, seleccion)
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
      <main className="min-h-dvh flex flex-col items-center justify-center px-4 text-center animate-fade-in" style={{ background: '#EEF2F7' }}>
        <div className="animate-card-enter flex flex-col items-center">
          <Image src="/brito/brito-mascota.png" alt="Brito" width={96} height={96} className="mb-4 h-24 w-24 object-contain grayscale" />
          <h1 className="mb-2 text-xl font-bold text-[#2B2B28]">Te quedaste sin corazones</h1>
          <p className="mb-6 max-w-xs text-sm font-medium text-[#6b6a63]">
            Se regeneran 1 cada 4 horas. Vuelve pronto para seguir practicando.
          </p>
          <Link
            href="/brito/mapa"
            className="rounded-full px-6 py-3 text-sm font-bold text-white"
            style={{ background: '#1E5FA8', boxShadow: '0 4px 0 #154577' }}
          >
            Volver al mapa
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col animate-fade-in" style={{ background: '#EEF2F7', color: '#2B2B28' }}>
      {/* Cabecera con progreso */}
      <header className="sticky top-0 z-10 border-b border-[#E1E6EE] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/brito/mapa" title="Salir de la lección" className="shrink-0 text-[#9a998f] transition-colors hover:text-[#2B2B28]">
            <X className="h-5 w-5" />
          </Link>

          <img src={materia.icono} alt="" className="hidden h-7 w-7 shrink-0 object-contain sm:block" />
          <div className="hidden min-w-0 shrink-0 sm:block" style={{ width: 150 }}>
            <div className="truncate text-[12.5px] font-semibold leading-tight" style={{ color: materia.color }}>
              {leccionMateria}
            </div>
            <div className="truncate text-[11px] font-normal text-[#8a897f]">{leccionTitulo}</div>
          </div>

          <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#E1E6EE]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progreso}%`, background: materia.color }}
            />
          </div>

          <span className="flex shrink-0 items-center gap-1.5 text-sm font-bold">
            <img src="/brito/icons/vidas.png" alt="" className="h-5 w-5 object-contain" />
            {plan === 'PREMIUM' ? '∞' : corazones}
          </span>
        </div>
      </header>

      {/* Contenido */}
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 pb-40 pt-7">
        <p className="mb-4 text-[11.5px] font-semibold text-[#a5a49b]">
          Pregunta {indice + 1} de {preguntas.length}
        </p>

        <div key={pregunta.id} className={`animate-card-enter gap-6 ${dosColumnas ? 'lg:grid lg:grid-cols-2 lg:items-start' : ''}`}>
          {/* Columna de lectura */}
          {(pregunta.contexto || pregunta.imagenUrl) && (
            <div className={dosColumnas ? 'lg:sticky lg:top-24' : ''}>
              {pregunta.contexto && (
                <div
                  className={`mb-4 rounded-2xl bg-white p-5 text-[14.5px] font-normal leading-relaxed text-[#4a4941] ${dosColumnas ? 'lg:mb-0 lg:max-h-[calc(100dvh-260px)] lg:overflow-y-auto' : 'max-h-56 overflow-y-auto'}`}
                  style={{ boxShadow: '0 2px 10px rgba(40,30,10,0.06)' }}
                >
                  {pregunta.contexto}
                </div>
              )}
              {pregunta.imagenUrl && (
                <div className="mb-4 overflow-hidden rounded-2xl bg-white" style={{ boxShadow: '0 2px 10px rgba(40,30,10,0.06)' }}>
                  <Image src={pregunta.imagenUrl} alt="" width={600} height={400} className="h-auto w-full object-contain" />
                </div>
              )}
            </div>
          )}

          {/* Columna de respuesta */}
          <div>
            <h2 className="mb-5 text-[17px] font-semibold leading-relaxed text-[#2B2B28]">{pregunta.enunciado}</h2>

            <div className="space-y-3">
              {pregunta.opciones.map((op, i) => {
                const esSeleccionada = seleccion === op.letra
                const esCorrectaMostrada = feedback && op.letra === feedback.letraCorrecta
                const esIncorrectaSeleccionada = feedback && esSeleccionada && !feedback.correcta

                let estilo: React.CSSProperties = {
                  background: '#FFFFFF',
                  boxShadow: '0 3px 0 #DCE1E9',
                  color: '#2B2B28',
                }
                if (esCorrectaMostrada) {
                  estilo = { background: '#E4F8EC', boxShadow: '0 3px 0 #159354', color: '#12704A' }
                } else if (esIncorrectaSeleccionada) {
                  estilo = { background: '#FDE9E9', boxShadow: '0 3px 0 #C23B3B', color: '#A32F2F' }
                } else if (!feedback && esSeleccionada) {
                  estilo = { background: '#FFFFFF', boxShadow: `0 3px 0 ${materia.oscuro}`, color: materia.oscuro }
                }

                return (
                  // El contenedor externo anima la entrada; el botón conserva su
                  // propio transform de hover. Si se juntan, el transform final
                  // de la animación (fill both) pisa el hover.
                  <div key={op.letra} className="animate-card-enter" style={{ animationDelay: `${60 + i * 55}ms` }}>
                    <button
                      disabled={!!feedback || pending}
                      onClick={() => elegir(op.letra)}
                      className="flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left text-[15px] font-medium transition-all disabled:cursor-default enabled:hover:-translate-y-[2px]"
                      style={estilo}
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold"
                        style={{ borderColor: 'currentColor' }}
                      >
                        {op.letra}
                      </span>
                      <span className="flex-1">{op.texto}</span>
                      {esCorrectaMostrada && <Check className="h-4 w-4 shrink-0" />}
                      {esIncorrectaSeleccionada && <XCircle className="h-4 w-4 shrink-0" />}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Barra inferior fija: confirmar o feedback */}
      {!feedback && seleccion && (
        <div className="fixed inset-x-0 bottom-0 border-t border-[#E1E6EE] bg-white animate-slide-up">
          <div className="mx-auto flex max-w-5xl justify-end px-4 py-4">
            <button
              onClick={confirmar}
              disabled={pending}
              className="flex items-center gap-2 rounded-full px-8 py-3 text-sm font-bold text-white transition-all disabled:opacity-60 enabled:active:translate-y-[2px]"
              style={{ background: materia.color, boxShadow: `0 4px 0 ${materia.oscuro}` }}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className="fixed inset-x-0 bottom-0 border-t animate-slide-up"
          style={
            feedback.correcta
              ? { background: '#E4F8EC', borderColor: '#B9E9CD' }
              : { background: '#FDE9E9', borderColor: '#F3C6C6' }
          }
        >
          <div className="mx-auto flex max-w-5xl items-center gap-3.5 px-4 py-4">
            <Image src="/brito/brito-mascota.png" alt="Brito" width={48} height={48} className={`h-12 w-12 shrink-0 object-contain ${feedback.correcta ? '' : 'grayscale'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold" style={{ color: feedback.correcta ? '#12704A' : '#A32F2F' }}>
                {feedback.correcta ? '¡Correcto!' : 'Incorrecto'}
              </p>
              {feedback.explicacion && (
                <p className="mt-0.5 line-clamp-2 text-[12.5px] font-normal text-[#57564f]">{feedback.explicacion}</p>
              )}
            </div>
            <button
              onClick={siguiente}
              disabled={pending}
              className="flex shrink-0 items-center gap-2 rounded-full px-7 py-3 text-sm font-bold text-white transition-all disabled:opacity-60 enabled:active:translate-y-[2px]"
              style={
                feedback.correcta
                  ? { background: '#22C56E', boxShadow: '0 4px 0 #159354' }
                  : { background: '#D94A4A', boxShadow: '0 4px 0 #A32F2F' }
              }
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {indice + 1 >= preguntas.length ? 'Terminar' : 'Continuar'}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
