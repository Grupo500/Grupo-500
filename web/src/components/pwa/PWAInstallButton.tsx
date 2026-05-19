'use client'

import { useEffect, useState } from 'react'
import { Download, Share, X, Monitor, Smartphone, ChevronDown } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    __pwaPrompt?: BeforeInstallPromptEvent
  }
}

function detectBrowser(): 'chrome' | 'edge' | 'safari-ios' | 'safari-mac' | 'firefox' | 'other' {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  const isIOS = /iphone|ipad|ipod/i.test(ua)
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua)
  if (isIOS && isSafari) return 'safari-ios'
  if (!isIOS && isSafari) return 'safari-mac'
  if (/edg\//i.test(ua)) return 'edge'
  if (/chrome/i.test(ua)) return 'chrome'
  if (/firefox/i.test(ua)) return 'firefox'
  return 'other'
}

export function PWAInstallButton() {
  const [mounted, setMounted] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [hasPrompt, setHasPrompt] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [installing, setInstalling] = useState(false)
  const browser = mounted ? detectBrowser() : 'other'

  useEffect(() => {
    setMounted(true)

    // Ya instalada como PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Si el evento ya fue capturado globalmente (puede ocurrir antes del mount)
    if (window.__pwaPrompt) setHasPrompt(true)

    const handler = (e: Event) => {
      e.preventDefault()
      window.__pwaPrompt = e as BeforeInstallPromptEvent
      setHasPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setIsInstalled(true))

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    const prompt = window.__pwaPrompt
    if (!prompt) {
      // Sin evento nativo → mostrar guía manual
      setShowGuide(true)
      return
    }
    setInstalling(true)
    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') setIsInstalled(true)
    } finally {
      setInstalling(false)
      window.__pwaPrompt = undefined
      setHasPrompt(false)
    }
  }

  // ── Instrucciones manuales por navegador ─────────────────────────────────
  const guideSteps: Record<string, { steps: string[]; note?: string }> = {
    'chrome': {
      steps: [
        'Haz clic en el ícono ⊕ o ☰ en la barra de direcciones (esquina derecha)',
        'Selecciona "Instalar Grupo 500..."',
        'Haz clic en "Instalar" para confirmar',
      ],
      note: 'Si no ves el ícono, espera unos segundos y recarga la página.',
    },
    'edge': {
      steps: [
        'Haz clic en el ícono de aplicación en la barra de direcciones',
        'Selecciona "Instalar Grupo 500"',
        'Haz clic en "Instalar" para confirmar',
      ],
    },
    'safari-ios': {
      steps: [
        'Toca el botón Compartir (cuadro con flecha hacia arriba)',
        'Desliza y toca "Añadir a pantalla de inicio"',
        'Toca "Añadir" para confirmar',
      ],
    },
    'safari-mac': {
      steps: [
        'En el menú Archivo, selecciona "Añadir a Dock"',
        'Confirma el nombre y toca "Añadir"',
      ],
      note: 'Disponible en Safari 17+ (macOS Sonoma).',
    },
    'firefox': {
      steps: [
        'Firefox en escritorio no soporta instalación de PWA nativamente',
        'Usa Chrome o Edge para instalar esta app',
      ],
    },
    'other': {
      steps: ['Usa Chrome o Edge para instalar esta aplicación'],
    },
  }

  const guide = guideSteps[browser] ?? guideSteps['other']

  if (!mounted || isInstalled) return null

  return (
    <div className="w-full max-w-sm space-y-2">

      {/* Botón principal — siempre visible */}
      <button
        onClick={hasPrompt ? handleInstall : () => setShowGuide(v => !v)}
        disabled={installing}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/20 border border-white/30 text-white text-sm font-medium hover:bg-white/30 active:scale-[0.98] transition-all backdrop-blur-sm disabled:opacity-60 cursor-pointer"
      >
        {installing
          ? <Monitor className="w-4 h-4 animate-pulse" />
          : browser === 'safari-ios'
            ? <Share className="w-4 h-4" />
            : <Download className="w-4 h-4" />
        }
        <span>{installing ? 'Instalando...' : 'Instalar app en este dispositivo'}</span>
        {!hasPrompt && !installing && (
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showGuide ? 'rotate-180' : ''}`} />
        )}
      </button>

      {/* Guía manual expandible */}
      {showGuide && (
        <div className="relative bg-white/95 border border-black/10 rounded-2xl p-4 shadow-lg">
          <button
            onClick={() => setShowGuide(false)}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <p className="text-sm font-semibold text-gray-800 mb-3 pr-6">
            {browser === 'safari-ios' ? 'Instalar en iPhone / iPad' :
             browser === 'safari-mac' ? 'Instalar en Mac (Safari)' :
             browser === 'edge' ? 'Instalar desde Edge' :
             browser === 'chrome' ? 'Instalar desde Chrome' :
             'Cómo instalar'}
          </p>
          <ol className="space-y-2.5">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-[#21b9f7]/25 text-[#1a7de0] text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-[13px] text-gray-700 leading-snug">{step}</span>
              </li>
            ))}
          </ol>
          {guide.note && (
            <p className="text-[11px] text-gray-500 mt-3 pt-3 border-t border-gray-100">{guide.note}</p>
          )}
        </div>
      )}
    </div>
  )
}
