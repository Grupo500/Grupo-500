'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Poppins } from 'next/font/google'
import { Calendar, Users, ChevronRight, Loader2, ArrowLeft } from 'lucide-react'
import { Hero3D } from '@/components/hero/Hero3D'

const poppins = Poppins({ subsets: ['latin'], weight: ['400', '600', '700', '800'] })

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

interface Calendario {
  id: string
  nombre: string
  descripcion?: string
  precioGeneral: number
  preciosPromo: number[]
  calendario: string
  fechaInicio?: string
  fechaFin?: string
  inscritos: number
  cuposRestantes: number | null
}

function formatFecha(iso?: string) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function InscripcionHub() {
  const [calendarios, setCalendarios] = useState<Calendario[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')

  useEffect(() => {
    fetch(`${API}/inscripcion/calendarios-activos`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setCalendarios(d.data)
        else setError('No hay calendarios disponibles en este momento.')
      })
      .catch(() => setError('No se pudieron cargar los calendarios.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-dvh bg-[#eef6ff]">
      {/* Hero 3D — animado con Three.js/GSAP, con fallback estático y respeto a prefers-reduced-motion */}
      <Hero3D className="h-[380px] sm:h-[440px]">
        <header className="w-full pt-6 pb-4 px-5 flex items-center gap-3">
          <Link href="/" className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <div>
            <p className={`${poppins.className} text-white font-bold text-base`}>Inscripciones</p>
            <p className="text-white/70 text-xs">Selecciona tu calendario</p>
          </div>
        </header>

        <div className="flex flex-col items-center justify-center text-center px-6 h-[calc(100%-88px)]">
          <p data-hero-anim className={`${poppins.className} text-white font-extrabold text-3xl sm:text-4xl mb-3 drop-shadow-sm`}>
            Prepárate para tu ICFES
          </p>
          <p data-hero-anim className="text-white/85 text-sm sm:text-base max-w-md">
            Elige tu calendario con Grupo 500 y completa tu inscripción en minutos.
          </p>
        </div>
      </Hero3D>

      <main className="px-4 pt-6 pb-10">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-[#2094ff] animate-spin" />
            <p className="text-slate-500 text-sm">Cargando calendarios...</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
            <p className="text-slate-600 text-sm mb-4">{error}</p>
            <a
              href="https://wa.me/573168819037"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#25D366] text-white text-sm font-bold"
            >
              Contáctanos por WhatsApp
            </a>
          </div>
        )}

        {!loading && !error && calendarios.length === 0 && (
          <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
            <p className={`${poppins.className} text-slate-700 font-bold text-lg mb-2`}>
              Sin calendarios activos
            </p>
            <p className="text-slate-500 text-sm mb-5">
              En este momento no hay inscripciones abiertas. Contáctanos para más información.
            </p>
            <a
              href="https://wa.me/573168819037"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#25D366] text-white text-sm font-bold"
            >
              Escribir por WhatsApp
            </a>
          </div>
        )}

        <div className="space-y-4">
          {calendarios.map((cal) => (
            <div key={cal.id} className="bg-white rounded-3xl shadow-xl overflow-hidden">
              {/* Badge calendario */}
              <div className="bg-gradient-to-r from-[#21b9f7] to-[#1a7de0] px-5 py-3 flex items-center justify-between">
                <span className={`${poppins.className} text-white font-bold text-sm`}>
                  Calendario {cal.calendario}
                </span>
                {cal.cuposRestantes != null && cal.cuposRestantes > 0 && (
                  <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    {cal.cuposRestantes} cupos disponibles
                  </span>
                )}
                {cal.cuposRestantes != null && cal.cuposRestantes <= 0 && (
                  <span className="bg-red-500/80 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Cupos agotados
                  </span>
                )}
              </div>

              <div className="p-5">
                <h3 className={`${poppins.className} text-slate-800 font-bold text-lg mb-1`}>
                  {cal.nombre}
                </h3>
                {cal.descripcion && (
                  <p className="text-slate-500 text-sm mb-3">{cal.descripcion}</p>
                )}

                {/* Fechas */}
                {(cal.fechaInicio || cal.fechaFin) && (
                  <div className="flex items-center gap-2 text-slate-500 text-xs mb-3">
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span>
                      {cal.fechaInicio && `Inicia: ${formatFecha(cal.fechaInicio)}`}
                      {cal.fechaInicio && cal.fechaFin && ' · '}
                      {cal.fechaFin && `Finaliza: ${formatFecha(cal.fechaFin)}`}
                    </span>
                  </div>
                )}

                {/* Inscritos */}
                <div className="flex items-center gap-2 text-slate-500 text-xs mb-4">
                  <Users className="w-4 h-4 shrink-0" />
                  <span>{cal.inscritos.toLocaleString('es-CO')} estudiantes inscritos</span>
                </div>

                {/* Precios */}
                <div className="bg-slate-50 rounded-2xl p-4 mb-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">Precio general</span>
                    <span className={`${poppins.className} text-slate-800 font-bold text-base`}>
                      ${cal.precioGeneral.toLocaleString('es-CO')}
                    </span>
                  </div>
                  {cal.preciosPromo.map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs text-emerald-600 font-medium">Precio promoción</span>
                      <span className={`${poppins.className} text-emerald-600 font-bold text-base`}>
                        ${p.toLocaleString('es-CO')}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                {(cal.cuposRestantes == null || cal.cuposRestantes > 0) ? (
                  <Link
                    href={`/inscripcion/${cal.id}`}
                    className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl
                      bg-[#F97316] text-white font-bold text-sm shadow-lg
                      hover:shadow-xl hover:scale-[1.01] transition-all active:scale-100"
                  >
                    ¡Quiero inscribirme!
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <a
                    href="https://wa.me/573168819037"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl
                      bg-slate-200 text-slate-600 font-bold text-sm"
                  >
                    Consultar lista de espera
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      <p className="text-center text-white/40 text-xs pb-6">
        Desarrollado por <span className="text-white/60 font-semibold">NexCode97</span>
      </p>
    </div>
  )
}
