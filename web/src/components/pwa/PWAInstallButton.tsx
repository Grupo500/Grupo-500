'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    __pwaPrompt?: BeforeInstallPromptEvent
  }
}

export function PWAInstallButton() {
  const [mounted, setMounted] = useState(false)
  const [hasPrompt, setHasPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    setMounted(true)

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

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
    if (!prompt) return
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

  if (!mounted || !hasPrompt || isInstalled) return null

  return (
    <button
      onClick={handleInstall}
      disabled={installing}
      className="w-full max-w-sm flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/20 border border-white/30 text-white text-sm font-medium hover:bg-white/30 active:scale-[0.98] transition-all backdrop-blur-sm disabled:opacity-60 cursor-pointer"
    >
      {installing
        ? <Download className="w-4 h-4 animate-pulse" />
        : <Download className="w-4 h-4" />
      }
      <span>{installing ? 'Instalando...' : 'Instalar app en este dispositivo'}</span>
    </button>
  )
}
