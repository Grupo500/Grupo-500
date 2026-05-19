'use client'

import { useEffect, useState } from 'react'
import { Download, Share, X, Monitor, Smartphone } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type InstallState = 'idle' | 'available' | 'ios' | 'installed'

export function PWAInstallButton() {
  const [state, setState] = useState<InstallState>('idle')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    // Ya instalada como PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setState('installed')
      return
    }

    // Detectar iOS Safari (no soporta beforeinstallprompt)
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    if (isIOS && isSafari) {
      setState('ios')
      return
    }

    // Chrome / Edge / Android — capturar el evento
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setState('available')
    }

    window.addEventListener('beforeinstallprompt', handler)

    window.addEventListener('appinstalled', () => {
      setState('installed')
      setDeferredPrompt(null)
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setState('installed')
    } finally {
      setInstalling(false)
      setDeferredPrompt(null)
    }
  }

  if (state === 'installed') return null
  if (state === 'idle') return null

  // ── iOS: instrucciones manuales ──────────────────────────────────────────
  if (state === 'ios') {
    return (
      <div className="w-full max-w-sm">
        {showIOSGuide ? (
          <div className="relative bg-white/95 border border-black/10 rounded-2xl p-4 shadow-lg">
            <button
              onClick={() => setShowIOSGuide(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="text-sm font-semibold text-gray-800 mb-3">Instalar en iPhone / iPad</p>
            <ol className="space-y-2.5">
              {[
                { icon: Share, text: 'Toca el botón Compartir en Safari' },
                { icon: Download, text: 'Selecciona "Añadir a pantalla de inicio"' },
                { icon: Smartphone, text: 'Toca "Añadir" para confirmar' },
              ].map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#21b9f7]/20 text-[#1a7de0] text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <Icon className="w-4 h-4 text-[#1a7de0] flex-shrink-0" />
                  <span className="text-[13px] text-gray-700">{text}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <button
            onClick={() => setShowIOSGuide(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/20 border border-white/30 text-white text-sm font-medium hover:bg-white/30 active:scale-[0.98] transition-all backdrop-blur-sm"
          >
            <Download className="w-4 h-4" />
            Instalar app
          </button>
        )}
      </div>
    )
  }

  // ── Chrome / Edge / Android: prompt nativo ───────────────────────────────
  return (
    <div className="w-full max-w-sm">
      <button
        onClick={handleInstall}
        disabled={installing}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/20 border border-white/30 text-white text-sm font-medium hover:bg-white/30 active:scale-[0.98] transition-all backdrop-blur-sm disabled:opacity-60"
      >
        {installing ? (
          <Monitor className="w-4 h-4 animate-pulse" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {installing ? 'Instalando...' : 'Instalar app en este dispositivo'}
      </button>
    </div>
  )
}
