'use client'

import { useEffect, useState } from 'react'
import { Poppins } from 'next/font/google'
import { Loader2 } from 'lucide-react'

const poppins = Poppins({ subsets: ['latin'], weight: ['700', '600'] })

const API      = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const PORTAL   = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID ?? ''

declare global {
  interface Window {
    hbspt?: {
      forms: {
        create: (opts: { region: string; portalId: string; formId: string; target: string }) => void
      }
    }
  }
}

export default function InscripcionPage() {
  const [formGuid, setFormGuid] = useState<string | null>(null)
  const [portalId, setPortalId] = useState<string>(PORTAL)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    fetch(`${API}/api/hubspot/formulario-activo`, {
      headers: { Authorization: 'Bearer public' },
    })
      .then(r => r.json())
      .then((data: any) => {
        const guid   = data?.data?.formGuid ?? null
        const portal = data?.data?.portalId ?? PORTAL
        setFormGuid(guid)
        setPortalId(portal)
        if (!guid) setError('El formulario de inscripción no está disponible en este momento.')
      })
      .catch(() => setError('No se pudo cargar el formulario. Intenta de nuevo.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!formGuid || !portalId) return

    const existing = document.getElementById('hs-embed-script')
    if (existing) {
      mountForm(portalId, formGuid)
      return
    }

    const script    = document.createElement('script')
    script.id       = 'hs-embed-script'
    script.src      = '//js.hsforms.net/forms/embed/v2.js'
    script.charset  = 'utf-8'
    script.onload   = () => mountForm(portalId, formGuid)
    document.head.appendChild(script)
  }, [formGuid, portalId])

  function mountForm(portal: string, guid: string) {
    if (!window.hbspt) return
    window.hbspt.forms.create({
      region:   'na1',
      portalId: portal,
      formId:   guid,
      target:   '#hubspot-form-container',
    })
  }

  return (
    <div className="min-h-dvh bg-[#21b9f7] flex flex-col">
      {/* Header */}
      <header className="w-full py-5 px-6 flex items-center justify-center">
        <div className="text-center">
          <p className={`${poppins.className} text-2xl font-bold text-white tracking-tight`}>
            Grupo 500
          </p>
          <p className="text-sm text-white/80 font-medium">Pre-ICFES · Formulario de Inscripción</p>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 flex flex-col items-center px-4 pb-10">
        <div className="w-full max-w-2xl">

          {/* Tarjeta */}
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">

            {loading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 text-[#1a7de0] animate-spin" />
                <p className="text-sm text-gray-500">Cargando formulario...</p>
              </div>
            )}

            {!loading && error && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
                <p className="text-sm font-semibold text-gray-700">{error}</p>
                <p className="text-xs text-gray-500">
                  Contáctanos por WhatsApp:{' '}
                  <a href="https://wa.me/573164134212" className="text-[#1a7de0] underline">
                    +57 316 413 4212
                  </a>
                </p>
              </div>
            )}

            {!loading && !error && (
              <>
                <div className="mb-6">
                  <h1 className={`${poppins.className} text-xl font-bold text-gray-800`}>
                    ¡Bienvenido a Grupo 500! 🎯
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Completa el formulario y queda oficialmente inscrito. Solo toma 5 minutos.
                  </p>
                </div>

                {/* HubSpot form se monta aquí */}
                <div id="hubspot-form-container" />
              </>
            )}
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-white/60 mt-6">
            Desarrollado por{' '}
            <span className="text-white/80 font-semibold">NexCode97</span>
          </p>
        </div>
      </main>
    </div>
  )
}
